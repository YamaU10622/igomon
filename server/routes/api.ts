// server/routes/api.ts
import express, { Request, Response } from 'express'
import crypto from 'crypto'
import { saveAnswer, getResults, deleteAnswer, hasUserAnswered } from '../../lib/database'
import { loadProblemFromDirectory } from '../utils/problem-loader'
import { createProblem } from '../../src/app/api/problems/create/route'
import prisma from '../../lib/database'
import { requireAuth, optionalAuth } from '../middleware/auth'

const router = express.Router() as any

// 認証エンドポイント
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const userUuid = crypto.randomUUID()

    const user = await prisma.user.create({
      data: {
        uuid: userUuid,
      },
    })

    res.json({
      uuid: userUuid,
      message: 'ユーザー登録が完了しました',
    })
  } catch (error) {
    console.error('ユーザー登録エラー:', error)
    res.status(500).json({ error: 'ユーザー登録に失敗しました' })
  }
})

// ユーザープロファイル取得（認証必須）
router.get('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' })
    }

    res.json({
      name: user.profile?.name || '',
      rank: user.profile?.rank || '',
    })
  } catch (error) {
    console.error('プロファイル取得エラー:', error)
    res.status(500).json({ error: 'プロファイルの取得に失敗しました' })
  }
})

// ユーザープロファイル更新（認証必須）
router.put('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, rank } = req.body
    const userId = req.user!.id

    if (!name || !rank) {
      return res.status(400).json({ error: '名前と段位は必須です' })
    }

    // プロファイルが存在するか確認
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId },
    })

    if (existingProfile) {
      // 既存のプロファイルを更新
      await prisma.userProfile.update({
        where: { userId },
        data: { name, rank },
      })
    } else {
      // 新規プロファイルを作成
      await prisma.userProfile.create({
        data: {
          userId,
          name,
          rank,
        },
      })
    }

    res.json({ success: true, message: 'プロファイルを更新しました' })
  } catch (error) {
    console.error('プロファイル更新エラー:', error)
    res.status(500).json({ error: 'プロファイルの更新に失敗しました' })
  }
})

// 回答投稿（セッション認証またはトークン認証）
router.post('/answers', requireAuth, async (req: Request, res: Response) => {
  try {
    const { problemId, coordinate, reason, playerName, playerRank } = req.body
    const userUuid = req.user!.uuid // 認証ミドルウェアで設定されたユーザー情報から取得

    // 既に回答済みかチェック
    const alreadyAnswered = await hasUserAnswered(problemId, userUuid)
    if (alreadyAnswered) {
      // 回答済みの場合は、エラーではなく成功レスポンスを返す（結果ページへ遷移可能にする）
      return res.json({
        success: true,
        alreadyAnswered: true,
        message: 'この問題には既に回答済みです',
      })
    }

    // ユーザープロファイルを更新または作成
    const userId = req.user!.id
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId },
    })

    if (existingProfile) {
      await prisma.userProfile.update({
        where: { userId },
        data: { name: playerName, rank: playerRank },
      })
    } else {
      await prisma.userProfile.create({
        data: {
          userId,
          name: playerName,
          rank: playerRank,
        },
      })
    }

    const result = await saveAnswer({
      problemId,
      userUuid,
      coordinate,
      reason,
      playerName,
      playerRank,
    })

    res.json(result)
  } catch (error) {
    console.error('Error saving answer:', error)
    res.status(500).json({ error: 'Failed to save answer' })
  }
})

