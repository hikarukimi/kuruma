import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import LoginPage from './pages/LoginPage'
import PoliceWorkbench from './pages/PoliceWorkbench'
import SessionConsole from './pages/SessionConsole'

const loginPath = '/login'
const sessionConsolePath = '/sessions'

function App() {
  const navigate = useNavigate()
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Navigate replace to={loginPath} />} path="/" />
        <Route element={<LoginPage onLoginSuccess={() => navigate(sessionConsolePath)} />} path={loginPath} />
        <Route element={<Navigate replace to={loginPath} />} path="*" />
        <Route element={<PoliceWorkbench />} path={sessionConsolePath} />
        <Route element={<SessionConsole />} path={`${sessionConsolePath}/:sessionId`} />

      </Routes>
    </BrowserRouter>
  )
}

export default App
