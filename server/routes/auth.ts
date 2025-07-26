import express from 'express'
import { request } from 'undici'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

// 環境変数の取得
const CLIENT_ID = process.env.X_CLIENT_ID || ''
const CLIENT_SECRET = process.env.X_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.X_REDIRECT_URI || 'http://localhost:5173/auth/x/callback'

const AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const USER_URL = 'https://api.twitter.com/2/users/me'

// PKCE用のcode_verifierとcode_challengeを生成する関数
function generatePKCEChallenge() {
  const code_verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url')
  return {
    code_verifier,
    code_challenge: challenge
  }
}

// Step 1: 認証開始エンドポイント
router.get('/x', async (req, res) => {
  console.log('X認証開始エンドポイントが呼ばれました')
  try {
    // PKCE用のcode_verifierとcode_challengeを生成
    const { code_verifier, code_challenge } = generatePKCEChallenge()
    
    // CSRF対策用のstateを生成
    const state = crypto.randomUUID()
    
    // セッションに保存
    req.session.codeVerifier = code_verifier
    req.session.state = state
    
    // セッション保存を確実にする
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('セッション保存エラー:', err)
          reject(err)
        } else {
          console.log('セッションに保存されたstate:', state)
          console.log('セッションID:', req.sessionID)
          console.log('セッションクッキー:', req.headers.cookie)
          resolve()
        }
      })
    })
    
    // 回答ページからのリダイレクトの場合、回答データを一時保存
    if (req.query.answer_data) {
      try {
        req.session.pendingAnswer = JSON.parse(req.query.answer_data as string)
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
    
    // 認可URLのパラメータ
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'users.read offline.access tweet.read', // offline.accessでリフレッシュトークン取得
      state: state,
      code_challenge,
      code_challenge_method: 'S256'
    })
    
    const redirectUrl = `${AUTH_URL}?${params.toString()}`
    console.log('リダイレクト先URL:', redirectUrl)
    console.log('CLIENT_ID:', CLIENT_ID)
    console.log('REDIRECT_URI:', REDIRECT_URI)
    
    // X認証画面へリダイレクト
    res.redirect(redirectUrl)
  } catch (error) {
    console.error('認証開始エラー:', error)
    res.status(500).json({ error: '認証の開始に失敗しました' })
  }
})

// Step 2: コールバックエンドポイント
router.get('/x/callback', async (req, res) => {
  console.log('コールバックエンドポイントが呼ばれました')
  console.log('受信したstate:', req.query.state)
  console.log('セッションのstate:', req.session.state)
  console.log('セッションID:', req.sessionID)
  console.log('セッション内容:', req.session)
  
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
    const tokenData = await exchangeCodeForToken(code as string, codeVerifier)
    
    // ユーザー情報の取得
    const userData = await fetchUserInfo(tokenData.access_token)
    
    // ユーザーの作成または更新
    const user = await createOrUpdateUser(userData, tokenData)
    
    // セッションにユーザー情報を保存
    req.session.userId = user.id
    req.session.xUserId = userData.id
    
    // セッションの一時データをクリーンアップ
    delete req.session.codeVerifier
    delete req.session.state
    
    // 一時保存した回答データがある場合の処理
    if (req.session.pendingAnswer) {
      const answerData = req.session.pendingAnswer
      delete req.session.pendingAnswer
      
      try {
        // 回答済みかチェック
        const existingAnswer = await prisma.answer.findFirst({
          where: {
            userUuid: user.uuid,
            problemId: answerData.problemId
          }
        })
        
        if (!existingAnswer) {
          // 未回答の場合、回答を保存
          await prisma.answer.create({
            data: {
              userUuid: user.uuid,
              problemId: answerData.problemId,
              coordinate: answerData.coordinate,
              reason: answerData.reason,
              playerName: answerData.name,
              playerRank: answerData.rank
            }
          })
        }
        // 回答済みの場合は回答データを破棄（既に削除済み）
        
        // 結果ページへリダイレクト
        return res.redirect(`/results/${answerData.problemId}`)
      } catch (error) {
        console.error('回答保存エラー:', error)
        // エラーが発生しても結果ページへリダイレクト
        return res.redirect(`/results/${answerData.problemId}`)
      }
    }
    
    // 回答ページからログインボタンでログインした場合
    if (req.session.fromQuestionnaire && req.session.questionnaireProblemId) {
      const problemId = parseInt(req.session.questionnaireProblemId)
      delete req.session.fromQuestionnaire
      delete req.session.questionnaireProblemId
      
      try {
        // 回答済みかチェック
        const existingAnswer = await prisma.answer.findFirst({
          where: {
            userUuid: user.uuid,
            problemId: problemId
          }
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
    if (req.session.redirectToResults && req.session.redirectProblemId) {
      const problemId = req.session.redirectProblemId
      delete req.session.redirectToResults
      delete req.session.redirectProblemId
      
      // 結果ページへリダイレクト
      return res.redirect(`/results/${problemId}`)
    }
    
    // 通常のログイン完了
    res.redirect('/')
    
  } catch (error) {
    console.error('トークン交換エラー:', error)
    res.status(500).send('認証処理中にエラーが発生しました')
  }
})

// トークン交換関数
async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
    code
  })
  
  // Basic認証ヘッダー（Webアプリは機密クライアント）
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  
  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  })
  
  if (response.statusCode !== 200) {
    const error = await response.body.text()
    throw new Error(`Token exchange failed: ${error}`)
  }
  
  return await response.body.json() as {
    access_token: string
    refresh_token?: string
    token_type: string
    expires_in: number
    scope: string
  }
}

// ユーザー情報取得関数
async function fetchUserInfo(accessToken: string) {
  const response = await request(USER_URL, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })
  
  if (response.statusCode !== 200) {
    const error = await response.body.text()
    throw new Error(`Failed to fetch user info: ${error}`)
  }
  
  const result = await response.body.json() as { data: { id: string; username: string; name: string } }
  return result.data
}

// ユーザー作成/更新関数
async function createOrUpdateUser(xUserData: { id: string; username: string; name: string }, tokenData: any) {
  // 既存ユーザーの確認
  const existingUser = await prisma.user.findUnique({
    where: { xUserId: xUserData.id }
  })
  
  if (existingUser) {
    // トークン情報を更新
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        xAccessToken: tokenData.access_token,
        xRefreshToken: tokenData.refresh_token,
        xTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000)
      }
    })
    return updatedUser
  }
  
  // 新規ユーザー作成（uuid と authToken は一時的に生成）
  const newUser = await prisma.user.create({
    data: {
      uuid: crypto.randomUUID(),
      authToken: crypto.randomBytes(32).toString('hex'),
      xUserId: xUserData.id,
      xAccessToken: tokenData.access_token,
      xRefreshToken: tokenData.refresh_token,
      xTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000)
    }
  })
  
  return newUser
}

// リフレッシュトークンを使用したアクセストークン更新
export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID
  })
  
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  
  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  })
  
  if (response.statusCode !== 200) {
    const error = await response.body.text()
    throw new Error(`Token refresh failed: ${error}`)
  }
  
  return await response.body.json()
}

// ログアウトエンドポイント
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'ログアウトに失敗しました' })
    }
    res.json({ success: true })
  })
})

// 現在のユーザー情報取得エンドポイント
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '認証が必要です' })
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: { profile: true }
    })
    
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' })
    }
    
    res.json({
      id: user.id,
      xUserId: user.xUserId,
      profile: user.profile
    })
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error)
    res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' })
  }
})

export default router