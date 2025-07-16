// client/src/components/ResultsDisplay.tsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteAnswer } from '../utils/api'
import { rankToNumber, normalizeRank } from '../utils/rankUtils'
import { RangeSlider } from './RangeSlider'
import '../styles/SortToggleGroup.css'

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

type SortOrder = 'asc' | 'desc'

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
  const [rankSortOrder, setRankSortOrder] = useState<SortOrder | null>(null)
  const [postSortOrder, setPostSortOrder] = useState<SortOrder | null>('asc') // 初期状態では投稿順にソートされている
  const navigate = useNavigate()
  const { problemId } = useParams<{ problemId: string }>()
  const answersListRef = useRef(null)

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

  const toggleRankSort = () => {
    setRankSortOrder((prev) => {
      if (prev === null) return 'desc' // 非ソートからソート状態への遷移
      if (prev === 'desc') return 'asc'
      return 'desc'
    })
    setPostSortOrder(null)
  }

  const togglePostSort = () => {
    setPostSortOrder((prev) => {
      if (prev === null) return 'desc' // 非ソートからソート状態への遷移
      if (prev === 'desc') return 'asc'
      return 'desc'
    })
    setRankSortOrder(null)
  }

  // 総回答数を計算
  const totalVotes = Object.values(results).reduce((sum, { votes }) => sum + votes, 0)

  // 選択中の座標の回答を取得（フィルタリング後のデータから自動的に取得）
  const selectedAnswers =
    selectedSgfCoordinate && results[selectedSgfCoordinate]
      ? results[selectedSgfCoordinate].answers
      : []

  // ソートされた回答を取得
  const sortedAnswers = useMemo(() => {
    const arr = [...selectedAnswers] // 元配列を破壊しない

    // 投稿順ソート
    if (postSortOrder) {
      arr.sort((a, b) => {
        const t1 = new Date(a.createdAt).getTime()
        const t2 = new Date(b.createdAt).getTime()
        return postSortOrder === 'asc' ? t1 - t2 : t2 - t1
      })
      return arr
    }

    // 段位順ソート
    if (rankSortOrder) {
      arr.sort((a, b) => {
        const v1 = rankToNumber(normalizeRank(a.playerRank))
        const v2 = rankToNumber(normalizeRank(b.playerRank))

        // rankToNumber が -1（未知の段級位）の場合は配列末尾に回す
        const safeV1 = v1 === -1 ? Number.MAX_SAFE_INTEGER : v1
        const safeV2 = v2 === -1 ? Number.MAX_SAFE_INTEGER : v2

        return rankSortOrder === 'asc' ? safeV1 - safeV2 : safeV2 - safeV1
      })
      return arr
    }

    // ソート無し
    return arr
  }, [selectedAnswers, postSortOrder, rankSortOrder])

  useEffect(() => {
    // 回答欄のスクロールを一番上に戻す
    if (answersListRef.current && answersListRef.current.scrollTop > 0) {
      answersListRef.current.scroll({ top: 0, behavior: 'smooth' })
    }
  }, [sortedAnswers])

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
          <div className="sort-toggle-group">
            <button className="sort-btn" onClick={togglePostSort}>
              投稿順
              <span className="arrow">
                {postSortOrder === 'desc' ? '↑' : postSortOrder === 'asc' ? '↓' : '\u00A0'}
              </span>
            </button>
            <span className="separator" />
            <button className="sort-btn" onClick={toggleRankSort}>
              棋力順
              <span className="arrow">
                {rankSortOrder === 'desc' ? '↑' : rankSortOrder === 'asc' ? '↓' : '\u00A0'}
              </span>
            </button>
          </div>
          <div className="answers-list" ref={answersListRef}>
            {sortedAnswers.map((answer) => (
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
