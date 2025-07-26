// API呼び出しヘルパー関数
import { getAuthHeaders, clearAuthToken, ensureAuthenticated } from './auth'

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  // セッションベースの認証を使用（credentials: 'include'）
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // セッションクッキーを含める
    headers: {
      ...options.headers
    }
  })
  
  return response
}