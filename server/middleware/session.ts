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
      name: string
      rank: string
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
  resave: true, // セッションを常に再保存
  saveUninitialized: true, // セッションを確実に保存
  cookie: {
    secure: false, // 開発環境ではHTTPでも動作するように
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24時間
    sameSite: 'lax', // CSRF対策
    path: '/', // 全パスで有効
    domain: undefined // ドメインを指定しない
  },
  name: 'igomon.sid' // セッションクッキーの名前を指定
}

// セッションミドルウェアをエクスポート
export const sessionMiddleware = session(sessionConfig)