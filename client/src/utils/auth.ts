// セッションベースの認証ヘッダーを生成
export function getAuthHeaders(): HeadersInit {
  // セッションベースの認証では、Cookieが自動的に送信されるため
  // 特別なヘッダーは不要
  return {
    'Content-Type': 'application/json',
  }
}

// セッションの確認
export async function checkSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include', // Cookieを含める
    })
    return response.ok
  } catch (error) {
    console.error('セッション確認エラー:', error)
    return false
  }
}