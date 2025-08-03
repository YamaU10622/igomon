// client/src/pages/Home.tsx
import { useEffect, useState } from 'react'
import { useRealTimeProblems } from '../hooks/useRealTimeProblems'
import { Link, useSearchParams } from 'react-router-dom'
import { hasUserAnswered } from '../utils/api'
import { LoginButton } from '../components/LoginButton'
import { useAuth } from '../contexts/AuthContext'
import { SEO } from '../components/SEO'
import { WebApplicationStructuredData } from '../components/StructuredData'

export function Home() {
  const { problems, isConnected } = useRealTimeProblems()
  const [answeredMap, setAnsweredMap] = useState<{ [problemId: number]: boolean }>({})
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // エラーパラメータの検知
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      let message = ''
      switch (error) {
        case 'daily_limit':
          message =
            'X（旧Twitter）のAPI利用制限により、本日のログイン回数上限に達しました。明日再度お試しください。'
          break
        case 'rate_limit':
          message =
            '現在、X（旧Twitter）のAPIアクセス制限により一時的にログインできません。しばらく待ってから再度お試しください。'
          break
        case 'auth_failed':
          message = '認証処理中にエラーが発生しました。再度お試しください。'
          break
        default:
          message = 'エラーが発生しました。'
      }
      setErrorMessage(message)
      // URLからエラーパラメータを削除
      searchParams.delete('error')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // 日付をフォーマット（YYYY.MM.DD形式）
  const formatDate = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  // 「期限」の表示内容
  const remainingDays = (dateInput: string | Date) => {
    const deadline = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    const today = new Date()
    deadline.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    const diffInDays = (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)

    if (diffInDays === 1) {
      return <span className="deadline-today">本日</span>
    } else if (diffInDays > 1) {
      return <span>あと{diffInDays}日</span>
    } else {
      return formatDate(deadline)
    }
  }

  // ユーザーが回答済みかどうかを問題ごとにチェック
  useEffect(() => {
    const checkHasUserAnswered = async () => {
      // 認証されていない場合はチェックしない
      if (!isAuthenticated) {
        setAnsweredMap({})
        return
      }

      const results = await Promise.all(
        problems.map(async (problem) => {
          const hasAnswered = await hasUserAnswered(problem.id)
          return { id: problem.id, hasAnswered }
        }),
      )

      const answeredMap: { [id: number]: boolean } = {}

      results.forEach(({ id, hasAnswered }) => {
        answeredMap[id] = hasAnswered
      })
      setAnsweredMap(answeredMap)
    }

    if (problems.length > 0) {
      checkHasUserAnswered()
    }
  }, [problems, isAuthenticated])

  return (
    <div className="home-page">
      <SEO />
      <WebApplicationStructuredData />
      <LoginButton />
      <header>
        <h1>いごもん</h1>
        <div className="connection-status">
          {isConnected ? (
            <span className="connected">● リアルタイム更新中</span>
          ) : (
            <span className="disconnected">● 接続中...</span>
          )}
        </div>
      </header>

      {errorMessage && (
        <div
          className="error-message"
          style={{
            backgroundColor: '#fee',
            color: '#c00',
            padding: '12px 20px',
            margin: '10px 20px',
            borderRadius: '4px',
            border: '1px solid #fcc',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#c00',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
      )}

      <main>
        <div className="problems-list">
          {problems.length === 0 ? (
            <p>問題がありません</p>
          ) : (
            problems.map((problem) => (
              <Link
                key={problem.id}
                to={
                  problem.deadline && new Date() > new Date(problem.deadline)
                    ? `/results/${problem.id}`
                    : `/questionnaire/${problem.id}`
                }
                className="problem-card-link"
                onClick={(e) => {
                  // 結果公開の問題で未ログインの場合はログイン選択画面へ
                  if (!isAuthenticated && problem.deadline && new Date() > new Date(problem.deadline)) {
                    e.preventDefault()
                    window.location.href = `/login?from=results&problem_id=${problem.id}`
                  }
                }}
              >
                <div className="problem-card">
                  <div className="problem-thumbnail">
                    <img
                      src={`/ogp/problem_${problem.id}.png`}
                      alt={`No.${String(problem.id)}`}
                      onError={(e) => {
                        // 画像が存在しない場合はプレースホルダーを表示
                        e.currentTarget.src = '/placeholder-board.png'
                      }}
                    />
                    <div className="problem-id-overlay">No.{String(problem.id)}</div>
                  </div>
                  <div className="problem-info">
                    <div className="problem-details">
                      <div className="turn-and-answered">
                        <div>
                          <span className="problem-turn">
                            {problem.turn === 'black' ? '黒番' : '白番'}
                          </span>
                          <span className="problem-hasUserAnswered">
                            {answeredMap[problem.id] ? (
                              <span className="already-answered">　回答済み</span>
                            ) : problem.deadline && new Date() > new Date(problem.deadline) ? (
                              <span className="expired">　結果公開</span>
                            ) : (
                              <span className="notyet-answered">　未回答</span>
                            )}
                          </span>
                        </div>
                        <span className="problem-answerCount">
                          {problem._count ? problem._count.answers : problem.answerCount} 票
                        </span>
                      </div>
                      <span className="problem-date">
                        ◎ {formatDate(problem.createdAt || problem.createdDate || '')}
                      </span>
                      {problem.deadline && (
                        <span className="problem-deadline">
                          期限: {remainingDays(problem.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
