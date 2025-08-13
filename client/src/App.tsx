// client/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { YosemonProblemProvider } from './contexts/YosemonProblemContext'
import { Home } from './pages/Home'
import { Questionnaire } from './pages/Questionnaire'
import { Results } from './pages/Results'
import { Login } from './pages/Login'
import YosemonHome from './pages/yosemon/Home'
import YosemonProblem from './pages/yosemon/Problem'
import YosemonAnswer from './pages/yosemon/Answer'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <YosemonProblemProvider>
        <Router>
          <div className="app">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/questionnaire/:problemId" element={<Questionnaire />} />
              <Route path="/results/:problemId" element={<Results />} />
              <Route path="/yosemon" element={<YosemonHome />} />
              <Route path="/yosemon/problems/:id" element={<YosemonProblem />} />
              <Route path="/yosemon/problems/answers/:id" element={<YosemonAnswer />} />
            </Routes>
          </div>
        </Router>
      </YosemonProblemProvider>
    </AuthProvider>
  )
}

export default App
