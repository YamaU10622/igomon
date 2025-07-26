import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Requestオブジェクトを拡張してuserプロパティを追加
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        uuid: string
        xUserId?: string | null
      }
    }
  }
}

// 認証必須ミドルウェア（セッションベース）
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.session.userId) {
    return res.status(401).json({ error: '認証が必要です' })
  }
  
  // セッションからユーザー情報を設定
  prisma.user.findUnique({
    where: { id: req.session.userId }
  }).then(user => {
    if (user) {
      req.user = {
        id: user.id,
        uuid: user.uuid,
        xUserId: user.xUserId
      }
      next()
    } else {
      res.status(401).json({ error: '認証が必要です' })
    }
  }).catch(error => {
    console.error('認証エラー:', error)
    res.status(500).json({ error: '認証処理中にエラーが発生しました' })
  })
}

// 認証オプショナルミドルウェア（セッションベース）
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.session.userId) {
    prisma.user.findUnique({
      where: { id: req.session.userId }
    }).then(user => {
      if (user) {
        req.user = {
          id: user.id,
          uuid: user.uuid,
          xUserId: user.xUserId
        }
      }
      next()
    }).catch(error => {
      console.error('認証エラー:', error)
      next() // エラーが発生しても続行
    })
  } else {
    next() // セッションがない場合はそのまま続行
  }
}

// 既存の認証トークンベース（後方互換性のため一時的に残す）
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN形式を想定

  if (!token) {
    return res.status(401).json({ error: '認証が必要です' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { authToken: token }
    })

    if (!user) {
      return res.status(401).json({ error: '無効なトークンです' })
    }

    req.user = {
      id: user.id,
      uuid: user.uuid,
      xUserId: user.xUserId
    }
    next()
  } catch (error) {
    console.error('認証エラー:', error)
    return res.status(500).json({ error: '認証処理中にエラーが発生しました' })
  }
}

// オプション: 認証が任意のエンドポイント用（トークンベース）
export async function optionalAuthenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return next() // トークンがない場合は認証なしで続行
  }

  try {
    const user = await prisma.user.findUnique({
      where: { authToken: token }
    })

    if (user) {
      req.user = {
        id: user.id,
        uuid: user.uuid,
        xUserId: user.xUserId
      }
    }
    next()
  } catch (error) {
    console.error('認証エラー:', error)
    next() // エラーが発生しても続行
  }
}