// 結果取得（認証必須）
router.get('/results/:problemId', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemId = parseInt(req.params.problemId)
    const results = await getResults(problemId)

    const currentUserUuid = req.user?.uuid // 認証済みの場合のみ存在

    // userUuidを隠蔽し、canDeleteフラグを追加
    const sanitizedResults = Object.entries(results).reduce((acc, [coord, data]) => {
      acc[coord] = {
        votes: data.votes,
        answers: data.answers.map((answer) => ({
          id: answer.id,
          coordinate: answer.coordinate,
          reason: answer.reason,
          playerName: answer.playerName,
          playerRank: answer.playerRank,
          createdAt: answer.createdAt,
          updatedAt: answer.updatedAt,
          // userUuidは返さない
          canDelete: currentUserUuid ? answer.userUuid === currentUserUuid : false,
        })),
      }
      return acc
    }, {} as any)

    res.json(sanitizedResults)
  } catch (error) {
    console.error('Error getting results:', error)
    res.status(500).json({ error: 'Failed to get results' })
  }
})

// 回答削除（認証必須）
router.delete('/answers/:answerId', requireAuth, async (req: Request, res: Response) => {
  try {
    const answerId = parseInt(req.params.answerId)
    const userUuid = req.user!.uuid // 認証ミドルウェアで設定されたユーザー情報から取得

    const success = await deleteAnswer(answerId, userUuid)

    if (success) {
      res.json({ success: true })
    } else {
      res.status(404).json({ error: 'Answer not found or not authorized' })
    }
  } catch (error) {
    console.error('Error deleting answer:', error)
    res.status(500).json({ error: 'Failed to delete answer' })
  }
})

// 問題一覧取得（データベースから取得）
router.get('/problems', async (req: Request, res: Response) => {
  try {
    // データベースから問題一覧を取得
    const problems = await prisma.problem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            answers: {
              where: { isDeleted: false },
            },
          },
        },
      },
    })

    // レスポンス形式を整形
    const problemsWithCounts = problems.map((problem) => ({
      id: problem.id,
      sgfFilePath: problem.sgfFilePath,
      description: problem.description,
      turn: problem.turn,
      createdDate: problem.createdAt.toISOString().split('T')[0], // 互換性のため一時的に残す
      createdAt: problem.createdAt,
      answerCount: problem._count.answers,
      deadline: problem.deadline, // 期限フィールドを追加
    }))

    res.json(problemsWithCounts)
  } catch (error) {
    console.error('Error getting problems:', error)
    res.status(500).json({ error: 'Failed to get problems' })
  }
})

// 問題詳細取得
router.get('/problems/:problemId', async (req: Request, res: Response) => {
  try {
    const problemId = req.params.problemId
    const problem = loadProblemFromDirectory(problemId)

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' })
    }

    // データベースからdeadline情報を取得
    const dbProblem = await prisma.problem.findUnique({
      where: { id: parseInt(problemId) },
      select: { deadline: true },
    })

    // deadlineをレスポンスに含める
    const responseData = {
      ...problem,
      deadline: dbProblem?.deadline || null,
    }

    res.json(responseData)
  } catch (error) {
    console.error('Error getting problem:', error)
    res.status(500).json({ error: 'Failed to get problem' })
  }
})

// SGFファイル取得
router.get('/sgf/:problemId', (req: Request, res: Response) => {
  try {
    const problemId = req.params.problemId
    const problemData = loadProblemFromDirectory(problemId)

    if (!problemData) {
      return res.status(404).json({ error: 'Problem not found' })
    }

    res.setHeader('Content-Type', 'application/x-go-sgf')
    res.send(problemData.sgfContent)
  } catch (error) {
    console.error('Error getting SGF:', error)
    res.status(500).json({ error: 'Failed to get SGF' })
  }
})

// ユーザーが問題に回答済みかチェック（認証必須）
router.get('/problems/:problemId/answered', requireAuth, async (req: Request, res: Response) => {
  try {
    const problemId = parseInt(req.params.problemId)
    const userUuid = req.user!.uuid // 認証ミドルウェアで設定されたユーザー情報から取得

    const answered = await hasUserAnswered(problemId, userUuid)
    res.json({ answered })
  } catch (error) {
    console.error('Error checking if user answered:', error)
    res.status(500).json({ error: 'Failed to check answer status' })
  }
})

// 問題作成
router.post('/problems', createProblem)

export default router
