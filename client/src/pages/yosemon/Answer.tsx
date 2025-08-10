import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import YosemonBoard from '../../components/YosemonBoard'
import { LoginButton } from '../../components/LoginButton'
import { getCurrentTurnFromSGF } from '../../utils/sgf-helpers'
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
      
      // 表示済み問題として記録
      const viewedProblems = JSON.parse(sessionStorage.getItem('yosemonViewedProblems') || '[]')
      if (!viewedProblems.includes(id)) {
        viewedProblems.push(id)
        sessionStorage.setItem('yosemonViewedProblems', JSON.stringify(viewedProblems))
      }
    } else {
      // stateがない場合はAPIから結果を取得
      fetchAnswerData()
    }
  }, [id, navigate, location.state])

  const fetchAnswerData = async () => {
    try {
      // 問題データを取得
      const problemResponse = await fetch(`/api/yosemon/problems/${id}`, {
        credentials: 'include',
      })

      if (problemResponse.ok) {
        const problemData = await problemResponse.json()
        setProblem(problemData)
        
        // ユーザーの回答履歴を取得
        const answerResponse = await fetch(`/api/yosemon/problems/${id}/user-answer`, {
          credentials: 'include',
        })

        if (answerResponse.ok) {
          const answerData = await answerResponse.json()
          if (answerData && answerData.result) {
            setResult(answerData.result)
            
            // 表示済み問題として記録
            const viewedProblems = JSON.parse(sessionStorage.getItem('yosemonViewedProblems') || '[]')
            if (!viewedProblems.includes(id)) {
              viewedProblems.push(id)
              sessionStorage.setItem('yosemonViewedProblems', JSON.stringify(viewedProblems))
            }
          } else {
            // 回答がない場合は問題ページへリダイレクト
            navigate(`/yosemon/problems/${id}`)
          }
        } else {
          // 回答取得に失敗した場合は問題ページへリダイレクト
          navigate(`/yosemon/problems/${id}`)
        }
      }
    } catch (error) {
      console.error('Error fetching answer data:', error)
      navigate(`/yosemon/problems/${id}`)
    } finally {
      setLoading(false)
    }
  }

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
      // まず全問題を取得して、表示済み問題を除外
      const allProblemsResponse = await fetch('/api/yosemon/problems', {
        credentials: 'include',
      })
      
      if (!allProblemsResponse.ok) {
        navigate('/yosemon')
        return
      }
      
      const allProblems = await allProblemsResponse.json()
      const viewedProblems = JSON.parse(sessionStorage.getItem('yosemonViewedProblems') || '[]')
      
      // 未表示の問題を抽出
      const unviewedProblems = allProblems.filter((p: any) => 
        !viewedProblems.includes(p.problemNumber.toString())
      )
      
      if (unviewedProblems.length === 0) {
        // 全問題を表示済みの場合、セッションストレージをクリアしてHomeへ
        sessionStorage.removeItem('yosemonViewedProblems')
        navigate('/yosemon')
      } else {
        // 未表示問題からランダムに選択
        const randomIndex = Math.floor(Math.random() * unviewedProblems.length)
        const nextProblem = unviewedProblems[randomIndex]
        navigate(`/yosemon/problems/${nextProblem.problemNumber}`)
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
        <LoginButton />
        <div className="problem-header">
          <div className="problem-info-left">
            <span className="problem-number">No.{id}</span>
            <span className="turn-info">
              {problem && getCurrentTurnFromSGF(problem.sgf, problem.moves) === 'black'
                ? '黒番'
                : '白番'}
            </span>
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
