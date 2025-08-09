import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import YosemonBoard from '../../components/YosemonBoard'
import '../../styles/Yosemon.css'

interface AnswerResult {
  isCorrect: boolean
  userAnswer: string[]
  correctAnswer: string[]
  answers: Array<{
    coordinate: string
    point: number
  }>
}

const YosemonAnswer: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [problem, setProblem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ナビゲーションのstateから結果を取得
    if (location.state && (location.state as any).result) {
      setResult((location.state as any).result)
      fetchProblem()
    } else {
      // stateがない場合は問題ページへリダイレクト
      navigate(`/yosemon/problems/${id}`)
    }
  }, [id, navigate, location.state])

  const fetchProblem = async () => {
    try {
      const response = await fetch(`/api/yosemon/problems/${id}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setProblem(data)
      }
    } catch (error) {
      console.error('Error fetching problem:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNextProblem = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/yosemon/problems/random/next', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        navigate(`/yosemon/problems/${data.problemNumber}`)
      } else {
        navigate('/yosemon')
      }
    } catch (error) {
      console.error('Error fetching next problem:', error)
      navigate('/yosemon')
    }
  }

  if (!result || loading) {
    return <div className="loading">読み込み中...</div>
  }

  // 正解の順序から正解のインデックスマップを作成
  const correctIndexMap: { [key: string]: number } = {}
  result.correctAnswer.forEach((label, index) => {
    correctIndexMap[label] = index
  })

  return (
    <div className="questionnaire-page">
      <div className="questionnaire-container">
        <div className="problem-header">
          <div className="problem-info-left">
            <span className="problem-number">No.{id}</span>
            <span className="turn-info">黒番</span>
          </div>
        </div>

        <p className="problem-description">価値の高い順に並べてください</p>

        <div className="questionnaire-content">
          <div className="board-wrapper board-wrapper-sticky">
            {problem && (
              <YosemonBoard
                sgf={problem.sgf}
                moves={problem.moves}
                answers={problem.answers}
                size={360}
              />
            )}
          </div>

          <div className="form-wrapper">
            <div className="yosemon-result-display">
              <div className="yosemon-answer-table">
                {result.userAnswer.map((userLabel, userIndex) => {
                  const correctLabel = result.correctAnswer[userIndex]
                  const isPositionCorrect = userLabel === correctLabel
                  const correctIndex = correctIndexMap[userLabel]
                  const answerInfo = result.answers[correctIndex]

                  return (
                    <div key={userIndex} className="yosemon-answer-row">
                      <div className="yosemon-answer-user-container">
                        <div
                          className="yosemon-answer-user"
                          style={{
                            color:
                              userLabel === 'A'
                                ? '#dc2626'
                                : userLabel === 'B'
                                  ? '#2563eb'
                                  : userLabel === 'C'
                                    ? '#16a34a'
                                    : userLabel === 'D'
                                      ? '#9333ea'
                                      : '#333',
                          }}
                        >
                          {userLabel}
                        </div>
                        <div className="yosemon-answer-mark-overlay">
                          {isPositionCorrect ? (
                            <span className="mark-correct">○</span>
                          ) : (
                            <span className="mark-incorrect">×</span>
                          )}
                        </div>
                      </div>
                      <div className="yosemon-answer-correct-container">
                        <span
                          className="yosemon-answer-correct-text"
                          style={{
                            color:
                              correctLabel === 'A'
                                ? '#dc2626'
                                : correctLabel === 'B'
                                  ? '#2563eb'
                                  : correctLabel === 'C'
                                    ? '#16a34a'
                                    : correctLabel === 'D'
                                      ? '#9333ea'
                                      : '#333',
                          }}
                        >
                          {correctLabel}
                        </span>
                        <span className="yosemon-answer-point">{answerInfo.point}目</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={handleNextProblem}
                disabled={loading}
                className="yosemon-next-problem-button"
              >
                {loading ? '読み込み中...' : '次の問題'}
              </button>
            </div>

            <div className="back-to-top">
              <Link to="/yosemon">
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
                <span>よせもんへ戻る</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default YosemonAnswer
