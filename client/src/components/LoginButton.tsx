import React from 'react'
import { useAuth } from '../contexts/AuthContext'

export function LoginButton() {
  const { isAuthenticated, isLoading, login, logout, user } = useAuth()

  console.log('LoginButton - 認証状態:', isAuthenticated, 'ユーザー:', user)

  if (isLoading) {
    return null
  }

  return (
    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
      {isAuthenticated ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user && (
            <span style={{ fontSize: '14px', color: '#666' }}>
              ログイン中: {user.xUserId ? `@${user.xUserId}` : `ID: ${user.id}`}
            </span>
          )}
          <button
            onClick={logout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ログアウト
          </button>
        </div>
      ) : (
        <button
          onClick={login}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1da1f2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Xでログイン
        </button>
      )}
    </div>
  )
}