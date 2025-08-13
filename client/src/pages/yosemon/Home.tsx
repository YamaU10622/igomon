import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LoginButton } from '../../components/LoginButton'

import '../../styles/Yosemon.css'

interface Problem {
  id: number
  problemNumber: number
  moves?: number
  answersCount: number
  correctRate: number
  userStatus: 'correct' | 'incorrect' | 'unanswered'
  totalAnswers: number
}

const YosemonHome: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [answeredMap, setAnsweredMap] = useState<{ [problemNumber: number]: boolean }>({})
  const { user, isAuthenticated } = useAuth()

  useEffect(() => {
    fetchProblems()
  }, [user])

  // ユーザーが回答済みかどうかをチェック
  useEffect(() => {
    const checkAnsweredStatus = async () => {
      if (!isAuthenticated) {
        setAnsweredMap({})
        return
      }

      const results = await Promise.all(
        problems.map(async (problem) => {
          try {
            const response = await fetch(
              `/api/yosemon/problems/${problem.problemNumber}/answered`,
              {
                credentials: 'include',
              },
            )
            const hasAnswered = response.ok && (await response.json()).hasAnswered
            return { problemNumber: problem.problemNumber, hasAnswered }
          } catch {
            return { problemNumber: problem.problemNumber, hasAnswered: false }
          }
        }),
      )

      const newAnsweredMap: { [problemNumber: number]: boolean } = {}
      results.forEach(({ problemNumber, hasAnswered }) => {
        newAnsweredMap[problemNumber] = hasAnswered
      })
      setAnsweredMap(newAnsweredMap)
    }

    if (problems.length > 0) {
      checkAnsweredStatus()
    }
  }, [problems, isAuthenticated])

  const fetchProblems = async () => {
    try {
      setError(null)
      const response = await fetch('/api/yosemon/problems', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setProblems(data)
      } else {
        throw new Error('問題一覧の取得に失敗しました')
      }
    } catch (error) {
      console.error('Error fetching problems:', error)
      setError(error instanceof Error ? error.message : '問題一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="yosemon-loading">
        <div className="yosemon-loading-spinner"></div>
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="yosemon-home">
        <div className="yosemon-error">
          <h3>エラーが発生しました</h3>
          <p>{error}</p>
          <button
            onClick={() => fetchProblems()}
            className="yosemon-nav-button primary"
            style={{ marginTop: '15px' }}
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-page yosemon-home">
      <LoginButton />
      <header>
        <h1>よせもん（β版）</h1>
        <a href="/" className="igomon-link-button">
          いごもんへ
        </a>
        <div
          className="yosemon-notice"
          style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            padding: '10px 15px',
            marginTop: '10px',
            fontSize: '14px',
            color: '#856404',
          }}
        >
          <strong>テストリリース中</strong>
          ：現在ベータ版として公開しています。問題は1週間に10問程度追加していく予定なので、定期的にチェックしてみてください。
        </div>
      </header>

      <main>
        <div className="problems-list">
          {problems.length === 0 ? (
            <p>問題がありません</p>
          ) : (
            problems.map((problem) => (
              <Link
                key={problem.problemNumber}
                to={`/yosemon/problems/${problem.problemNumber}`}
                className="problem-card-link"
              >
                <div className="problem-card">
                  <div className="problem-thumbnail">
                    <img
                      src={`/ogp/yosemon/problem_${problem.problemNumber}.png`}
                      alt={`No.${problem.problemNumber}`}
                      onError={(e) => {
                        // 画像が存在しない場合はプレースホルダーを表示
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const placeholder = document.createElement('div')
                        placeholder.className = 'yosemon-board-placeholder'
                        placeholder.innerHTML = '<div class="yosemon-loading-spinner"></div>'
                        target.parentNode?.appendChild(placeholder)
                      }}
                    />
                    <div className="problem-id-overlay">No.{problem.problemNumber}</div>
                  </div>
                  <div className="problem-info">
                    <div className="yosemon-problem-info">
                      {problem.userStatus === 'correct' && (
                        <span className="yosemon-status-text correct">正解</span>
                      )}
                      {problem.userStatus === 'incorrect' && (
                        <span className="yosemon-status-text incorrect">不正解</span>
                      )}
                      {problem.userStatus === 'unanswered' && (
                        <span className="yosemon-status-text unanswered">未回答</span>
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

export default YosemonHome
