import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { HistoryLogPage } from './pages/HistoryLogPage'
import { InspectionPage } from './pages/InspectionPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/inspection" element={<InspectionPage />} />
        <Route path="/history" element={<HistoryLogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/inspection" replace />} />
    </Routes>
  )
}
