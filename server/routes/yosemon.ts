import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// 問題一覧取得API
router.get('/problems', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // すべての問題を取得
    const problems = await prisma.yosemonProblem.findMany({
      orderBy: { problemNumber: 'asc' },
      include: {
        answers: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    
    // ユーザーの回答履歴を取得
    let userAnswers: any[] = [];
    if (userId) {
      userAnswers = await prisma.yosemonUserAnswer.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
    }
    
    // 問題ごとの統計情報を計算
    const problemsWithStats = await Promise.all(problems.map(async (problem) => {
      // 全体の回答数と正解数を取得
      const totalAnswers = await prisma.yosemonUserAnswer.count({
        where: { problemId: problem.id }
      });
      
      const correctAnswers = await prisma.yosemonUserAnswer.count({
        where: { 
          problemId: problem.id,
          isCorrect: true
        }
      });
      
      // 正解率を計算
      const correctRate = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
      
      // ユーザーの最新の回答状態を取得
      const userLatestAnswer = userAnswers.find(a => a.problemId === problem.id);
      let userStatus = 'unanswered';
      if (userLatestAnswer) {
        userStatus = userLatestAnswer.isCorrect ? 'correct' : 'incorrect';
      }
      
      return {
        id: problem.id,
        problemNumber: problem.problemNumber,
        moves: problem.moves,
        answersCount: problem.answers.length,
        correctRate: Math.round(correctRate),
        userStatus,
        totalAnswers
      };
    }));
    
    res.json(problemsWithStats);
  } catch (error) {
    console.error('Error fetching problems:', error);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

// 問題詳細取得API
router.get('/problems/:id', async (req: Request, res: Response) => {
  try {
    const problemNumber = parseInt(req.params.id);
    
    // データベースから問題情報を取得
    const problem = await prisma.yosemonProblem.findUnique({
      where: { problemNumber },
      include: {
        answers: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }
    
    // SGFファイルを読み込み
    const sgfPath = path.join(process.cwd(), 'public', 'yosemon', 'problems', problemNumber.toString(), 'kifu.sgf');
    
    try {
      const sgfContent = await fs.readFile(sgfPath, 'utf-8');
      
      // 問題情報を返す（正解の順序は隠す）
      const shuffledAnswers = [...problem.answers].sort(() => Math.random() - 0.5);
      
      res.json({
        id: problem.id,
        problemNumber: problem.problemNumber,
        moves: problem.moves,
        sgf: sgfContent,
        answers: shuffledAnswers.map((answer, index) => ({
          label: String.fromCharCode(65 + index), // A, B, C, D...
          coordinate: answer.coordinate
        }))
      });
    } catch (error) {
      console.error('Error reading SGF file:', error);
      return res.status(500).json({ error: 'Failed to read problem file' });
    }
    
  } catch (error) {
    console.error('Error fetching problem:', error);
    res.status(500).json({ error: 'Failed to fetch problem' });
  }
});

// 回答送信API
router.post('/problems/:id/answer', authenticateUser, async (req: Request, res: Response) => {
  try {
    const problemNumber = parseInt(req.params.id);
    const userId = req.user?.id;
    const { userAnswer, shuffledAnswers } = req.body; // 例: userAnswer="A,C,B,D", shuffledAnswers=[{label:"A", coordinate:"K3"}, ...]
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!userAnswer || typeof userAnswer !== 'string' || !shuffledAnswers) {
      return res.status(400).json({ error: 'Invalid answer format' });
    }
    
    // 問題と正解を取得
    const problem = await prisma.yosemonProblem.findUnique({
      where: { problemNumber },
      include: {
        answers: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }
    
    // ユーザーの回答を配列に変換
    const userAnswerArray = userAnswer.split(',').map(s => s.trim());
    
    // shuffledAnswersのラベルと座標のマッピングを作成
    const labelToCoordinate: { [key: string]: string } = {};
    shuffledAnswers.forEach((ans: any) => {
      labelToCoordinate[ans.label] = ans.coordinate;
    });
    
    // 各答えのポイントを取得
    const coordinateToPoint: { [key: string]: number } = {};
    problem.answers.forEach(ans => {
      coordinateToPoint[ans.coordinate] = ans.point;
    });
    
    // shuffledAnswersの各ラベルに対応するポイントを取得し、ポイントの降順でソート
    const answersWithPoints = shuffledAnswers.map((ans: any) => ({
      label: ans.label,
      coordinate: ans.coordinate,
      point: coordinateToPoint[ans.coordinate] || 0
    }));
    
    // ポイントの降順でソートして正解の順序を決定
    const sortedByPoints = [...answersWithPoints].sort((a, b) => b.point - a.point);
    const correctOrder = sortedByPoints.map(ans => ans.label);
    
    // 正解判定
    const isCorrect = userAnswerArray.length === correctOrder.length &&
                     userAnswerArray.every((val, index) => val === correctOrder[index]);
    
    // 回答を保存
    const savedAnswer = await prisma.yosemonUserAnswer.create({
      data: {
        problemId: problem.id,
        userId,
        userAnswer,
        isCorrect
      }
    });
    
    // 正解情報を含めて返す（answersはポイント降順でソート済み）
    res.json({
      isCorrect,
      userAnswer: userAnswerArray,
      correctAnswer: correctOrder,
      answers: problem.answers
        .map(answer => ({
          coordinate: answer.coordinate,
          point: answer.point
        }))
        .sort((a, b) => b.point - a.point)
    });
    
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// ユーザーの回答履歴取得API
router.get('/problems/:id/user-answer', authenticateUser, async (req: Request, res: Response) => {
  try {
    const problemNumber = parseInt(req.params.id);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 問題情報を取得
    const problem = await prisma.yosemonProblem.findUnique({
      where: { problemNumber },
      include: {
        answers: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }
    
    // ユーザーの最新の回答を取得
    const userAnswer = await prisma.yosemonUserAnswer.findFirst({
      where: {
        problemId: problem.id,
        userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!userAnswer) {
      return res.status(404).json({ error: 'No answer found' });
    }
    
    // ユーザーの回答を配列に変換
    const userAnswerArray = userAnswer.userAnswer.split(',').map(s => s.trim());
    
    // 注意: 過去の回答を表示する際は、元のシャッフル順序が不明なため、
    // ポイントの降順での順序を表示
    // answersをポイントの降順でソート
    const sortedByPoint = [...problem.answers].sort((a, b) => b.point - a.point);
    
    // ポイントの降順での正解順序（仮のラベル付け）
    // 実際の正解順序は回答時のshuffledAnswersに依存するため、
    // ここでは参考値として表示
    const referenceOrder = sortedByPoint.map((_, index) => String.fromCharCode(65 + index));
    
    // Answer.tsxが期待する形式で返す（answersはポイント降順でソート済み）
    res.json({
      result: {
        isCorrect: userAnswer.isCorrect,
        userAnswer: userAnswerArray,
        correctAnswer: referenceOrder, // 参考値として提供
        answers: problem.answers
          .map(answer => ({
            coordinate: answer.coordinate,
            point: answer.point
          }))
          .sort((a, b) => b.point - a.point)
      }
    });
    
  } catch (error) {
    console.error('Error fetching user answer:', error);
    res.status(500).json({ error: 'Failed to fetch user answer' });
  }
});

// ランダム問題取得API
router.get('/problems/random/next', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // すべての問題を取得
    const problems = await prisma.yosemonProblem.findMany({
      select: { problemNumber: true, id: true }
    });
    
    if (problems.length === 0) {
      return res.status(404).json({ error: 'No problems available' });
    }
    
    // ユーザーが未回答の問題を優先
    if (userId) {
      const answeredProblemIds = await prisma.yosemonUserAnswer.findMany({
        where: { userId },
        select: { problemId: true },
        distinct: ['problemId']
      });
      
      const answeredIds = new Set(answeredProblemIds.map(a => a.problemId));
      const unansweredProblems = problems.filter(p => !answeredIds.has(p.id));
      
      // 未回答の問題がある場合はその中からランダムに選択
      if (unansweredProblems.length > 0) {
        const randomIndex = Math.floor(Math.random() * unansweredProblems.length);
        return res.json({ problemNumber: unansweredProblems[randomIndex].problemNumber });
      }
    }
    
    // すべて回答済みまたは未ログインの場合は全問題からランダムに選択
    const randomIndex = Math.floor(Math.random() * problems.length);
    res.json({ problemNumber: problems[randomIndex].problemNumber });
    
  } catch (error) {
    console.error('Error getting random problem:', error);
    res.status(500).json({ error: 'Failed to get random problem' });
  }
});

export default router;