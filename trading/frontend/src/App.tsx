import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Backtest } from './pages/Backtest'
import { Dashboard } from './pages/Dashboard'
import { Settings } from './pages/Settings'
import { Strategies } from './pages/Strategies'
import { StrategyDetail } from './pages/StrategyDetail'
import { StrategyEdit } from './pages/StrategyEdit'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/strategies/new" element={<StrategyEdit />} />
        <Route path="/strategies/:id" element={<StrategyDetail />} />
        <Route path="/strategies/:id/edit" element={<StrategyEdit />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
