import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { useAuth } from './context/AuthContext'
import { ChemicalLedgerPage } from './pages/ChemicalLedgerPage'
import { HistoryLogPage } from './pages/HistoryLogPage'
import { InspectionPage } from './pages/InspectionPage'
import { SettingsPage } from './pages/SettingsPage'

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/inspection" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/inspection" element={<InspectionPage />} />
        <Route path="/chemicals" element={<ChemicalLedgerPage />} />
        <Route
          path="/history"
          element={
            <AdminOnly>
              <HistoryLogPage />
            </AdminOnly>
          }
        />
        <Route
          path="/settings"
          element={
            <AdminOnly>
              <SettingsPage />
            </AdminOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/inspection" replace />} />
    </Routes>
  )
}
