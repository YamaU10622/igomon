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
        authToken: string
      }
    }
  }
}

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

    req.user = user
    next()
  } catch (error) {
    console.error('認証エラー:', error)
    return res.status(500).json({ error: '認証処理中にエラーが発生しました' })
  }
}

// オプション: 認証が任意のエンドポイント用
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
      req.user = user
    }
    next()
  } catch (error) {
    console.error('認証エラー:', error)
    next() // エラーが発生しても続行
  }
}