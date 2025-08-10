import React, { useEffect, useRef, useState } from 'react';

// SGFパース関数を直接定義（GoBoard.tsxと同じ実装）
const parseSgfMoves = (sgfContent: string): Array<{ color: number; x: number; y: number }> => {
  const moves: Array<{ color: number; x: number; y: number }> = [];
  
  try {
    // 簡易的なSGFパーサー実装
    // パスや空の手を除外し、実際の手のみを取得
    const movePattern = /[BW]\[([a-s][a-s])\]/g;
    let match;
    
    while ((match = movePattern.exec(sgfContent)) !== null) {
      const color = match[0][0] === 'B' ? 1 : -1; // B=1 (黒), W=-1 (白)
      const coord = match[1];
      
      if (coord && coord.length === 2) {
        const x = coord.charCodeAt(0) - 'a'.charCodeAt(0);
        const y = coord.charCodeAt(1) - 'a'.charCodeAt(0);
        
        if (x >= 0 && x < 19 && y >= 0 && y < 19) {
          moves.push({ color, x, y });
        }
      }
    }
    
    console.log('Parsed moves:', moves.length, 'moves');
    console.log('First 5 moves:', moves.slice(0, 5));
  } catch (error) {
    console.error('SGFパースエラー:', error);
  }
  
  return moves;
};

declare global {
  interface Window {
    WGo: any;
  }
}

interface YosemonBoardProps {
  sgf: string;
  moves?: number;
  answers: Array<{
    label: string;
    coordinate: string;
  }>;
  size?: number;
}

