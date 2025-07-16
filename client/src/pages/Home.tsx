// client/src/pages/Home.tsx
import { useEffect, useState } from 'react'
import { useRealTimeProblems } from '../hooks/useRealTimeProblems'
import { Link } from 'react-router-dom'
import { hasUserAnswered } from '../utils/api'

export function Home() {
  const { problems, isConnected } = useRealTimeProblems()
  const [answeredMap, setAnsweredMap] = useState<{ [problemId: number]: boolean }>({})

  // 日付をフォーマット（YYYY.MM.DD形式）
  const formatDate = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  // ユーザーが回答済みかどうかを問題ごとにチェック
  useEffect(() => {
    const checkHasUserAnswered = async () => {
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
  }, [problems])

  return (
    <div className="home-page">
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

      <main>
        <div className="problems-list">
          {problems.length === 0 ? (
            <p>問題がありません</p>
          ) : (
            problems.map((problem) => (
              <Link
                key={problem.id}
                to={`/questionnaire/${problem.id}`}
                className="problem-card-link"
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
                        <span className="problem-turn">
                          {problem.turn === 'black' ? '黒番' : '白番'}
                        </span>
                        <span className="problem-hasUserAnswered">
                          {answeredMap[problem.id] ? (
                            <span className="already-answered">回答済み</span>
                          ) : problem.deadline && new Date() > new Date(problem.deadline) ? (
                            <span className="expired">結果公開</span>
                          ) : (
                            <span className="notyet-answered">未回答</span>
                          )}
                        </span>
                        <span className="problem-answerCount">
                          {problem._count ? problem._count.answers : problem.answerCount} 票
                        </span>
                      </div>
                      <span className="problem-date">
                        ◎ {formatDate(problem.createdAt || problem.createdDate || '')}
                      </span>
                      {problem.deadline && (
                        <span className="problem-deadline">
                          期限: {formatDate(problem.deadline)}
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
