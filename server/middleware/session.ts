import session from 'express-session'
import type { SessionOptions, Store } from 'express-session'
import { createClient } from 'redis'
import { RedisStore } from 'connect-redis'

// セッションデータの型定義
declare module 'express-session' {
  interface SessionData {
    userId?: number
    userUuid?: string
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
    pendingYosemonAnswer?: {
      problemId: string
      userAnswer: string
    }
    // 問題ごとのシャッフル順序を保存
    shuffleOrders?: Record<string, number[]>
  }
}

// Redisクライアントの作成
let redisClient: ReturnType<typeof createClient> | undefined
let redisStore: Store | undefined

// Redis接続の初期化
async function initializeRedis() {
  try {
    // Redis URLを環境変数から取得（デフォルトはローカルホスト）
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    
    redisClient = createClient({
      url: redisUrl,
      // 再接続の設定
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis: 再接続試行回数の上限に達しました')
            return new Error('再接続回数の上限')
          }
          // 指数バックオフで再接続
          return Math.min(retries * 100, 3000)
        }
      }
    })

    // エラーハンドリング
    redisClient.on('error', (err) => {
      console.error('Redis接続エラー:', err)
    })

    redisClient.on('connect', () => {
      console.log('Redisに接続しました')
    })

    await redisClient.connect()
    
    // RedisStoreの初期化
    redisStore = new RedisStore({
      client: redisClient,
      prefix: 'igomon:', // セッションキーのプレフィックス
      ttl: 90 * 24 * 60 * 60, // TTL（秒単位）: 90日間（約3ヶ月）
    })

    return true
  } catch (error) {
    console.error('Redis初期化エラー:', error)
    console.log('フォールバック: メモリストアを使用します')
    return false
  }
}

// セッション設定を生成する関数
async function createSessionConfig(): Promise<SessionOptions> {
  const baseConfig: SessionOptions = {
    secret: process.env.SESSION_SECRET || 'igomon-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 本番環境でのみHTTPS必須
      httpOnly: true,
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90日間（約3ヶ月）
      sameSite: 'lax', // CSRF対策
      path: '/', // 全パスで有効
      domain: undefined, // ドメインを指定しない（自動検出）
    },
    proxy: process.env.NODE_ENV === 'production',
    name: 'igomon.sid', // セッションクッキーの名前を指定
  }

  // Redisが利用可能な場合はRedisStoreを使用
  const redisAvailable = await initializeRedis()
  if (redisAvailable && redisStore) {
    console.log('セッションストア: Redisを使用')
    return {
      ...baseConfig,
      store: redisStore,
    }
  } else {
    console.log('セッションストア: メモリストア（デフォルト）を使用')
    return baseConfig
  }
}

// セッションミドルウェアの作成と エクスポート
let sessionMiddleware: ReturnType<typeof session>

export async function initializeSessionMiddleware() {
  const config = await createSessionConfig()
  sessionMiddleware = session(config)
  return sessionMiddleware
}

// 互換性のため、同期的にエクスポート（初期化前はダミー関数）
export { sessionMiddleware }

// Redisクライアントのクリーンアップ関数
export async function closeRedisConnection() {
  if (redisClient) {
    await redisClient.quit()
    console.log('Redis接続を閉じました')
  }
}