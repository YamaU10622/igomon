import session from 'express-session'
import type { SessionOptions } from 'express-session'

// セッションデータの型定義
declare module 'express-session' {
  interface SessionData {
    userId?: number
    xUserId?: string
    codeVerifier?: string
    state?: string
    pendingAnswer?: {
      problemId: number
      coordinate: string
      reason: string
      playerName: string
      playerRank: string
    }
    redirectToResults?: boolean
    redirectProblemId?: string
    fromQuestionnaire?: boolean
    questionnaireProblemId?: string
  }
}

// セッション設定
const sessionConfig: SessionOptions = {
  secret: process.env.SESSION_SECRET || 'igomon-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // 本番環境でのみHTTPS必須
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7日間
    sameSite: 'lax', // CSRF対策
    path: '/', // 全パスで有効
    domain: undefined, // ドメインを指定しない（自動検出）
  },
  proxy: process.env.NODE_ENV === 'production',
  name: 'igomon.sid', // セッションクッキーの名前を指定
}

// セッションミドルウェアをエクスポート
export const sessionMiddleware = session(sessionConfig)
