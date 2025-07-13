// 認証トークン管理
const AUTH_TOKEN_KEY = 'igomon_auth_token'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function hasAuthToken(): boolean {
  return getAuthToken() !== null
}

// 認証ヘッダーを生成
export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken()
  if (!token) {
    return {}
  }
  return {
    'Authorization': `Bearer ${token}`
  }
}

// 初回アクセス時の自動登録
let isAuthenticating = false // 重複認証を防ぐフラグ

export async function ensureAuthenticated(): Promise<boolean> {
  if (hasAuthToken()) {
    return true
  }

  // 既に認証中の場合は待機
  if (isAuthenticating) {
    // 認証が完了するまで待つ
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!isAuthenticating) {
          clearInterval(checkInterval)
          resolve(true)
        }
      }, 100)
    })
    return hasAuthToken()
  }

  isAuthenticating = true

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('認証登録に失敗しました:', response.status)
      return false
    }

    const data = await response.json()
    if (data.authToken) {
      setAuthToken(data.authToken)
      return true
    }

    return false
  } catch (error) {
    console.error('認証登録エラー:', error)
    return false
  } finally {
    isAuthenticating = false
  }
}