const YosemonBoard: React.FC<YosemonBoardProps> = ({ sgf, moves, answers, size = 500 }) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const boardInstanceRef = useRef<any>(null);
  const [isWgoLoaded, setIsWgoLoaded] = useState(false);

  // WGo.jsの読み込み確認
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 50;

    const checkWgoLoaded = () => {
      if (typeof window !== 'undefined' && window.WGo) {
        setIsWgoLoaded(true);
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(checkWgoLoaded, 100);
        }
      }
    };

    checkWgoLoaded();
  }, []);

  // 盤面の初期化
  useEffect(() => {
    if (!isWgoLoaded || !boardRef.current) {
      return;
    }

    // 既存のボードをクリア
    if (boardRef.current) {
      boardRef.current.innerHTML = '';
    }

    try {
      // WGo.Boardを使用して盤面を作成
      const board = new window.WGo.Board(boardRef.current, {
        size: 19,
        width: size,
        height: size,
        font: 'Calibri',
        background: '/wgo/wood1.jpg',
        section: { top: -0.5, bottom: -0.5, left: -0.5, right: -0.5 },
      });

      // 座標表示用のカスタム描画ハンドラーを定義（GoBoardと同じスタイル）
      const coordinates = {
        grid: {
          draw: function (args: any, board: any) {
            const ctx = this;
            // テキスト描画のスタイル設定
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.font = board.stoneRadius + 'px ' + (board.font || '');

            // 盤外に文字を配置するための座標計算
            const xLeft = board.getX(board.size - 0.25);
            const xRight = board.getX(-0.75);
            const yTop = board.getY(-0.75);
            const yBottom = board.getY(board.size - 0.25);

            // 全ての交点に対応する座標ラベルを描画
            for (let i = 0; i < board.size; i++) {
              // 横方向の文字(A～T)を決定（'I'を飛ばす）
              let charCode = 'A'.charCodeAt(0) + i;
              if (charCode >= 'I'.charCodeAt(0)) charCode++;
              const letter = String.fromCharCode(charCode);

              // 縦座標（数字）ラベルを左端と右端に描画
              const y = board.getY(i);
              ctx.fillText(board.size - i, xLeft, y);
              ctx.fillText(board.size - i, xRight, y);

              // 横座標（英字）ラベルを上端と下端に描画
              const x = board.getX(i);
              ctx.fillText(letter, x, yTop);
              ctx.fillText(letter, x, yBottom);
            }
          },
        },
      };

      // 座標表示ハンドラーを追加
      board.addCustomObject(coordinates);

      

      // SGFから手順を解析して盤面に石を配置
      const parsedMoves = parseSgfMoves(sgf);
      const targetMoves = moves || parsedMoves.length;
      const actualMoves = Math.min(targetMoves, parsedMoves.length);
      
      console.log(`Displaying position after ${actualMoves} moves`);
      
      // 囲碁のルールを簡易的に実装して盤面状態を管理
      const boardState: number[][] = Array(19).fill(null).map(() => Array(19).fill(0));
      
      // 石を取る処理の簡易実装
      const removeCaptures = (x: number, y: number, color: number) => {
        const opponent = -color;
        const checkAndRemove = (cx: number, cy: number) => {
          if (cx < 0 || cx >= 19 || cy < 0 || cy >= 19) return;
          if (boardState[cx][cy] !== opponent) return;
          
          const group: Array<[number, number]> = [];
          const visited = new Set<string>();
          
          const hasLiberty = (px: number, py: number): boolean => {
            const key = `${px},${py}`;
            if (visited.has(key)) return false;
            visited.add(key);
            
            if (px < 0 || px >= 19 || py < 0 || py >= 19) return false;
            if (boardState[px][py] === 0) return true;
            if (boardState[px][py] !== opponent) return false;
            
            group.push([px, py]);
            
            return hasLiberty(px + 1, py) || hasLiberty(px - 1, py) ||
                   hasLiberty(px, py + 1) || hasLiberty(px, py - 1);
          };
          
          if (!hasLiberty(cx, cy)) {
            group.forEach(([gx, gy]) => {
              boardState[gx][gy] = 0;
            });
          }
        };
        
        checkAndRemove(x + 1, y);
        checkAndRemove(x - 1, y);
        checkAndRemove(x, y + 1);
        checkAndRemove(x, y - 1);
      };
      
      // 各手を盤面に適用
      for (let i = 0; i < actualMoves; i++) {
        const move = parsedMoves[i];
        if (move.color && move.x !== undefined && move.y !== undefined) {
          // 石を配置
          boardState[move.x][move.y] = move.color;
          // 取れる石を除去
          removeCaptures(move.x, move.y, move.color);
        }
      }
      
      // 最終局面を盤面に表示
      let lastMove = null;
      for (let x = 0; x < 19; x++) {
        for (let y = 0; y < 19; y++) {
          if (boardState[x][y] !== 0) {
            const wgoColor = boardState[x][y] === 1 ? window.WGo.B : window.WGo.W;
            board.addObject({
              x: x,
              y: y,
              c: wgoColor
            });
          }
        }
      }

      // 最終手を記録
      if (actualMoves > 0) {
        const lastMoveData = parsedMoves[actualMoves - 1];
        if (lastMoveData.x !== undefined && lastMoveData.y !== undefined) {
          lastMove = {
            x: lastMoveData.x,
            y: lastMoveData.y,
            color: lastMoveData.color === 1 ? window.WGo.B : window.WGo.W
          };
        }
      }

      // 最終手にマークを表示
      if (lastMove && lastMove.x >= 0 && lastMove.y >= 0) {
        // カスタムマーカーハンドラーを定義
        const lastMoveMarkerHandler = {
          stone: {
            draw: function (args: any, board: any) {
              const ctx = board.stone.getContext(args.x, args.y)
              const xr = board.getX(args.x)
              const yr = board.getY(args.y)
              const sr = board.stoneRadius

              // 石の色に応じて円の色を決定（白石には黒丸、黒石には白丸）
              const markerColor = lastMove.color === window.WGo.B ? '#FFFFFF' : '#000000'

              // 円を描画
              ctx.beginPath()
              ctx.arc(xr, yr, sr * 0.5, 0, 2 * Math.PI, true)
              ctx.lineWidth = 3
              ctx.strokeStyle = markerColor
              ctx.stroke()
            },
          },
        }

        board.addObject({
          x: lastMove.x,
          y: lastMove.y,
          type: lastMoveMarkerHandler,
        })
      }

      // 選択肢のマーカーを追加（カスタムスタイル）
      const getLabelColor = (label: string): string => {
        switch(label) {
          case 'A': return '#dc2626'; // 赤
          case 'B': return '#2563eb'; // 青
          case 'C': return '#16a34a'; // 緑
          case 'D': return '#9333ea'; // 紫
          default: return '#15803d'; // デフォルト：濃い緑
        }
      };

      const labelHandler = {
        stone: {
          draw: function(args: any, board: any) {
            const ctx = board.stone.getContext(args.x, args.y);
            const xr = board.getX(args.x);
            const yr = board.getY(args.y);
            const sr = board.stoneRadius;
            
            const labelColor = getLabelColor(args.text);
            
            // テキストを描画（各ラベルの色、太字）
            ctx.font = `bold ${sr * 1.8}px Calibri`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = labelColor;  // 各ラベルの色
            ctx.fillText(args.text, xr, yr);
          }
        }
      };

      answers.forEach((answer) => {
        const coords = parseCoordinate(answer.coordinate);
        if (coords) {
          board.addObject({
            type: labelHandler,
            x: coords.x,
            y: coords.y,
            text: answer.label
          });
        }
      });

      boardInstanceRef.current = board;
      
    } catch (error) {
      console.error('Error initializing board:', error);
    }

    return () => {
      if (boardRef.current) {
        boardRef.current.innerHTML = '';
      }
    };
  }, [isWgoLoaded, sgf, moves, answers, size]);

  // 座標文字列をWGoの座標に変換
  const parseCoordinate = (coord: string): { x: number; y: number } | null => {
    const match = coord.match(/^([A-S])(\d{1,2})$/);
    if (!match) {
      return null;
    }

    const col = match[1];
    const row = parseInt(match[2]);

    // A-S (Iを除く) を数値に変換
    const colMap: { [key: string]: number } = {
      'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4,
      'F': 5, 'G': 6, 'H': 7, 'J': 8, 'K': 9,
      'L': 10, 'M': 11, 'N': 12, 'O': 13, 'P': 14,
      'Q': 15, 'R': 16, 'S': 17, 'T': 18
    };

    const x = colMap[col];
    const y = 19 - row; // WGoは上から0始まり

    if (x === undefined || y < 0 || y >= 19) {
      return null;
    }

    return { x, y };
  };

  return (
    <div 
      ref={boardRef} 
      style={{ 
        width: size, 
        height: size,
        margin: '0 auto',
        position: 'relative'
      }}
    />
  );
};

export default YosemonBoard;