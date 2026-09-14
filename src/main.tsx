import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppDataProvider } from './context/AppDataContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BootPage } from './pages/BootPage'
import { LoginPage } from './pages/LoginPage'
import './index.css'

function Root() {
  const { ready, user } = useAuth()
  if (!ready) return <BootPage />
  if (!user) return <LoginPage />
  return (
    <AppDataProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppDataProvider>
  )
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('root element not found')
}

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
)
