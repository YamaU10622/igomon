// server/utils/problem-loader.ts
import fs from 'fs'
import path from 'path'

interface ProblemData {
  id: number
  turn: string
  description: string
  sgfContent: string
  moves?: number
}

export function loadProblemFromDirectory(problemId: string): ProblemData | null {
  const rootDir =
    process.env.NODE_ENV === 'production'
      ? path.join(__dirname, '../../..') // dist/server/utils から ルートへ
      : path.join(__dirname, '../..') // server/utils から ルートへ
  const problemDir = path.join(rootDir, 'public/problems', problemId)

  try {
    // description.txt の読み込み
    const descriptionPath = path.join(problemDir, 'description.txt')
    const descriptionContent = fs.readFileSync(descriptionPath, 'utf-8')

    // SGFファイルの読み込み
    const sgfPath = path.join(problemDir, 'kifu.sgf')
    const sgfContent = fs.readFileSync(sgfPath, 'utf-8')

    // description.txt のパース
    const parsedProblemData = parseDescriptionFile(descriptionContent)

    // 手番を推定
    // description.txt に手番の記載があればそれを優先する。
    // 記載がなければ moves の偶奇で手番を推定し、
    // moves もない場合は最終手をsgfファイルから推定する。
    let turn = parsedProblemData.turn
    if (!turn) {
      if (parsedProblemData.moves !== undefined) {
	turn = parsedProblemData.moves % 2 === 1 ? 'white' : 'black'
      }
      else {
	turn = getNextTurn(sgfContent)
      }
    }

    return {
      id: parseInt(problemId),
      turn,
      description: parsedProblemData.description,
      moves: parsedProblemData.moves,
      sgfContent,
    }
  } catch (error) {
    console.error(`Failed to load problem ${problemId}:`, error)
    return null
  }
}

interface ParsedProblemData {
  turn?: string
  description: string
  moves?: number
}

function parseDescriptionFile(content: string): ParsedProblemData {
  const lines = content.trim().split('\n')
  const data: any = {}

  lines.forEach((line) => {
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length > 0) {
      data[key.trim()] = valueParts.join(':').trim()
    }
  })

  // 必須項目のチェック（新フォーマット）
  if (!data.description) {
    throw new Error('必須項目が不足しています: turn, description')
  }

  return {
    turn: data.turn,
    description: data.description,
    moves: data.moves ? parseInt(data.moves) : undefined,
  }
}

function getNextTurn(sgfString: string): string {
  // メインのゲーム木のみ利用
  const sgfMainBranch = extractMainRoute(sgfString)
  const sgfElements = sgfMainBranch.split(";")
  
  // 最終手を取得
  const sgfLastElements = sgfElements[sgfElements.length - 1]

  // W[..] であって AW[..] でないものとの正規表現マッチ
  const regexWhite = /(?<!A)W\[[a-s]{2}\]/;
  const regexBlack = /(?<!A)B\[[a-s]{2}\]/;
  if (regexWhite.test(sgfLastElements)) return "black"
  else if (regexBlack.test(sgfLastElements)) return "white"
  
  // 上記の正規表現マッチに失敗したときは黒番で返す
  else return "black"
}

// SGFからメインルートを取得
// コメント内の `)` は無視し、分岐を生成する `)` 以前を取得する
function extractMainRoute(sgfContent: string): string {
  let inValue = false   // '[' ～ ']' 内に居るか
  let escape  = false   // 直前が '\' かどうか
  let result  = ''

  for (const ch of sgfContent) {
    if (inValue) { // [ ] プロパティの内部
      result += ch
      if (escape) {
        escape = false
      }
      else if (ch === '\\') escape = true   // 次の 1 文字をエスケープ
      else if (ch === ']')  inValue = false // プロパティ終了
      continue
    }

    // プロパティ値の外
    if (ch === '[') {
      inValue = true
      result += ch
      continue
    }

    if (ch === ')') {
      // これ以降は分岐なので捨てる
      break
    }
    result += ch
  }
  return result
}
