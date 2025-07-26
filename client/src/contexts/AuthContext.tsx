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

  // ログイン（X認証へリダイレクト）
  const login = () => {
    window.location.href = '/auth/x'
  }

  // ログアウト
  const logout = async () => {
    try {
      // 先にトップページへリダイレクトしてから、バックグラウンドでログアウト処理を実行
      window.location.replace('/')
      
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('ログアウトエラー:', error)
      // エラーが発生してもトップページへリダイレクト
      window.location.replace('/')
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
