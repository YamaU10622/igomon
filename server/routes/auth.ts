import express from 'express'
import { request } from 'undici'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

// 環境変数の取得
const CLIENT_ID = process.env.X_CLIENT_ID || ''
const CLIENT_SECRET = process.env.X_CLIENT_SECRET || ''
const AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const USER_URL = 'https://api.twitter.com/2/users/me'

// Step 1: 認証開始エンドポイント
router.get('/x', async (req, res) => {
  try {
    // PKCE用のcode_verifierとcode_challengeを生成
    const { code_verifier, code_challenge } = generatePKCEChallenge()

    // CSRF対策用のstateを生成
    const state = crypto.randomUUID()

    // セッションに保存
    req.session.codeVerifier = code_verifier
    req.session.state = state

    // 回答ページからのリダイレクトの場合、回答データを一時保存
    if (req.query.answer_data) {
      try {
        const answerData = JSON.parse(req.query.answer_data as string)
        req.session.pendingAnswer = answerData
      } catch (e) {
        console.error('回答データのパースエラー:', e)
      }
    }

    // 回答ページからログインボタンでのリダイレクトの場合
    if (req.query.from === 'questionnaire' && req.query.problem_id) {
      req.session.fromQuestionnaire = true
      req.session.questionnaireProblemId = req.query.problem_id as string
    }

    // 結果ページからのリダイレクトの場合、問題IDを一時保存
    if (req.query.redirect_to === 'results' && req.query.problem_id) {
      req.session.redirectToResults = true
      req.session.redirectProblemId = req.query.problem_id as string
    }

    // セッション保存を確実にする
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('セッション保存エラー:', err)
          reject(err)
        } else {
          resolve()
        }
      })
    })

    // 認可URLのパラメータ
    const redirectUri = getRedirectUri(req)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'users.read offline.access tweet.read', // offline.accessでリフレッシュトークン取得
      state: state,
      code_challenge,
      code_challenge_method: 'S256',
    })

    const redirectUrl = `${AUTH_URL}?${params.toString()}`

    // X認証画面へリダイレクト
    res.redirect(redirectUrl)
  } catch (error) {
    console.error('認証開始エラー:', error)
    res.status(500).json({ error: '認証の開始に失敗しました' })
  }
})

// Step 2: コールバックエンドポイント
router.get('/x/callback', async (req, res) => {
  const { state, code, error } = req.query

  // エラーチェック
  if (error) {
    console.error('認証エラー:', error)
    return res.redirect('/')
  }

  // CSRF対策：stateの検証
  if (state !== req.session.state) {
    console.error('State不一致: 受信=', state, 'セッション=', req.session.state)
    return res.status(400).send('Invalid state parameter')
  }

  // code_verifierの確認
  const codeVerifier = req.session.codeVerifier
  if (!codeVerifier) {
    return res.status(400).send('Missing code verifier')
  }

  try {
    // アクセストークンの取得
    const redirectUri = getRedirectUri(req)
    const tokenData = await exchangeCodeForToken(code as string, codeVerifier, redirectUri)

    // JWTトークンからユーザーIDを抽出してみる
    let user = null
    let userData = null

    // アクセストークンからユーザーIDを推定してみる
    // X OAuth2のトークン形式: [base64]:[timestamp]:[version]:[type]:[userId]
    const tokenParts = tokenData.access_token.split(':')
    if (tokenParts.length >= 5) {
      // トークンからuserIdを抽出できる可能性
      const possibleUserId = tokenParts[tokenParts.length - 1]

      // 既存ユーザーのチェック
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { xUserId: possibleUserId },
            // セッションにxUserIdがある場合
            ...(req.session.xUserId ? [{ xUserId: req.session.xUserId }] : []),
          ],
        },
      })

      if (existingUser) {
        // トークン情報のみ更新
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            xAccessToken: tokenData.access_token,
            xRefreshToken: tokenData.refresh_token,
            xTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          },
        })
        userData = {
          id: existingUser.xUserId!,
          username: 'cached',
          name: 'cached',
        }
      }
    }

    // ユーザーが見つからなかった場合のみAPIを呼び出す
    if (!user) {
      userData = await fetchUserInfo(tokenData.access_token)

      // ユーザーの作成または更新
      user = await createOrUpdateUser(userData, tokenData)
    }

    // BANチェック
    if (user.isBanned) {
      // BANされている場合はセッションを作成しない
      return res.redirect('/?error=auth_failed')
    }

    // セッションにユーザー情報を保存
    req.session.userId = user.id
    req.session.xUserId = user.xUserId || undefined

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
  } catch (error) {
    console.error('X認証コールバックエラー:', error)

    // エラーの種類に応じて適切なリダイレクト
    if (error instanceof Error && error.message.includes('24時間ユーザー制限')) {
      return res.redirect('/?error=daily_limit')
    } else if (error instanceof Error && error.message.includes('レート制限')) {
      return res.redirect('/?error=rate_limit')
    } else {
      return res.redirect('/?error=auth_failed')
    }
  }
})

