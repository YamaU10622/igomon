import express from 'express'
import { request } from 'undici'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { handleCommonCallback } from '../utils/auth-common-callback'

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
    let answerData: any = null
    if (req.query.answer_data) {
      try {
        answerData = JSON.parse(req.query.answer_data as string)
        // Yosemonデータかどうかを判定（userAnswerプロパティがある場合はYosemon）
        if (answerData.userAnswer) {
          // Yosemonデータの場合
          req.session.pendingYosemonAnswer = answerData
          console.log('✅ auth.ts: Yosemon回答データをセッションに保存:', answerData)
        } else {
          // 通常の回答データの場合
          req.session.pendingAnswer = answerData
          console.log('✅ auth.ts: 回答データをセッションに保存:', answerData)
        }
      } catch (e) {
        console.error('回答データのパースエラー:', e)
      }
    }

    // よせもんからのリダイレクトの場合
    if (req.query.from === 'yosemon' && req.query.problem_id) {
      // answer_dataが既にセッションに保存されている場合は、pendingYosemonAnswerに設定済み
      console.log('✅ auth.ts: よせもんからのリダイレクト設定')
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
  await handleCommonCallback({
    req,
    res,
    provider: 'x',
    exchangeCodeForToken,
    fetchUserInfo,
    createOrUpdateUser,
    getRedirectUri,
  })
})

// 現在のユーザー情報取得エンドポイント
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    // 未認証の場合も200を返す（nullを返すことで未認証を示す）
    return res.status(200).json(null)
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: { profile: true },
    })

    if (!user) {
      // ユーザーが見つからない場合も200でnullを返す
      return res.status(200).json(null)
    }

    // BANチェック
    if (user.isBanned) {
      req.session.destroy((err) => {
        if (err) console.error('セッション削除エラー:', err)
      })
      // BANされている場合も200でnullを返す
      return res.status(200).json(null)
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
  // 後方互換性: 旧カラムでユーザーを検索
  const existingUserOld = await prisma.user.findUnique({
    where: { xUserId: xUserData.id },
  })

  if (existingUserOld) {
    // 旧形式のユーザーにauth_providerがない場合は作成
    const authProvider = await prisma.authProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'x',
          providerUserId: xUserData.id,
        },
      },
    })

    if (!authProvider) {
      await prisma.authProvider.create({
        data: {
          userId: existingUserOld.id,
          provider: 'x',
          providerUserId: xUserData.id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      })
    } else {
      // 既存のauth_providerを更新
      await prisma.authProvider.update({
        where: { id: authProvider.id },
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      })
    }

    // 旧カラムも更新（後方互換性）
    const updatedUser = await prisma.user.update({
      where: { id: existingUserOld.id },
      data: {
        xAccessToken: tokenData.access_token,
        xRefreshToken: tokenData.refresh_token,
        xTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    })
    return updatedUser
  }

  // 新規ユーザー作成（旧カラムとauth_provider両方に保存）
  const newUser = await prisma.user.create({
    data: {
      uuid: crypto.randomUUID(),
      xUserId: xUserData.id,
      xAccessToken: tokenData.access_token,
      xRefreshToken: tokenData.refresh_token,
      xTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      authProviders: {
        create: {
          provider: 'x',
          providerUserId: xUserData.id,
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
