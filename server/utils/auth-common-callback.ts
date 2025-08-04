import express from 'express'
import { PrismaClient } from '@prisma/client'
import { handleAuthCallback } from './auth-callback'

const prisma = new PrismaClient()

interface CommonCallbackParams {
  req: express.Request
  res: express.Response
  provider: 'x' | 'google'
  exchangeCodeForToken: (code: string, codeVerifier: string, redirectUri: string) => Promise<any>
  fetchUserInfo: (accessToken: string) => Promise<{ id: string; [key: string]: any }>
  createOrUpdateUser: (userData: any, tokenData: any) => Promise<any>
  getRedirectUri: (req?: express.Request) => string
}

export async function handleCommonCallback({
  req,
  res,
  provider,
  exchangeCodeForToken,
  fetchUserInfo,
  createOrUpdateUser,
  getRedirectUri,
}: CommonCallbackParams) {
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

    // ユーザー情報の取得（Cookieにない場合のみ）
    let userData = null
    const cookieUserUuid = req.cookies?.userUuid

    if (cookieUserUuid) {
      // UUIDがクッキーにある場合、DBで確認
      const existingUser = await prisma.user.findUnique({
        where: { uuid: cookieUserUuid },
        include: {
          authProviders: {
            where: { provider },
          },
        },
      })

      if (existingUser && existingUser.authProviders.length > 0) {
        // 既存ユーザーが見つかった場合、APIコールをスキップ
        console.log(
          `CookieのUUIDから既存ユーザーを特定しました、${provider.toUpperCase()} APIコールをスキップします`,
        )
        userData = {
          id: existingUser.authProviders[0].providerUserId,
          ...Object.fromEntries(
            Object.keys(userData || {})
              .filter((k) => k !== 'id')
              .map((k) => [k, 'cached']),
          ),
        }
      } else {
        // UUIDはあるがプロバイダーがない場合はAPIを呼び出す
        console.log(`既存ユーザーが見つからないため、${provider.toUpperCase()} APIを呼び出します`)
        userData = await fetchUserInfo(tokenData.access_token)
      }
    } else {
      console.log(`既存ユーザーが見つからないため、${provider.toUpperCase()} APIを呼び出します`)
      userData = await fetchUserInfo(tokenData.access_token)
    }

    // 共通のコールバック処理を呼び出す
    await handleAuthCallback({
      req,
      res,
      provider,
      tokenData,
      userData,
      createOrUpdateUser,
    })
  } catch (error) {
    console.error(`${provider.toUpperCase()}認証コールバックエラー:`, error)

    // エラーの種類に応じて適切なリダイレクト
    if (error instanceof Error && error.message.includes('24時間ユーザー制限')) {
      return res.redirect('/?error=daily_limit')
    } else if (error instanceof Error && error.message.includes('レート制限')) {
      return res.redirect('/?error=rate_limit')
    } else {
      return res.redirect('/?error=auth_failed')
    }
  }
}
