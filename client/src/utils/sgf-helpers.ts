// SGFから手番を判定する関数
export function getCurrentTurnFromSGF(sgf: string, moveNumber?: number): 'black' | 'white' {
  try {
    // 簡易的なSGFパーサー実装
    const movePattern = /[BW]\[([a-s][a-s]|tt)?\]/g;
    const moves: string[] = [];
    let match;
    
    while ((match = movePattern.exec(sgf)) !== null) {
      moves.push(match[0][0]); // 'B' or 'W'
    }
    
    // moveNumberが指定されている場合はその手数まで、そうでない場合は全ての手を考慮
    const targetMoveCount = moveNumber !== undefined ? Math.min(moveNumber, moves.length) : moves.length;
    
    // 最後の手の色を確認
    if (targetMoveCount > 0) {
      const lastMoveColor = moves[targetMoveCount - 1];
      // 最後に打った方と反対の手番
      return lastMoveColor === 'B' ? 'white' : 'black';
    }
    
    // 手がない場合は黒番から始まる
    return 'black';
  } catch (error) {
    console.error('Error parsing SGF for turn:', error);
    return 'black'; // デフォルトは黒番
  }
}