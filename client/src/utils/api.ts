// client/src/utils/api.ts
import { fetchWithAuth } from './api-helper'

export async function submitAnswer(answerData: {
  problemId: number
  coordinate: string
  reason: string
  playerName: string
  playerRank: string
}) {
  const response = await fetchWithAuth('/api/answers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(answerData),
  })

  const responseData = await response.json()

  // 回答済みの場合も成功として扱う（結果ページへ遷移可能）
  if (responseData.alreadyAnswered) {
    return responseData
  }

  if (!response.ok) {
    // サーバーから返されたエラーメッセージを使用
    if (responseData.error) {
      throw new Error(responseData.error)
    }
    throw new Error('Failed to submit answer')
  }

  return responseData
}

export async function getResults(problemId: number) {
  const url = `/api/results/${problemId}`

  const response = await fetchWithAuth(url)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    console.error('結果API エラー:', errorData)
    if (errorData.error) {
      throw new Error(errorData.error)
    }
    throw new Error('Failed to get results')
  }

  const data = await response.json()
  return data
}

export async function deleteAnswer(answerId: number) {
  const response = await fetchWithAuth(`/api/answers/${answerId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    if (errorData.error) {
      throw new Error(errorData.error)
    }
    throw new Error('Failed to delete answer')
  }

  return response.json()
}

export async function getProblems() {
  const response = await fetch('/api/problems')
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    if (errorData.error) {
      throw new Error(errorData.error)
    }
    throw new Error('Failed to get problems')
  }
  return response.json()
}

export async function getProblem(problemId: string) {
  const response = await fetch(`/api/problems/${problemId}`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    if (errorData.error) {
      throw new Error(errorData.error)
    }
    throw new Error('Failed to get problem')
  }
  return response.json()
}

export async function hasUserAnswered(problemId: number): Promise<boolean> {
  try {
    const response = await fetchWithAuth(`/api/problems/${problemId}/answered`)

    if (!response.ok) {
      console.error('hasUserAnswered エラー - ステータス:', response.status)
      const errorText = await response.text()
      console.error('エラー内容:', errorText)
      return false
    }
    const data = await response.json()
    return data.answered
  } catch (err) {
    console.error('hasUserAnswered 例外:', err)
    throw err
  }
}

export async function getSgf(problemId: string) {
  const response = await fetch(`/api/sgf/${problemId}`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    if (errorData.error) {
      throw new Error(errorData.error)
    }
    throw new Error('Failed to get SGF')
  }
  return response.text()
}
