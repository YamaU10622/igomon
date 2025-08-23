// server/utils/ogp-generator.ts
import { createCanvas } from 'canvas'
import fs from 'fs'
import path from 'path'
import { buildBoardFromSGF } from '../../lib/sgf-utils'

interface StonePosition {
  x: number
  y: number
  color: 'black' | 'white'
}

export class OGPGenerator {
  private readonly canvasWidth = 1200
  private readonly canvasHeight = 630
  private readonly boardSize = 600
  private readonly boardMargin = 30
  private readonly gridSize = 19
  private readonly cellSize: number

  constructor() {
    this.cellSize = (this.boardSize - 2 * this.boardMargin) / (this.gridSize - 1)
  }

  // 共通のOGP画像生成処理
  private async generateOGPImageBase(
    sgfContent: string,
    problemId: number,
    outputSubDir: string,
    logPrefix: string,
    maxMoves?: number,
  ): Promise<void> {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight)
    const ctx = canvas.getContext('2d') as any

    // 背景色を設定
    ctx.fillStyle = '#f5deb3' // 薄い木目色
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

    // 碁盤を中央に配置
    const boardX = (this.canvasWidth - this.boardSize) / 2
    const boardY = (this.canvasHeight - this.boardSize) / 2

    // 碁盤の背景
    ctx.fillStyle = '#dcb068'
    ctx.fillRect(boardX, boardY, this.boardSize, this.boardSize)

    // 碁盤の線を描画
    this.drawBoard(ctx, boardX, boardY)

    // SGFから石の配置を読み込んで描画
    const stones = this.parseSGF(sgfContent, maxMoves)
    this.drawStones(ctx, stones, boardX, boardY)

    // PNG画像として保存
    const rootDir =
      process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../../..') // dist/server/utils から ルートへ
        : path.join(__dirname, '../..') // server/utils から ルートへ
    const outputDir = path.join(rootDir, outputSubDir)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const outputPath = path.join(outputDir, `problem_${problemId}.png`)
    const buffer = canvas.toBuffer('image/png')
    fs.writeFileSync(outputPath, buffer)

