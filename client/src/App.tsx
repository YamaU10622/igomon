// client/src/App.tsx
import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Questionnaire } from './pages/Questionnaire'
import { Results } from './pages/Results'
import { ensureAuthenticated } from './utils/auth'
import './App.css'

function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      // 認証を試みるが、失敗してもアプリは使えるようにする
      await ensureAuthenticated()
      setIsLoading(false)
    }
    initAuth()
  }, [])

  if (isLoading) {
    return <div className="app">読み込み中...</div>
  }

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/questionnaire/:problemId" element={<Questionnaire />} />
          <Route path="/results/:problemId" element={<Results />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
