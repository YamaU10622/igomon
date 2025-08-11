import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SelectionJson {
  moves?: number;
  answers: Array<{
    coordinate: string;
    point: number;
  }>;
}

// 座標の検証（19路盤）
function isValidCoordinate(coordinate: string): boolean {
  const match = coordinate.match(/^([A-S])(\d{1,2})$/);
  if (!match) return false;
  
  const col = match[1];
  const row = parseInt(match[2]);
  
  // A-S (I を除く) で 1-19 の範囲
  const validCols = 'ABCDEFGHJKLMNOPQRS'; // I を除く
  return validCols.includes(col) && row >= 1 && row <= 19;
}

// selection.jsonの検証
function validateSelectionJson(data: any): data is SelectionJson {
  if (!data || typeof data !== 'object') return false;
  
  // answersが配列で、2〜26個の要素を持つこと（最大でA-Zまで対応）
  if (!Array.isArray(data.answers) || data.answers.length < 2 || data.answers.length > 26) {
    return false;
  }
  
  // 各answerが正しい形式であること
  for (const answer of data.answers) {
    if (!answer.coordinate || typeof answer.coordinate !== 'string') return false;
    if (typeof answer.point !== 'number') return false;
    if (!isValidCoordinate(answer.coordinate)) {
      console.error(`Invalid coordinate: ${answer.coordinate}`);
      return false;
    }
  }
  
  // movesがある場合は数値であること
  if (data.moves !== undefined && typeof data.moves !== 'number') {
    return false;
  }
  
  return true;
}

// 問題ディレクトリをスキャンして問題をロード
export async function loadYosemonProblems() {
  const problemsDir = path.join(process.cwd(), 'public', 'yosemon', 'problems');
  
  try {
    // ディレクトリが存在しない場合は作成
    await fs.mkdir(problemsDir, { recursive: true });
    
    // ディレクトリ内のサブディレクトリを取得
    const entries = await fs.readdir(problemsDir, { withFileTypes: true });
    const problemDirs = entries
      .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map(entry => ({
        name: entry.name,
        number: parseInt(entry.name)
      }))
      .sort((a, b) => a.number - b.number);
    
    console.log(`Found ${problemDirs.length} problem directories`);
    
    for (const dir of problemDirs) {
      const problemPath = path.join(problemsDir, dir.name);
      const sgfPath = path.join(problemPath, 'kifu.sgf');
      const selectionPath = path.join(problemPath, 'selection.json');
      
      try {
        // ファイルの存在確認
        await fs.access(sgfPath);
        await fs.access(selectionPath);
        
        // selection.jsonを読み込み
        const selectionContent = await fs.readFile(selectionPath, 'utf-8');
        const selectionData = JSON.parse(selectionContent);
        
        // バリデーション
        if (!validateSelectionJson(selectionData)) {
          console.error(`Invalid selection.json in problem ${dir.number}`);
          continue;
        }
        
        // データベースに問題を登録または更新
        const problem = await prisma.yosemonProblem.upsert({
          where: { problemNumber: dir.number },
          update: {
            moves: selectionData.moves || null,
            updatedAt: new Date()
          },
          create: {
            problemNumber: dir.number,
            moves: selectionData.moves || null
          }
        });
        
        // 既存の答えを削除
        await prisma.yosemonAnswer.deleteMany({
          where: { problemId: problem.id }
        });
        
        // 新しい答えを登録
        for (let i = 0; i < selectionData.answers.length; i++) {
          const answer = selectionData.answers[i];
          await prisma.yosemonAnswer.create({
            data: {
              problemId: problem.id,
              coordinate: answer.coordinate,
              point: answer.point,
              orderIndex: i // 配列の順序が正解順序
            }
          });
        }
        
        console.log(`Loaded problem ${dir.number}`);
        
      } catch (error) {
        console.error(`Error loading problem ${dir.number}:`, error);
      }
    }
    
    console.log('Yosemon problems loading completed');
    
  } catch (error) {
    console.error('Error loading yosemon problems:', error);
  }
}

// サーバー起動時に問題をロード
export async function initializeYosemonProblems() {
  console.log('Initializing Yosemon problems...');
  await loadYosemonProblems();
}