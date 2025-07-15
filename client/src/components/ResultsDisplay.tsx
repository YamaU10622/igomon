// client/src/components/ResultsDisplay.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteAnswer } from '../utils/api'
import { RangeSlider } from './RangeSlider'

interface Answer {
  id: number
  coordinate: string
  reason: string
  playerName: string
  playerRank: string
  createdAt: string
  canDelete?: boolean
}

interface ResultsDisplayProps {
  results: Record<string, { votes: number; answers: Answer[] }>
  onDelete: () => void
  isFiltered?: boolean
  minRank: number
  maxRank: number
  onRangeChange: (min: number, max: number) => void
}

export function ResultsDisplay({
  results,
  onDelete,
  isFiltered = false,
  minRank,
  maxRank,
  onRangeChange,
}: ResultsDisplayProps) {
  const [selectedCoordinate, setSelectedCoordinate] = useState<string | null>(null)
  const [selectedSgfCoordinate, setSelectedSgfCoordinate] = useState<string | null>(null)
  const navigate = useNavigate()
  const { problemId } = useParams<{ problemId: string }>()
  const answersListRef = useRef(null);

  // 表示座標からSGF座標に変換する関数
  const displayToSgfCoordinate = (displayCoord: string): string => {
    if (!displayCoord || displayCoord.length < 2) return ''

    const letter = displayCoord[0]
    const number = parseInt(displayCoord.substring(1))

    // 文字をインデックスに変換（I抜き）
    const letters = 'ABCDEFGHJKLMNOPQRST'
    const x = letters.indexOf(letter)
    if (x === -1) return ''

    // 数字をSGF座標に変換（19から引く）
    const y = 19 - number

    return String.fromCharCode('a'.charCodeAt(0) + x) + String.fromCharCode('a'.charCodeAt(0) + y)
  }

  useEffect(() => {
    // 碁盤からの詳細表示イベントをリッスン
    const handleShowDetails = (event: CustomEvent) => {
      const { coordinate, data } = event.detail
      setSelectedCoordinate(coordinate)
      // SGF座標も保存
      const sgfCoord = displayToSgfCoordinate(coordinate)
      setSelectedSgfCoordinate(sgfCoord)
    }

    window.addEventListener('showAnswerDetails', handleShowDetails as EventListener)

    return () => {
      window.removeEventListener('showAnswerDetails', handleShowDetails as EventListener)
    }
  }, [])

  const handleDelete = async (answerId: number) => {
    if (!confirm('この回答を削除しますか？')) return

    try {
      await deleteAnswer(answerId)
      // 削除成功後、回答ページへ遷移
      navigate(`/questionnaire/${problemId}`)
    } catch (err) {
      console.error('削除に失敗しました:', err)
      alert('削除に失敗しました')
    }
  }

  // 総回答数を計算
  const totalVotes = Object.values(results).reduce((sum, { votes }) => sum + votes, 0)

  // 選択中の座標の回答を取得（フィルタリング後のデータから自動的に取得）
  const selectedAnswers =
    selectedSgfCoordinate && results[selectedSgfCoordinate]
      ? results[selectedSgfCoordinate].answers
      : []

  useEffect(() => {
    // 回答欄のスクロールを一番上に戻す
    if (answersListRef.current && answersListRef.current.scrollTop > 0) {
      answersListRef.current.scroll({top: 0, behavior: 'smooth'})
    }
  }, [selectedAnswers])

  return (
    <div className="results-display">
      <div className="results-summary">
        <h3>回答集計</h3>
        <p>
          {isFiltered ? 'フィルター適用後の回答数' : '総回答数'}: {totalVotes}票
        </p>
        <RangeSlider minValue={minRank} maxValue={maxRank} onRangeChange={onRangeChange} />
      </div>

      {selectedCoordinate && selectedAnswers.length > 0 && (
        <div className="answer-details">
          <h3 className="coordinate-header">{selectedCoordinate}</h3>
          <div className="answers-list" ref={answersListRef}>
            {selectedAnswers.map((answer) => (
              <div key={answer.id} className="answer-item">
                <div className="answer-meta">
                  <div className="player-info">
                    <span className="player-name">名前：{answer.playerName}</span>
                    <span className="player-rank">段位：{answer.playerRank}</span>
                  </div>
                  <div className="answer-actions">
                    {answer.canDelete && (
                      <button className="delete-button" onClick={() => handleDelete(answer.id)}>
                        削除
                      </button>
                    )}
                  </div>
                </div>
                <div className="answer-content">
                  <p className="answer-reason">{answer.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedCoordinate && (
        <div className="help-text">
          <p>盤面上の数字をクリックすると、その座標の回答詳細が表示されます</p>
        </div>
      )}
    </div>
  )
}
