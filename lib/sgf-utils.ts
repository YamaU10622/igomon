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
        keepMainLine(node.children[0])       // 先頭枝を辿る
        node.children = [node.children[0]]   // 先頭以外を削除
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