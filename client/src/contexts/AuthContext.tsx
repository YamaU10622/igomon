import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: number
  xUserId?: string | null
  profile?: {
    name: string
    rank: string
  } | null
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: () => void
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 認証状態をチェック
  const checkAuth = async () => {
    try {
      const response = await fetch('/auth/me', {
        credentials: 'include',
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('認証チェックエラー:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  // 初回マウント時に認証状態をチェック
  useEffect(() => {
    checkAuth()
  }, [])

  // ログイン（ログイン選択ページへリダイレクト）
  const login = () => {
    // 現在のパスとクエリパラメータを保持
    const currentPath = window.location.pathname
    const searchParams = window.location.search
    
    // 回答ページからの場合、問題IDを含める
    if (currentPath.includes('/questionnaire/')) {
      const problemId = currentPath.split('/').pop()
      window.location.href = `/login?from=questionnaire&problem_id=${problemId}`
    } else if (searchParams) {
      // 既存のクエリパラメータがある場合はそのまま渡す
      window.location.href = `/login${searchParams}`
    } else {
      window.location.href = '/login'
    }
  }

  // ログアウト
  const logout = async () => {
    try {
      // 現在のパスを確認
      const currentPath = window.location.pathname
      const isQuestionnairePage = currentPath.includes('/questionnaire/')

      // 回答ページの場合は、ログアウト処理を行いステートを更新するだけ
      if (isQuestionnairePage) {
        const response = await fetch('/auth/logout', {
          method: 'POST',
          credentials: 'include',
        })

        if (response.ok) {
          setUser(null)
          // ページ遷移はしない（回答ページに留まる）
        }
      } else {
        // それ以外のページ（結果ページなど）では、即座にトップページへ遷移
        window.location.replace('/')

        // バックグラウンドでログアウト処理
        fetch('/auth/logout', {
          method: 'POST',
          credentials: 'include',
        })
      }
    } catch (error) {
      console.error('ログアウトエラー:', error)
      // エラーが発生した場合も同様の処理
      const currentPath = window.location.pathname
      const isQuestionnairePage = currentPath.includes('/questionnaire/')

      if (!isQuestionnairePage) {
        window.location.replace('/')
      }
    }
  }

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
