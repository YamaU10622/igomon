// API呼び出しヘルパー関数
import { getAuthHeaders, clearAuthToken, ensureAuthenticated } from './auth'

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  // 認証ヘッダーを追加
  const headers = {
    ...options.headers,
    ...getAuthHeaders()
  }
  
  let response = await fetch(url, {
    ...options,
    headers
  })
  
  // 401エラーの場合、トークンをクリアして再認証
  if (response.status === 401) {
    clearAuthToken()
    const authenticated = await ensureAuthenticated()
    
    if (authenticated) {
      // 新しいトークンで再試行
      const newHeaders = {
        ...options.headers,
        ...getAuthHeaders()
      }
      
      response = await fetch(url, {
        ...options,
        headers: newHeaders
      })
    }
  }
  
  return response
}