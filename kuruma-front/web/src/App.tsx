import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MessageProvider } from './components/message'
import LoginPage from './pages/LoginPage'
import PoliceWorkbench from './pages/PoliceWorkbench'
import SessionConsole from './pages/SessionConsole'

const loginPath = '/login'
const sessionConsolePath = '/sessions'

function App() {
  return (
    <MessageProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Navigate replace to={loginPath} />} path="/" />
          <Route element={<LoginPage />} path={loginPath} />
          <Route element={<PoliceWorkbench />} path={sessionConsolePath} />
          <Route element={<SessionConsole />} path={`${sessionConsolePath}/:sessionId`} />
          <Route element={<Navigate replace to={loginPath} />} path="*" />
        </Routes>
      </BrowserRouter>
    </MessageProvider>
  )
}

export default App