// 現在のユーザー情報取得エンドポイント
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '認証が必要です' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: { profile: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' })
    }

    // BANチェック
    if (user.isBanned) {
      req.session.destroy((err) => {
        if (err) console.error('セッション削除エラー:', err)
      })
      return res.status(401).json({ error: '認証が必要です' })
    }

    res.json({
      id: user.id,
      xUserId: user.xUserId,
      profile: user.profile,
    })
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error)
    res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' })
  }
})

// ログアウトエンドポイント
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'ログアウトに失敗しました' })
    }
    res.json({ success: true })
  })
})

// 開発環境と本番環境でリダイレクトURIを切り替える
const getRedirectUri = (req?: express.Request) => {
  // 環境変数が明示的に設定されている場合
  if (process.env.X_REDIRECT_URI) {
    return process.env.X_REDIRECT_URI
  }

  // 環境変数が設定されていない場合はエラーを投げる
  throw new Error('X_REDIRECT_URI環境変数が設定されていません')
}

// PKCE用のcode_verifierとcode_challengeを生成する関数
function generatePKCEChallenge() {
  const code_verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url')
  return {
    code_verifier,
    code_challenge: challenge,
  }
}

// トークン交換関数
async function exchangeCodeForToken(code: string, codeVerifier: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    code,
  })

  // Basic認証ヘッダー（Webアプリは機密クライアント）
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const responseText = await response.body.text()

  if (response.statusCode !== 200) {
    const error = await response.body.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return JSON.parse(responseText) as {
    access_token: string
    refresh_token?: string
    token_type: string
    expires_in: number
    scope: string
  }
}

// ユーザー情報取得関数（リトライ機能付き）
async function fetchUserInfo(
  accessToken: string,
  retryCount = 0,
): Promise<{ id: string; username: string; name: string }> {
  try {
    const response = await request(USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (response.statusCode === 429) {
      // レート制限エラーの場合
      const rateLimitReset = response.headers['x-rate-limit-reset']
      const resetTime = rateLimitReset
        ? new Date(
            parseInt(Array.isArray(rateLimitReset) ? rateLimitReset[0] : rateLimitReset) * 1000,
          )
        : null
      // 24時間ユーザー制限のチェック
      const userLimit24h = response.headers['x-user-limit-24hour-remaining']
      const userLimit24hReset = response.headers['x-user-limit-24hour-reset']

      const userLimitValue = Array.isArray(userLimit24h) ? userLimit24h[0] : userLimit24h
      if (userLimitValue === '0' || userLimitValue === undefined) {
        const resetTime24h = userLimit24hReset
          ? new Date(
              parseInt(
                Array.isArray(userLimit24hReset) ? userLimit24hReset[0] : userLimit24hReset,
              ) * 1000,
            )
          : null
        console.error(
          'X API 24時間ユーザー制限に達しました。リセット時刻:',
          resetTime24h?.toLocaleString('ja-JP'),
        )
        throw new Error(
          `X APIの24時間ユーザー制限に達しました。${resetTime24h?.toLocaleString('ja-JP') || '明日'}まで待ってください。`,
        )
      }

      if (retryCount < 3) {
        const waitTime = Math.pow(2, retryCount + 2) // 4秒, 8秒, 16秒
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000))
        return fetchUserInfo(accessToken, retryCount + 1)
      }
      throw new Error('X APIのレート制限に達しました。しばらく待ってから再度お試しください。')
    }

    if (response.statusCode === 401) {
      const error = await response.body.text()
      console.error('X API 認証エラー (401):', error)
      console.error('使用したアクセストークン:', accessToken)
      throw new Error('X API認証エラー: アクセストークンが無効です')
    }

    if (response.statusCode !== 200) {
      const error = await response.body.text()
      console.error('X API エラー:', response.statusCode, error)
      throw new Error(`X APIエラー: ${response.statusCode}`)
    }

    const result = (await response.body.json()) as {
      data: { id: string; username: string; name: string }
    }
    return result.data
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error)
    throw error
  }
}

// ユーザー作成/更新関数
async function createOrUpdateUser(
  xUserData: { id: string; username: string; name: string },
  tokenData: any,
) {
  // 既存ユーザーの確認
  const existingUser = await prisma.user.findUnique({
    where: { xUserId: xUserData.id },
  })

  if (existingUser) {
    // トークン情報を更新
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        xAccessToken: tokenData.access_token,
        xRefreshToken: tokenData.refresh_token,
        xTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    })
    return updatedUser
  }

  // 新規ユーザー作成
  const newUser = await prisma.user.create({
    data: {
      uuid: crypto.randomUUID(),
      xUserId: xUserData.id,
      xAccessToken: tokenData.access_token,
      xRefreshToken: tokenData.refresh_token,
      xTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    },
  })

  return newUser
}

// リフレッシュトークンを使用したアクセストークン更新
export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  })

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (response.statusCode !== 200) {
    const error = await response.body.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  return await response.body.json()
}

export default router
