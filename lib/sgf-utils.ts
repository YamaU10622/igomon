// shared/utils/sgf-utils.ts
import * as sgf from '@sabaki/sgf'

/**
 * SGFからメインルートを抽出する
 * 分岐を削除し、メインラインのみを残したSGF文字列を返す
 */
export function extractMainRoute(sgfContent: string): string {
  try {
    // 1. SGF文字列をパース
    const roots = sgf.parse(sgfContent)

    // 2. メインラインだけ残す再帰関数
    function keepMainLine(node: any): void {
      if (node.children && node.children.length > 0) {
        keepMainLine(node.children[0]) // 先頭枝を辿る
        node.children = [node.children[0]] // 先頭以外を削除
      }
    }

    // すべてのルートに対して剪定
    for (const root of roots) {
      keepMainLine(root)
    }

    // 3. SGFに戻す（改行・インデントなしで）
    return sgf.stringify(roots, { linebreak: '', indent: '' })
  } catch (error) {
    console.error('SGFパースエラー:', error)
    // パースに失敗した場合は元の文字列を返す
    return sgfContent
  }
}

/**
 * SGF座標を数値座標に変換
 * @param sgfCoord SGF座標（例: "pd"）
 * @returns {x, y} 数値座標（0-18）
 */
export function sgfToNumericCoords(sgfCoord: string): { x: number; y: number } {
  if (!sgfCoord || sgfCoord.length !== 2) return { x: -1, y: -1 }

  const x = sgfCoord.charCodeAt(0) - 'a'.charCodeAt(0)
  const y = sgfCoord.charCodeAt(1) - 'a'.charCodeAt(0)

  return { x, y }
}

/**
 * 数値座標をSGF座標に変換
 * @param x X座標（0-18）
 * @param y Y座標（0-18）
 * @returns SGF座標（例: "pd"）
 */
export function numericToSgfCoords(x: number, y: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + x) + String.fromCharCode('a'.charCodeAt(0) + y)
}

/**
 * SGFから手順（moves）を抽出する
 * @param sgfContent SGF文字列
 * @returns 手順の配列 {color, x, y}
 */
export function parseSgfMoves(sgfContent: string): Array<{ color: number; x: number; y: number }> {
  const moves: Array<{ color: number; x: number; y: number }> = []

  try {
    // メインのゲーム木を取得
    const sgfMainBranch = extractMainRoute(sgfContent)

    // @sabaki/sgfでパース
    const roots = sgf.parse(sgfMainBranch)
    if (!roots || roots.length === 0) return moves

    // メインラインの手順を取得
    let currentNode = roots[0]
    while (currentNode) {
      if (currentNode.data) {
        // 黒番の手
        if (currentNode.data.B && currentNode.data.B[0]) {
          const coords = sgfToNumericCoords(currentNode.data.B[0])
          if (coords.x >= 0 && coords.y >= 0) {
            moves.push({ color: 1, x: coords.x, y: coords.y }) // 1 = 黒
          }
        }
        // 白番の手
        if (currentNode.data.W && currentNode.data.W[0]) {
          const coords = sgfToNumericCoords(currentNode.data.W[0])
          if (coords.x >= 0 && coords.y >= 0) {
            moves.push({ color: -1, x: coords.x, y: coords.y }) // -1 = 白
          }
        }
      }

      // 次のノードへ（メインラインのみ）
      if (currentNode.children && currentNode.children.length > 0) {
        currentNode = currentNode.children[0]
      } else {
        break
      }
    }
  } catch (error) {
    console.error('SGFパースエラー:', error)
  }

  return moves
}

/**
 * SGF文字列から次の手番を判定する
 * @param sgfString SGF文字列
 * @returns 次の手番 ("black" または "white")
 */
export function getNextTurn(sgfString: string): string {
  // メインのゲーム木のみ利用
  const sgfMainBranch = extractMainRoute(sgfString)

  try {
    // @sabaki/sgfでパース
    const roots = sgf.parse(sgfMainBranch)
    if (!roots || roots.length === 0) return 'black'

    // メインラインの最終ノードまで辿る
    let currentNode = roots[0]
    while (currentNode.children && currentNode.children.length > 0) {
      currentNode = currentNode.children[0]
    }

    // 最終ノードのプロパティをチェック
    if (currentNode.data) {
      // W[..] プロパティがあれば次は黒番
      if (currentNode.data.W) return 'black'
      // B[..] プロパティがあれば次は白番
      if (currentNode.data.B) return 'white'
    }

    // 見つからない場合は黒番を返す
    return 'black'
  } catch (error) {
    console.error('SGFパースエラー:', error)
    return 'black'
  }
}
