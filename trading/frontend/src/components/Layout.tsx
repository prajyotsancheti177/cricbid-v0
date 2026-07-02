import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◧' },
  { to: '/strategies', label: 'Strategies', icon: '⚙' },
  { to: '/backtest', label: 'Backtest', icon: '↺' },
  { to: '/settings', label: 'Settings', icon: '⚿' },
]

function Chip({ label, on, onColor = 'text-emerald-400 border-emerald-500/40' }: {
  label: string
  on: boolean
  onColor?: string
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        on ? onColor : 'border-slate-700 text-slate-500'
      }`}
    >
      {label}
    </span>
  )
}

export function Layout() {
  const toast = useToast()
  const { data: health } = usePoll(() => api.health(), 5000)
  const { data: auth } = usePoll(() => api.authStatus(), 5000)
  const [killOpen, setKillOpen] = useState(false)
  const [killing, setKilling] = useState(false)

  const killAll = async () => {
    setKilling(true)
    try {
      const res = await api.killSwitch()
      toast.success(
        res.halted_strategies.length
          ? `Kill switch: halted strategies ${res.halted_strategies.join(', ')}`
          : 'Kill switch: nothing was running',
      )
      setKillOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setKilling(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-52 flex-col border-r border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="text-xl">📈</span>
          <div>
            <div className="text-sm font-bold text-slate-100">AutoTrader</div>
            <div className="text-[10px] uppercase tracking-widest text-amber-500">India · Kite</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-amber-400'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`
              }
            >
              <span className="w-4 text-center">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-[10px] text-slate-600">
          Backend: FastAPI · localhost:8000
        </div>
      </aside>

      <div className="ml-52 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Chip
              label={`Feed: ${auth?.feed ?? health?.feed ?? '…'}`}
              on={(auth?.feed ?? health?.feed) === 'kite'}
              onColor="text-emerald-400 border-emerald-500/40"
            />
            <Chip label="Kite connected" on={!!auth?.kite_connected} />
            <Chip
              label="Live trading"
              on={!!auth?.live_trading_enabled}
              onColor="text-red-400 border-red-500/40"
            />
            <Chip
              label={`${health?.running_strategies ?? 0} running`}
              on={(health?.running_strategies ?? 0) > 0}
              onColor="text-amber-400 border-amber-500/40"
            />
          </div>
          <button
            className="btn bg-red-600/90 font-bold tracking-wide text-white shadow-lg shadow-red-900/40 hover:bg-red-500"
            onClick={() => setKillOpen(true)}
          >
            ⏻ KILL SWITCH
          </button>
        </header>

        <main className="flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={killOpen}
        title="Activate kill switch?"
        onClose={() => setKillOpen(false)}
        onConfirm={killAll}
        confirmLabel={killing ? 'Halting…' : 'Yes, halt everything'}
        danger
      >
        This immediately <strong className="text-red-400">flattens all open positions</strong> and
        stops every running strategy (paper and live). Use it when something is going wrong.
      </ConfirmDialog>
    </div>
  )
}
