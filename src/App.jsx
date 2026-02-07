import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage.jsx'
import RoutinePage from './pages/RoutinePage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import HerberthSheetsPage from './pages/HerberthSheetsPage.jsx'
import AppShell from './ui/AppShell.jsx'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/rotina" element={<RoutinePage />} />
        <Route path="/fichas-herberth" element={<HerberthSheetsPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
