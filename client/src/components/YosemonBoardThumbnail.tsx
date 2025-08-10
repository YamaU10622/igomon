import React, { useEffect, useRef } from 'react'

interface YosemonBoardThumbnailProps {
  sgf: string
  moves?: number
  size?: number
}

const YosemonBoardThumbnail: React.FC<YosemonBoardThumbnailProps> = ({ sgf, moves, size = 360 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !sgf) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // デバイスピクセル比を取得（Retina対応）
    const dpr = window.devicePixelRatio || 1

    // キャンバスサイズを設定（高解像度対応）
    canvas.width = size * dpr
    canvas.height = size * dpr

    // CSSサイズを設定
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    // コンテキストをスケール
    ctx.scale(dpr, dpr)

    // 背景色を設定（薄いベージュ）
    ctx.fillStyle = '#f5deb3'
    ctx.fillRect(0, 0, size, size)

    // 碁盤の配置計算
    const boardMargin = size * 0.04 // 外側の余白（ベージュ部分）
    const boardSize = size - boardMargin * 2
    const gridMargin = boardSize * 0.06 // 碁盤内の線の余白（木の部分から線まで）を広く
    const gridSize = 19
    const gridArea = boardSize - gridMargin * 2
    const cellSize = gridArea / (gridSize - 1)

    // 碁盤の背景を描画
    ctx.fillStyle = '#dcb068'
    ctx.fillRect(boardMargin, boardMargin, boardSize, boardSize)

    // 碁盤の線を描画
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = Math.max(0.5, size / 400)

    const lineStart = boardMargin + gridMargin
    const lineEnd = boardMargin + boardSize - gridMargin

    for (let i = 0; i < gridSize; i++) {
      const pos = lineStart + i * cellSize

      // 横線
      ctx.beginPath()
      ctx.moveTo(lineStart, pos)
      ctx.lineTo(lineEnd, pos)
      ctx.stroke()

      // 縦線
      ctx.beginPath()
      ctx.moveTo(pos, lineStart)
      ctx.lineTo(pos, lineEnd)
      ctx.stroke()
    }

    // 星を描画
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
      const pixelX = lineStart + x * cellSize
      const pixelY = lineStart + y * cellSize
      ctx.beginPath()
      ctx.arc(pixelX, pixelY, cellSize * 0.08, 0, Math.PI * 2)
      ctx.fill()
    })

    // SGFから石を解析して描画
    try {
      const board: (number | null)[][] = Array(19)
        .fill(null)
        .map(() => Array(19).fill(null))

      // 初期配置の黒石 (AB)
      const blackSetupPattern = /AB(\[[a-s]{2}\])+/g
      let match
      while ((match = blackSetupPattern.exec(sgf)) !== null) {
        const coords = match[0].match(/\[([a-s]{2})\]/g)
        if (coords) {
          coords.forEach((coord) => {
            const pos = coord.match(/\[([a-s]{2})\]/)
            if (pos && pos[1]) {
              const x = pos[1].charCodeAt(0) - 'a'.charCodeAt(0)
              const y = pos[1].charCodeAt(1) - 'a'.charCodeAt(0)
              if (x >= 0 && x < 19 && y >= 0 && y < 19) {
                board[x][y] = 1 // 黒石
              }
            }
          })
        }
      }

      // 初期配置の白石 (AW)
      const whiteSetupPattern = /AW(\[[a-s]{2}\])+/g
      while ((match = whiteSetupPattern.exec(sgf)) !== null) {
        const coords = match[0].match(/\[([a-s]{2})\]/g)
        if (coords) {
          coords.forEach((coord) => {
            const pos = coord.match(/\[([a-s]{2})\]/)
            if (pos && pos[1]) {
              const x = pos[1].charCodeAt(0) - 'a'.charCodeAt(0)
              const y = pos[1].charCodeAt(1) - 'a'.charCodeAt(0)
              if (x >= 0 && x < 19 && y >= 0 && y < 19) {
                board[x][y] = -1 // 白石
              }
            }
          })
        }
      }

      // 着手を適用
      const movePattern = /;[BW]\[([a-s]{2})\]/g
      const movesList: { color: number; x: number; y: number }[] = []
      while ((match = movePattern.exec(sgf)) !== null) {
        const color = match[0][1] === 'B' ? 1 : -1
        const coord = match[1]
        if (coord && coord !== 'tt') {
          const x = coord.charCodeAt(0) - 'a'.charCodeAt(0)
          const y = coord.charCodeAt(1) - 'a'.charCodeAt(0)
          if (x >= 0 && x < 19 && y >= 0 && y < 19) {
            movesList.push({ color, x, y })
          }
        }
      }

      // 着手を順番に適用（movesパラメータで指定された手数まで）
      const movesToApply = moves !== undefined ? movesList.slice(0, moves) : movesList;
      movesToApply.forEach((move) => {
        board[move.x][move.y] = move.color
      })

      // 石を描画
      const stoneRadius = cellSize * 0.45

      for (let x = 0; x < 19; x++) {
        for (let y = 0; y < 19; y++) {
          if (board[x][y] !== null) {
            const pixelX = lineStart + x * cellSize
            const pixelY = lineStart + y * cellSize

            // 石の影を描画
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
            ctx.shadowBlur = cellSize * 0.1
            ctx.shadowOffsetX = cellSize * 0.04
            ctx.shadowOffsetY = cellSize * 0.04

            // 石を描画
            ctx.beginPath()
            ctx.arc(pixelX, pixelY, stoneRadius, 0, Math.PI * 2)

            if (board[x][y] === 1) {
              // 黒石
              ctx.fillStyle = '#000000'
              ctx.fill()
            } else {
              // 白石
              ctx.fillStyle = '#ffffff'
              ctx.fill()

              // 白石の境界線
              ctx.strokeStyle = '#cccccc'
              ctx.lineWidth = Math.max(0.5, size / 600)
              ctx.stroke()
            }

            // 影をリセット
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 0
          }
        }
      }
    } catch (error) {
      console.error('Error parsing SGF:', error)
    }
  }, [sgf, moves, size])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
      }}
    />
  )
}

export default YosemonBoardThumbnail
