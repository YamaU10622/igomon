import { useAuth } from '../contexts/AuthContext'
import { useLocation, useParams } from 'react-router-dom'

export function LoginButton() {
  const { isAuthenticated, isLoading, login, logout, user } = useAuth()
  const location = useLocation()
  const { problemId } = useParams<{ problemId: string }>()

  if (isLoading) {
    return null
  }

  const handleLogin = () => {
    // 回答ページからのログインの場合は、問題IDを含める
    if (location.pathname.includes('/questionnaire/') && problemId) {
      window.location.href = `/auth/x?from=questionnaire&problem_id=${problemId}`
    } else {
      login()
    }
  }

  return (
    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
      {isAuthenticated ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={logout}
            style={{
              padding: '6px 10px',
              backgroundColor: 'white',
              color: '#333',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ログアウト
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          style={{
            padding: '6px 10px',
            backgroundColor: 'white',
            color: '#333',
            cursor: 'pointer',
            fontSize: '14px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f8f8'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white'
          }}
        >
          ログイン
        </button>
      )}
    </div>
  )
}
