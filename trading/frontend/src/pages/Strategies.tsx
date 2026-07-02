import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModeBadge, StatusBadge } from '../components/Badges'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StrategyControls } from '../components/StrategyControls'
import { useToast } from '../components/Toast'
import { api, type Strategy } from '../lib/api'
import { fmtDateTime } from '../lib/format'
import { usePoll } from '../lib/usePoll'

export function Strategies() {
  const toast = useToast()
  const { data: strategies, refresh } = usePoll(() => api.strategies(), 5000)
  const { data: types } = usePoll(() => api.strategyTypes(), 60000)
  const [toDelete, setToDelete] = useState<Strategy | null>(null)

  const typeName = (key: string) => types?.find((t) => t.key === key)?.name ?? key

  const doDelete = async () => {
    if (!toDelete) return
    try {
      await api.deleteStrategy(toDelete.id)
      toast.success(`Deleted "${toDelete.name}"`)
      setToDelete(null)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Strategies</h1>
        <Link to="/strategies/new" className="btn-primary">+ New strategy</Link>
      </div>

      {strategies && strategies.length === 0 && (
        <div className="card p-10 text-center text-slate-500">
          No strategies yet.{' '}
          <Link to="/strategies/new" className="text-amber-400 hover:underline">Create your first one</Link>
          {' '}— it starts in safe paper mode.
        </div>
      )}

      <div className="space-y-3">
        {(strategies ?? []).map((s) => (
          <div key={s.id} className="card flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/strategies/${s.id}`}
                  className="truncate text-base font-semibold text-slate-100 hover:text-amber-400"
                >
                  {s.name}
                </Link>
                <ModeBadge mode={s.mode} />
                <StatusBadge status={s.status} errorMessage={s.error_message} />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {typeName(s.strategy_type)} · {s.config.data.timeframe} ·{' '}
                {s.config.universe.symbols.length} symbols · v{s.config_version} · updated{' '}
                {fmtDateTime(s.updated_at)}
              </div>
              {s.status === 'error' && s.error_message && (
                <div className="mt-1 truncate text-xs text-red-400" title={s.error_message}>
                  {s.error_message}
                </div>
              )}
            </div>
            <StrategyControls strategy={s} onChanged={refresh} />
            <div className="flex items-center gap-1.5">
              <Link to={`/strategies/${s.id}/edit`} className="btn-secondary px-2.5 py-1 text-xs">Edit</Link>
              <button
                className="btn-secondary px-2.5 py-1 text-xs text-red-400 hover:bg-red-950"
                onClick={() => setToDelete(s)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name}"?`}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        confirmLabel="Delete"
        danger
      >
        This permanently removes the strategy and stops it if running. Orders, trades and logs
        remain in history.
      </ConfirmDialog>
    </div>
  )
}
