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
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: '認証が必要です' })
  }

  // セッションからユーザー情報を設定
  prisma.user
    .findUnique({
      where: { id: req.session.userId },
    })
    .then((user) => {
      if (user) {
        // BANチェック
        if (user.isBanned) {
          req.session.destroy((err) => {
            if (err) console.error('セッション削除エラー:', err)
            res.status(401).json({ error: '認証が必要です' })
          })
          return
        }

        req.user = {
          id: user.id,
          uuid: user.uuid,
          xUserId: user.xUserId,
        }
        next()
      } else {
        res.status(401).json({ error: '認証が必要です' })
      }
    })
    .catch((error) => {
      console.error('認証エラー:', error)
      res.status(500).json({ error: '認証処理中にエラーが発生しました' })
    })
}

// 認証オプショナルミドルウェア（セッションベース）
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    prisma.user
      .findUnique({
        where: { id: req.session.userId },
      })
      .then((user) => {
        if (user) {
          // BANチェック
          if (user.isBanned) {
            req.session.destroy((err) => {
              if (err) console.error('セッション削除エラー:', err)
            })
            // BANされている場合はreq.userを設定しない
            next()
            return
          }

          req.user = {
            id: user.id,
            uuid: user.uuid,
            xUserId: user.xUserId,
          }
        }
        next()
      })
      .catch((error) => {
        console.error('認証エラー:', error)
        next() // エラーが発生しても続行
      })
  } else {
    next() // セッションがない場合はそのまま続行
  }
}
