// client/src/pages/Results.tsx
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import GoBoard from '../components/GoBoard'
import { ResultsDisplay } from '../components/ResultsDisplay'
import { getProblem, getResults, hasUserAnswered } from '../utils/api'
import { getUserUuid } from '../utils/uuid'
import { RANKS } from '../utils/rankUtils'

export function Results() {
  const { problemId } = useParams<{ problemId: string }>()
  const navigate = useNavigate()
  const [problem, setProblem] = useState<any>(null)
  const [results, setResults] = useState<Record<string, { votes: number; answers: any[] }>>({})
  const [allResults, setAllResults] = useState<Record<string, { votes: number; answers: any[] }>>(
    {},
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [minRank, setMinRank] = useState(0)
  const [maxRank, setMaxRank] = useState(RANKS.length - 1)

  useEffect(() => {
    if (!problemId) return

    checkAnswerStatus()
  }, [problemId])

  const checkAnswerStatus = async () => {
    try {
      // ユーザーが回答済みかチェック
      const answered = await hasUserAnswered(parseInt(problemId!))

      if (!answered) {
        // 未回答の場合は回答ページへリダイレクト
        navigate(`/questionnaire/${problemId}`)
        return
      }

      // 回答済みの場合はデータを読み込む
      loadData()
    } catch (err) {
      console.error('回答状態の確認に失敗しました:', err)
      setError('回答状態の確認に失敗しました')
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [problemData, resultsData] = await Promise.all([
        getProblem(problemId!),
        getResults(parseInt(problemId!)), // 全ての回答を取得
      ])

      setProblem(problemData)
      setAllResults(resultsData) // 全データを保存

      filterResults(resultsData, minRank, maxRank) // 初回フィルタリング
    } catch (err) {
      setError('データの読み込みに失敗しました')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // フロントエンドでのフィルタリング関数
  const filterResults = (
    data: Record<string, { votes: number; answers: any[] }>,
    min: number,
    max: number,
  ) => {
    const filteredResults: Record<string, { votes: number; answers: any[] }> = {}

    Object.entries(data).forEach(([key, value]) => {
      const filteredAnswers = value.answers.filter((answer) => {
        // answer.playerRankを使用（データ構造に合わせて修正）
        const rankIndex = RANKS.indexOf(answer.playerRank)
        return rankIndex >= min && rankIndex <= max
      })

      if (filteredAnswers.length > 0) {
        filteredResults[key] = {
          votes: filteredAnswers.length,
          answers: filteredAnswers,
        }
      }
    })

    setResults(filteredResults)
  }

  useEffect(() => {
    if (allResults && Object.keys(allResults).length > 0) {
      filterResults(allResults, minRank, maxRank)
    }
  }, [minRank, maxRank, allResults])

  const handleRangeChange = (min: number, max: number) => {
    setMinRank(min)
    setMaxRank(max)
  }

  if (loading) {
    return <div className="loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="error-page">
        <h2>エラー</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>トップへ戻る</button>
      </div>
    )
  }

  if (!problem) {
    return <div className="error-page">問題が見つかりません</div>
  }

  return (
    <div className="questionnaire-page">
      <div className="questionnaire-container">
        <div className="problem-header">
          <div className="problem-info-left">
            <span className="problem-number">No.{problem.id} - 結果ページ</span>
            <span className="turn-info">{problem.turn === 'black' ? '黒番' : '白番'}</span>
          </div>
        </div>

        <p className="problem-description">{problem.description}</p>

        <div className="questionnaire-content">
          <div className="board-wrapper">
            <GoBoard
              sgfContent={problem.sgfContent}
              maxMoves={problem.moves}
              resultsData={results}
              showClickable={false}
            />
          </div>

          <div className="form-wrapper">
            <ResultsDisplay
              results={results}
              onDelete={loadData}
              isFiltered={minRank !== 0 || maxRank !== RANKS.length - 1}
              minRank={minRank}
              maxRank={maxRank}
              onRangeChange={handleRangeChange}
            />
            <div className="back-to-top">
              <Link to="/">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11 12L7 8L11 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>トップへ戻る</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
