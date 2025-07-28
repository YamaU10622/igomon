// client/src/pages/Questionnaire.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import GoBoard from '../components/GoBoard'
import { AnswerForm } from '../components/AnswerForm'
import { getProblem, submitAnswer, hasUserAnswered } from '../utils/api'
import { LoginButton } from '../components/LoginButton'
import { useAuth } from '../contexts/AuthContext'

export function Questionnaire() {
  const { problemId } = useParams<{ problemId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [problem, setProblem] = useState<any>(null)
  const [selectedCoordinate, setSelectedCoordinate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!problemId) return

    if (isAuthenticated) {
      // 認証済みの場合、回答済みかチェック
      checkIfAnswered()
    } else {
      // 未認証の場合は問題を読み込む
      loadProblem()
    }
  }, [problemId, isAuthenticated])

  const checkIfAnswered = async () => {
    try {
      const answered = await hasUserAnswered(parseInt(problemId!))
      if (answered) {
        // 回答済みの場合は結果ページへ遷移
        navigate(`/results/${problemId}`, { replace: true })
        return
      }
      // 未回答の場合は問題を読み込む
      loadProblem()
    } catch (err) {
      console.error('回答状態のチェックに失敗しました:', err)
      // エラーが発生しても問題の読み込みは行う
      loadProblem()
    }
  }

  const loadProblem = async () => {
    try {
      setLoading(true)
      const problemData = await getProblem(problemId!)
      setProblem(problemData)

      // 期限チェック（初回のみ）
      if (problemData.deadline) {
        const now = new Date()
        const deadlineDate = new Date(problemData.deadline)

        if (now >= deadlineDate) {
          // 期限切れの場合、結果ページへ遷移
          navigate(`/results/${problemId}`, { replace: true })
          return
        }
      }
    } catch (err) {
      setError('問題の読み込みに失敗しました')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (formData: {
    coordinate: string
    reason: string
    playerName: string
    playerRank: string
  }) => {
    if (!problemId || !problem) return

    try {
      setIsSubmitting(true)
      setError('') // エラーをクリア
      await submitAnswer({
        problemId: problem.id,
        ...formData,
      })

      // 回答済みの場合でも結果ページへ遷移
      navigate(`/results/${problemId}`)
    } catch (err: any) {
      // 401エラーの場合はX認証へリダイレクト
      if (err.message === '認証が必要です') {
        // 回答データをセッションに保存してX認証へ
        const answerData = {
          problemId: problem.id,
          ...formData,
        }
        window.location.href = `/auth/x?answer_data=${encodeURIComponent(JSON.stringify(answerData))}`
        return
      }

      // サーバーから返されたエラーメッセージを表示
      if (err.message) {
        setError(err.message)
      } else {
        setError('回答の送信に失敗しました')
      }
      console.error('Submit error:', err)
    } finally {
      setIsSubmitting(false)
    }
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
        <LoginButton />
        <div className="problem-header">
          <div className="problem-info-left">
            <span className="problem-number">No.{problem.id}</span>
            <span className="turn-info">{problem.turn === 'black' ? '黒番' : '白番'}</span>
          </div>
        </div>

        <p className="problem-description">{problem.description}</p>

        {problem.deadline && (
          <div className="deadline-info">
            <span className="deadline-label">回答期限:</span>
            <span className="deadline-date">
              {new Date(problem.deadline).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}

        <div className="questionnaire-content">
          <div className="board-wrapper">
            <GoBoard
              sgfContent={problem.sgfContent}
              maxMoves={problem.moves}
              onCoordinateSelect={setSelectedCoordinate}
              showClickable={true}
              derivedTurn={problem.turn}
            />
          </div>

          <div className="form-wrapper">
            <AnswerForm selectedCoordinate={selectedCoordinate} onSubmit={handleSubmit} />
            {isSubmitting && <p className="submitting">送信中...</p>}
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
