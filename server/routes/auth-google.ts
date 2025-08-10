import express from 'express'
import { request } from 'undici'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { handleCommonCallback } from '../utils/auth-common-callback'

const router = express.Router()
const prisma = new PrismaClient()

// 環境変数の取得
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USER_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

// Step 1: 認証開始エンドポイント
router.get('/google', async (req, res) => {
  try {
    // PKCE用のcode_verifierとcode_challengeを生成
    const { code_verifier, code_challenge } = generatePKCEChallenge()

    // CSRF対策用のstateを生成
    const state = crypto.randomUUID()

    // セッションに保存
    req.session.codeVerifier = code_verifier
    req.session.state = state

    // 回答ページからのリダイレクトの場合、回答データを一時保存
    let answerData: any = null
    if (req.query.answer_data) {
      try {
        answerData = JSON.parse(req.query.answer_data as string)
        // Yosemonデータかどうかを判定（userAnswerプロパティがある場合はYosemon）
        if (answerData.userAnswer) {
          // Yosemonデータの場合
          req.session.pendingYosemonAnswer = answerData
          console.log('✅ auth-google.ts: Yosemon回答データをセッションに保存:', answerData)
        } else {
          // 通常の回答データの場合
          req.session.pendingAnswer = answerData
          console.log('✅ auth-google.ts: 回答データをセッションに保存:', answerData)
        }
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
    if (req.query.from === 'results' && req.query.problem_id) {
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
      scope: 'openid profile email',
      state: state,
      code_challenge,
      code_challenge_method: 'S256',
    })

    const redirectUrl = `${AUTH_URL}?${params.toString()}`

    // Google認証画面へリダイレクト
    res.redirect(redirectUrl)
  } catch (error) {
    console.error('認証開始エラー:', error)
    res.status(500).json({ error: '認証の開始に失敗しました' })
  }
})

// Step 2: コールバックエンドポイント
router.get('/google/callback', async (req, res) => {
  await handleCommonCallback({
    req,
    res,
    provider: 'google',
    exchangeCodeForToken,
    fetchUserInfo,
    createOrUpdateUser,
    getRedirectUri,
  })
})

// 開発環境と本番環境でリダイレクトURIを切り替える
const getRedirectUri = (req?: express.Request) => {
  // 環境変数が明示的に設定されている場合
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI
  }

  // 環境変数が設定されていない場合はエラーを投げる
  throw new Error('GOOGLE_REDIRECT_URI環境変数が設定されていません')
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
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    code,
  })

  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const responseText = await response.body.text()

  if (response.statusCode !== 200) {
    throw new Error(`Token exchange failed: ${responseText}`)
  }

  return JSON.parse(responseText) as {
    access_token: string
    refresh_token?: string
    token_type: string
    expires_in: number
    scope: string
  }
}

// ユーザー情報取得関数
async function fetchUserInfo(accessToken: string): Promise<{ id: string }> {
  const response = await request(USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.statusCode !== 200) {
    const error = await response.body.text()
    console.error('Google API エラー:', response.statusCode, error)
    throw new Error(`Google APIエラー: ${response.statusCode}`)
  }

  const result = (await response.body.json()) as {
    id: string
  }
  return result
}

// ユーザー作成/更新関数
async function createOrUpdateUser(googleUserData: { id: string }, tokenData: any) {
  // 既存のAuthProviderを確認
  const existingProvider = await prisma.authProvider.findUnique({
    where: {
      provider_providerUserId: {
        provider: 'google',
        providerUserId: googleUserData.id,
      },
    },
    include: {
      user: true,
    },
  })

  if (existingProvider) {
    // トークン情報を更新
    await prisma.authProvider.update({
      where: { id: existingProvider.id },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    })
    return existingProvider.user
  }

  // 新規ユーザーとAuthProviderを作成
  const newUser = await prisma.user.create({
    data: {
      uuid: crypto.randomUUID(),
      authProviders: {
        create: {
          provider: 'google',
          providerUserId: googleUserData.id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      },
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
    client_secret: CLIENT_SECRET,
  })

  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
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
