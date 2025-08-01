// server/index.ts
import dotenv from 'dotenv'
dotenv.config()

// 開発環境でもタイムゾーンを日本時間に設定
if (!process.env.TZ) {
  process.env.TZ = 'Asia/Tokyo'
}

import express, { Request, Response } from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import apiRoutes from './routes/api'
import authRoutes from './routes/auth'
import authGoogleRoutes from './routes/auth-google'
import { sessionMiddleware } from './middleware/session'
import { ProblemWatcher } from './utils/file-watcher'
import { loadProblemFromDirectory } from './utils/problem-loader'
import { generateProblemHTML } from './utils/html-generator'
import { getProblems } from '../lib/database'

const app = express()
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

const port = process.env.PORT || 3000

// ミドルウェア
app.use(
  cors({
    origin: (origin, callback) => {
      // オリジンがない場合（同一オリジン）またはSITE_URLと一致する場合は許可
      if (!origin || origin === process.env.SITE_URL) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
  }),
)
app.use(cookieParser())
app.use(sessionMiddleware)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静的ファイル配信
// プロジェクトルートからの相対パスで指定
const rootDir =
  process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../..') // dist/server から ルートへ
    : path.join(__dirname, '..') // server から ルートへ

// 静的ファイルのデバッグログ
console.log('Static files serving from:', path.join(rootDir, 'public/dist'))

// placeholder-board.pngを特定のルートで配信
app.get('/placeholder-board.png', (_req: Request, res: Response) => {
  res.sendFile(path.join(rootDir, 'public/placeholder-board.png'))
})

app.use(express.static(path.join(rootDir, 'public/dist')))
app.use('/wgo', express.static(path.join(rootDir, 'public/wgo'))) // WGo.js配信
app.use('/problems', express.static(path.join(rootDir, 'public/problems')))
app.use('/ogp', express.static(path.join(rootDir, 'public/ogp')))

// API ルート
app.use('/api', apiRoutes)
app.use('/auth', authRoutes)
app.use('/auth', authGoogleRoutes)

// WebSocket接続処理
io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id)

  // 接続時に現在の問題一覧を送信
  const problems = await getProblems()
  socket.emit('initialProblems', problems)

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

// ファイル監視を開始
const problemWatcher = new ProblemWatcher(io)

// 環境変数からサイトURLを取得（デフォルトは開発環境）
const siteUrl = process.env.SITE_URL || `http://localhost:${port}`

// OGP画像にキャッシュバスティング用のタイムスタンプを追加（日単位）
const getOgpImageUrl = (problemId: number): string => {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD形式
  return `${siteUrl}/ogp/problem_${problemId}.png?v=${today}`
}

// 問題ページへの直接アクセス時のOGP対応
app.get('/questionnaire/:problemId', (req: Request, res: Response) => {
  const problemId = req.params.problemId
  const problem = loadProblemFromDirectory(problemId)

  if (problem) {
    const turnText = problem.turn === 'black' ? '黒番' : '白番'
    const ogpData = {
      title: `問題 ${problem.id} - いごもん`,
      description: `${turnText}: ${problem.description}`,
      imageUrl: getOgpImageUrl(problem.id),
      url: `${siteUrl}/questionnaire/${problem.id}`,
    }

    // OGPタグを含むHTMLを生成
    const html = generateProblemHTML(problem.id, ogpData)
    res.send(html)
  } else {
    // 問題が見つからない場合は通常のSPAとして処理
    res.sendFile(path.join(rootDir, 'public/dist/index.html'))
  }
})

// 結果ページへの直接アクセス時のOGP対応
app.get('/results/:problemId', (req: Request, res: Response) => {
  const problemId = req.params.problemId
  const problem = loadProblemFromDirectory(problemId)

  if (problem) {
    const turnText = problem.turn === 'black' ? '黒番' : '白番'
    const ogpData = {
      title: `問題 ${problem.id} 結果 - いごもん`,
      description: `${turnText}: ${problem.description}`,
      imageUrl: getOgpImageUrl(problem.id),
      url: `${siteUrl}/results/${problem.id}`,
    }

    const html = generateProblemHTML(problem.id, ogpData)
    res.send(html)
  } else {
    res.sendFile(path.join(rootDir, 'public/dist/index.html'))
  }
})

// ルートパスへのアクセス
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(rootDir, 'public/dist/index.html'))
})

// SPA用のフォールバック（すべてのルートをキャッチ）
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(rootDir, 'public/dist/index.html'))
})

// サーバー終了時のクリーンアップ
process.on('SIGTERM', () => {
  problemWatcher.destroy()
  server.close()
})

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
