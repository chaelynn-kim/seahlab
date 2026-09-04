import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppDataProvider } from './context/AppDataContext'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('root element not found')
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AppDataProvider>
        <App />
      </AppDataProvider>
    </BrowserRouter>
  </StrictMode>,
)
