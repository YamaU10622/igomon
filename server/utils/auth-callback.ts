import express from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CallbackHandlerParams {
  req: express.Request
  res: express.Response
  provider: 'x' | 'google'
  tokenData: {
    access_token: string
    refresh_token?: string
    expires_in: number
  }
  userData: {
    id: string
    [key: string]: any
  }
  createOrUpdateUser: (userData: any, tokenData: any) => Promise<any>
}

export async function handleAuthCallback({
  req,
  res,
  provider,
  tokenData,
  userData,
  createOrUpdateUser,
}: CallbackHandlerParams) {
  let user = null
  let skipApiCall = false

  // Cookieから以前のユーザーUUIDを取得
  const cookieUserUuid = req.cookies?.userUuid

  // 既存のプロバイダー別クッキーから移行（後方互換性）
  const legacyXUserId = req.cookies?.xUserId
  const legacyGoogleUserId = req.cookies?.googleUserId

  // CookieにユーザーUUIDがある場合、まずDBで検索
  if (cookieUserUuid) {
    const existingUser = await prisma.user.findUnique({
      where: { uuid: cookieUserUuid },
      include: {
        authProviders: {
          where: { provider },
        },
      },
    })

    if (existingUser && existingUser.authProviders.length > 0) {
      // 既存ユーザーが見つかった場合、トークン情報のみ更新
      await prisma.authProvider.update({
        where: { id: existingUser.authProviders[0].id },
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      })
      user = existingUser
      skipApiCall = true
      console.log(`Cookieから既存ユーザーを特定し、トークンを更新しました:`, cookieUserUuid)
      // userDataをキャッシュデータで上書き（APIコール回避）
      userData = {
        id: existingUser.authProviders[0].providerUserId,
        ...Object.fromEntries(
          Object.keys(userData)
            .filter((k) => k !== 'id')
            .map((k) => [k, 'cached']),
        ),
      }
    }
  }

  // レガシークッキーからの移行処理
  if (!user && (legacyXUserId || legacyGoogleUserId)) {
    const legacyProviderUserId = provider === 'x' ? legacyXUserId : legacyGoogleUserId
    if (legacyProviderUserId) {
      const existingProvider = await prisma.authProvider.findUnique({
        where: {
          provider_providerUserId: {
            provider,
            providerUserId: legacyProviderUserId,
          },
        },
        include: {
          user: true,
        },
      })

      if (existingProvider) {
        // 既存ユーザーが見つかった場合、トークン情報のみ更新
        await prisma.authProvider.update({
          where: { id: existingProvider.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          },
        })
        user = existingProvider.user
        skipApiCall = true
        console.log(
          `レガシークッキーから既存ユーザーを特定し、トークンを更新しました:`,
          legacyProviderUserId,
        )
        // userDataをキャッシュデータで上書き（APIコール回避）
        userData = {
          id: legacyProviderUserId,
          ...Object.fromEntries(
            Object.keys(userData)
              .filter((k) => k !== 'id')
              .map((k) => [k, 'cached']),
          ),
        }
      }
    }
  }

  // ユーザーが見つからなかった場合のみAPIを呼び出す
  if (!user) {
    console.log(`既存ユーザーが見つからないため、${provider.toUpperCase()} APIを呼び出します`)
    // userDataがskipApiCallの場合はキャッシュデータ、そうでない場合はAPIから取得済みのものを使用
    user = await createOrUpdateUser(userData, tokenData)
  }

  // BANチェック
  if (user.isBanned) {
    // BANされている場合はセッションを作成しない
    return res.redirect('/?error=auth_failed')
  }

  // セッションにユーザー情報を保存
  req.session.userId = user.id
  req.session.userUuid = user.uuid

  // CookieにユーザーUUIDを保存（30日間有効）
  if (user?.uuid) {
    res.cookie('userUuid', user.uuid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30日間
    })
  }

  // レガシークッキーを削除
  res.clearCookie('xUserId')
  res.clearCookie('googleUserId')

  // セッション保存を確実にする
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error('セッション保存エラー（コールバック）:', err)
        reject(err)
      } else {
        resolve()
      }
    })
  })

  // 一時データの取得（削除前に取得）
  const pendingAnswer = req.session.pendingAnswer
  const fromQuestionnaire = req.session.fromQuestionnaire
  const questionnaireProblemId = req.session.questionnaireProblemId
  const redirectToResults = req.session.redirectToResults
  const redirectProblemId = req.session.redirectProblemId

  // セッションの一時データをクリーンアップ
  delete req.session.codeVerifier
  delete req.session.state
  delete req.session.pendingAnswer
  delete req.session.fromQuestionnaire
  delete req.session.questionnaireProblemId
  delete req.session.redirectToResults
  delete req.session.redirectProblemId

  // 一時保存した回答データがある場合の処理
  if (pendingAnswer) {
    const answerData = pendingAnswer

    try {
      // 回答済みかチェック
      const existingAnswer = await prisma.answer.findFirst({
        where: {
          userUuid: user.uuid,
          problemId: answerData.problemId,
        },
      })

      if (existingAnswer) {
        // 回答済みの場合は結果ページへリダイレクト
        return res.redirect(`/results/${answerData.problemId}`)
      } else {
        // 未回答の場合、回答を保存
        await prisma.answer.create({
          data: {
            userUuid: user.uuid,
            problemId: answerData.problemId,
            coordinate: answerData.coordinate,
            reason: answerData.reason,
            playerName: answerData.playerName || '',
            playerRank: answerData.playerRank || '',
          },
        })

        // ユーザープロファイルも保存
        if (answerData.playerName && answerData.playerRank) {
          try {
            const existingProfile = await prisma.userProfile.findUnique({
              where: { userId: user.id },
            })

            if (existingProfile) {
              await prisma.userProfile.update({
                where: { userId: user.id },
                data: {
                  name: answerData.playerName,
                  rank: answerData.playerRank,
                  updatedAt: new Date(),
                },
              })
            } else {
              await prisma.userProfile.create({
                data: {
                  userId: user.id,
                  name: answerData.playerName,
                  rank: answerData.playerRank,
                },
              })
            }
          } catch (profileError) {
            console.error('プロファイル保存エラー（認証コールバック）:', profileError)
          }
        }

        // 回答保存後、結果ページへリダイレクト
        return res.redirect(`/results/${answerData.problemId}`)
      }
    } catch (error) {
      console.error('回答保存エラー:', error)
      // エラーが発生した場合も結果ページへリダイレクト（エラーメッセージは結果ページで表示）
      return res.redirect(`/results/${answerData.problemId}`)
    }
  }

  // 回答ページからログインボタンでログインした場合
  if (fromQuestionnaire && questionnaireProblemId) {
    const problemId = parseInt(questionnaireProblemId)

    try {
      // 回答済みかチェック
      const existingAnswer = await prisma.answer.findFirst({
        where: {
          userUuid: user.uuid,
          problemId: problemId,
        },
      })

      if (existingAnswer) {
        // 回答済みの場合は結果ページへリダイレクト
        return res.redirect(`/results/${problemId}`)
      } else {
        // 未回答の場合は回答ページに戻る
        return res.redirect(`/questionnaire/${problemId}`)
      }
    } catch (error) {
      console.error('回答状態チェックエラー:', error)
      // エラーが発生した場合は回答ページに戻る
      return res.redirect(`/questionnaire/${problemId}`)
    }
  }

  // 結果ページへのリダイレクトが必要な場合
  if (redirectToResults && redirectProblemId) {
    const problemId = redirectProblemId

    // 結果ページへリダイレクト
    return res.redirect(`/results/${problemId}`)
  }

  // 通常のログイン完了
  res.redirect('/')
}
