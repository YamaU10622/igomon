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
    const { userAnswer } = req.body; // 例: "A,C,B,D"
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!userAnswer || typeof userAnswer !== 'string') {
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
    
    // 正解の順序を取得（アルファベット順）
    const correctOrder = problem.answers
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((_, index) => String.fromCharCode(65 + index));
    
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
    
    // 正解情報を含めて返す
    res.json({
      isCorrect,
      userAnswer: userAnswerArray,
      correctAnswer: correctOrder,
      answers: problem.answers.map(answer => ({
        coordinate: answer.coordinate,
        point: answer.point
      }))
    });
    
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
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