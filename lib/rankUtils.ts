// 棋力の定義と変換ユーティリティ

// 棋力の順序定義（20級から九段まで）
export const RANKS = [
  '20級', '19級', '18級', '17級', '16級', '15級', '14級', '13級', '12級', '11級',
  '10級', '9級', '8級', '7級', '6級', '5級', '4級', '3級', '2級', '1級',
  '初段', '二段', '三段', '四段', '五段', '六段', '七段', '八段', '九段'
] as const;

export type Rank = typeof RANKS[number];

// 棋力を数値に変換する関数（20級=0, 九段=28）
export function rankToNumber(rank: string): number {
  const index = RANKS.indexOf(rank as Rank);
  return index === -1 ? -1 : index;
}

// 数値を棋力に変換する関数
export function numberToRank(num: number): string {
  if (num < 0 || num >= RANKS.length) {
    return '';
  }
  return RANKS[num];
}

// 棋力文字列を正規化する関数（全角数字対応など）
export function normalizeRank(rankStr: string): string {
  // 全角数字を半角に変換
  let normalized = rankStr.replace(/[０-９]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
  
  // 漢数字の段位を標準形式に変換
  const danjiMap: { [key: string]: string } = {
    '1段': '初段', '一段': '初段',
    '2段': '二段', '二段': '二段',
    '3段': '三段', '三段': '三段',
    '4段': '四段', '四段': '四段',
    '5段': '五段', '五段': '五段',
    '6段': '六段', '六段': '六段',
    '7段': '七段', '七段': '七段',
    '8段': '八段', '八段': '八段',
    '9段': '九段', '九段': '九段'
  };
  
  for (const [key, value] of Object.entries(danjiMap)) {
    if (normalized.includes(key)) {
      normalized = normalized.replace(key, value);
    }
  }
  
  return normalized;
}

// 棋力が有効かどうかをチェックする関数
export function isValidRank(rank: string): boolean {
  const normalized = normalizeRank(rank);
  return RANKS.includes(normalized as Rank);
}

// 棋力の範囲内かどうかをチェックする関数
export function isRankInRange(rank: string, minRankNum: number, maxRankNum: number): boolean {
  const normalized = normalizeRank(rank);
  const rankNum = rankToNumber(normalized);
  
  if (rankNum === -1) {
    return false; // 無効な棋力は範囲外とする
  }
  
  return rankNum >= minRankNum && rankNum <= maxRankNum;
}