    console.log(`${logPrefix}: ${outputPath}`)
  }

  async generateOGPImage(sgfContent: string, problemId: number, maxMoves?: number): Promise<void> {
    await this.generateOGPImageBase(
      sgfContent,
      problemId,
      'public/ogp',
      'OGP image generated',
      maxMoves,
    )
  }

  // よせもん問題用のOGP画像生成メソッド
  async generateYosemonOGPImage(
    sgfContent: string,
    problemNumber: number,
    maxMoves?: number,
  ): Promise<void> {
    await this.generateYosemonOGPImageBase(
      sgfContent,
      problemNumber,
      'public/ogp/yosemon',
      'Yosemon OGP image generated',
      maxMoves,
    )
  }

  private async generateYosemonOGPImageBase(
    sgfContent: string,
    problemId: number,
    outputSubDir: string,
    logPrefix: string,
    maxMoves?: number,
  ): Promise<void> {
    // よせもん用：300×300pxの画像サイズ
    const yosemonImageSize = 200
    const scaleFactor = yosemonImageSize / this.boardSize // 0.5

    const canvas = createCanvas(yosemonImageSize, yosemonImageSize)
    const ctx = canvas.getContext('2d') as any

    // スケーリングを適用
    ctx.scale(scaleFactor, scaleFactor)

    // 背景色を設定
    ctx.fillStyle = '#f5deb3' // 薄い木目色
    ctx.fillRect(0, 0, this.boardSize, this.boardSize)

    // 碁盤を左上に配置（余白なし）
    const boardX = 0
    const boardY = 0

    // 碁盤の背景（元の色を維持）
    ctx.fillStyle = '#dcb068'
    ctx.fillRect(boardX, boardY, this.boardSize, this.boardSize)

    // 碁盤の線を描画
    this.drawBoard(ctx, boardX, boardY)

    // SGFから石の配置を読み込んで描画
    const stones = this.parseSGF(sgfContent, maxMoves)
    this.drawStones(ctx, stones, boardX, boardY)

    // PNG画像として保存
    const rootDir =
      process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../../..') // dist/server/utils から ルートへ
        : path.join(__dirname, '../..') // server/utils から ルートへ
    const outputDir = path.join(rootDir, outputSubDir)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const outputPath = path.join(outputDir, `problem_${problemId}.png`)
    const buffer = canvas.toBuffer('image/png')
    fs.writeFileSync(outputPath, buffer)

    console.log(`${logPrefix}: ${outputPath}`)
  }

  private drawBoard(ctx: any, boardX: number, boardY: number): void {
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 1

    // 縦線と横線を描画
    for (let i = 0; i < this.gridSize; i++) {
      const x = boardX + this.boardMargin + i * this.cellSize
      const y = boardY + this.boardMargin + i * this.cellSize

      // 縦線
      ctx.beginPath()
      ctx.moveTo(x, boardY + this.boardMargin)
      ctx.lineTo(x, boardY + this.boardSize - this.boardMargin)
      ctx.stroke()

      // 横線
      ctx.beginPath()
      ctx.moveTo(boardX + this.boardMargin, y)
      ctx.lineTo(boardX + this.boardSize - this.boardMargin, y)
      ctx.stroke()
    }

    // 星を描画（9つの星）
    const starPositions = [
      [3, 3],
      [9, 3],
      [15, 3],
      [3, 9],
      [9, 9],
      [15, 9],
      [3, 15],
      [9, 15],
      [15, 15],
    ]

    ctx.fillStyle = '#000000'
    starPositions.forEach(([x, y]) => {
      const pixelX = boardX + this.boardMargin + x * this.cellSize
      const pixelY = boardY + this.boardMargin + y * this.cellSize
      ctx.beginPath()
      ctx.arc(pixelX, pixelY, 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  private drawStones(ctx: any, stones: StonePosition[], boardX: number, boardY: number): void {
    const stoneRadius = this.cellSize * 0.45

    stones.forEach((stone) => {
      const pixelX = boardX + this.boardMargin + stone.x * this.cellSize
      const pixelY = boardY + this.boardMargin + stone.y * this.cellSize

      // 石の影を描画
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 5
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2

      // 石を描画
      ctx.beginPath()
      ctx.arc(pixelX, pixelY, stoneRadius, 0, Math.PI * 2)

      if (stone.color === 'black') {
        ctx.fillStyle = '#000000'
      } else {
        ctx.fillStyle = '#ffffff'
      }
      ctx.fill()

      // 白石の場合は境界線を追加
      if (stone.color === 'white') {
        ctx.strokeStyle = '#cccccc'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // 影をリセット
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    })
  }

  private parseSGF(sgfContent: string, maxMoves?: number): StonePosition[] {
    const stones: StonePosition[] = []

    // SGFをパースして盤面を生成
    const board = buildBoardFromSGF(sgfContent, maxMoves)

    // 盤面の状態から石の位置を抽出
    for (let x = 0; x < 19; x++) {
      for (let y = 0; y < 19; y++) {
        if (board[x][y] !== 0) {
          stones.push({
            x,
            y,
            color: board[x][y] === 1 ? 'black' : 'white',
          })
        }
      }
    }

    return stones
  }
}

// 問題ディレクトリが追加されたときにOGP画像を生成する関数
export async function generateOGPForProblem(
  problemId: number,
  sgfContent: string,
  maxMoves?: number,
): Promise<void> {
  const generator = new OGPGenerator()
  await generator.generateOGPImage(sgfContent, problemId, maxMoves)
}

// よせもん問題用のOGP画像生成関数
export async function generateOGPForYosemonProblem(
  problemNumber: number,
  sgfContent: string,
  maxMoves?: number,
): Promise<void> {
  const generator = new OGPGenerator()
  await generator.generateYosemonOGPImage(sgfContent, problemNumber, maxMoves)
}
