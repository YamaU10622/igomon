import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import YosemonBoard from '../../components/YosemonBoard'
import { useAuth } from '../../contexts/AuthContext'
import { useYosemonProblem } from '../../contexts/YosemonProblemContext'
import { LoginButton } from '../../components/LoginButton'
import { getCurrentTurnFromSGF } from '../../utils/sgf-helpers'
import { getLabelColor } from '../../utils/label-colors'
import '../../styles/Yosemon.css'

interface ProblemData {
  id: number
  problemNumber: number
  moves?: number
  sgf: string
  answers: Array<{
    label: string
    coordinate: string
  }>
}

const YosemonProblem: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { setProblemData } = useYosemonProblem()
  const [problem, setProblem] = useState<ProblemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answerOrder, setAnswerOrder] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      fetchProblem(id)
    }
  }, [id])

  const fetchProblem = async (problemId: string) => {
    try {
      setError(null)
      const response = await fetch(`/api/yosemon/problems/${problemId}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setProblem(data)
        // Contextに問題データを保存
        setProblemData(problemId, data)
        // 初期順序を設定
        setAnswerOrder(data.answers.map((a: any) => a.label))
      } else if (response.status === 404) {
        setError('問題が見つかりません')
        setTimeout(() => navigate('/yosemon'), 2000)
      } else {
        throw new Error('問題の取得に失敗しました')
      }
    } catch (error) {
      console.error('Error fetching problem:', error)
      setError(error instanceof Error ? error.message : '問題の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(answerOrder)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setAnswerOrder(items)
  }

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      // 未ログインの場合はログインページへ
      navigate('/login', { state: { from: `/yosemon/problems/${id}` } })
      // 回答データも含めてセッションに保存するため
      const answerData = encodeURIComponent(
        JSON.stringify({
          problemId: id,
          userAnswer: answerOrder.join(','),
        }),
      )
      window.location.href = `/login?from=yosemon&problem_id=${id}&answer_data=${answerData}`
      return
    }

    if (!problem || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/yosemon/problems/${id}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userAnswer: answerOrder.join(','),
          shuffledAnswers: problem.answers,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        // 解答ページへ遷移（結果を渡す）
        navigate(`/yosemon/problems/answers/${id}`, {
          state: { result },
        })
      } else if (response.status === 401) {
        // 未認証の場合はログイン画面へ（Yosemon用のパラメータを付与）
        const yosemonData = {
          problemId: id,
          userAnswer: answerOrder.join(','),
        }
        window.location.href = `/login?from=yosemon&problem_id=${id}&answer_data=${encodeURIComponent(JSON.stringify(yosemonData))}`
      } else {
        const errorData = await response.json()
        console.error('Error response:', errorData)
        throw new Error(errorData.error || '回答の送信に失敗しました')
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      setError(error instanceof Error ? error.message : '回答の送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="loading">読み込み中...</div>
  }

  if (error || !problem) {
    return (
      <div className="error-page">
        <h2>エラー</h2>
        <p>{error || '問題が見つかりません'}</p>
        <button onClick={() => navigate('/yosemon')}>よせもんへ戻る</button>
      </div>
    )
  }

  return (
    <div className="questionnaire-page">
      <div className="questionnaire-container">
        <LoginButton />
        <div className="problem-header">
          <div className="problem-info-left">
            <span className="problem-number">No.{problem.problemNumber}</span>
            <span className="turn-info">
              {problem && getCurrentTurnFromSGF(problem.sgf, problem.moves) === 'black'
                ? '黒番'
                : '白番'}
            </span>
          </div>
        </div>

        <p className="problem-description">
          価値が最も高い選択肢をドラッグして先頭に移動させてください
        </p>

        <div className="questionnaire-content">
          <div className="board-wrapper">
            <YosemonBoard
              sgf={problem.sgf}
              moves={problem.moves}
              answers={problem.answers}
              size={360}
            />
          </div>

          <div className="form-wrapper">
            <div className="yosemon-answer-form">
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="answers">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="yosemon-answer-list"
                    >
                      {answerOrder.map((label, index) => (
                        <Draggable key={label} draggableId={label} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`yosemon-answer-option ${snapshot.isDragging ? 'dragging' : ''}`}
                              style={{
                                ...provided.draggableProps.style,
                              }}
                            >
                              <span
                                className="yosemon-option-label"
                                style={{
                                  color: getLabelColor(label),
                                }}
                              >
                                {label}
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {error && <div className="error-message">{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="submit-button"
                style={{ marginTop: '20px' }}
              >
                {submitting ? '送信中...' : '回答する'}
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

export default YosemonProblem
