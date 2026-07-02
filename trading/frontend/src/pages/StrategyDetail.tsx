import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ModeBadge, StatusBadge } from '../components/Badges'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EquityChart } from '../components/EquityChart'
import { LogsList } from '../components/LogsList'
import { PositionsTable } from '../components/PositionsTable'
import { StrategyControls } from '../components/StrategyControls'
import { useToast } from '../components/Toast'
import { api, type ConfigRevision } from '../lib/api'
import { fmtDateTime, fmtInr, fmtSigned, pnlClass } from '../lib/format'
import { usePoll } from '../lib/usePoll'

type Tab = 'positions' | 'orders' | 'trades' | 'logs' | 'revisions'

const ORDER_STATUS_CLASS: Record<string, string> = {
  COMPLETE: 'text-emerald-400',
  REJECTED: 'text-red-400',
  CANCELLED: 'text-slate-500',
}

export function StrategyDetail() {
  const { id } = useParams()
  const strategyId = Number(id)
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('positions')
  const [resetOpen, setResetOpen] = useState(false)
  const [openRevision, setOpenRevision] = useState<number | null>(null)

  const { data: strategy, refresh } = usePoll(() => api.strategy(strategyId), 5000, [strategyId])
  const { data: pnl } = usePoll(() => api.pnl(strategyId), 5000, [strategyId])
  const { data: positions } = usePoll(() => api.positions(strategyId), 5000, [strategyId])
  const { data: orders } = usePoll(() => api.orders(strategyId), 5000, [strategyId])
  const { data: trades } = usePoll(() => api.trades(strategyId), 5000, [strategyId])
  const { data: logs } = usePoll(() => api.logs({ strategyId, limit: 200 }), 5000, [strategyId])
  const { data: revisions, refresh: refreshRevisions } = usePoll<ConfigRevision[]>(
    () => api.revisions(strategyId), 30000, [strategyId],
  )

  const doReset = async () => {
    try {
      await api.resetPaper(strategyId)
      toast.success('Paper account reset')
      setResetOpen(false)
      refresh()
      refreshRevisions()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  if (!strategy) {
    return <div className="py-20 text-center text-slate-500">Loading strategy…</div>
  }

  const equity = pnl && pnl.length ? pnl[pnl.length - 1] : null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'positions', label: `Positions (${positions?.length ?? 0})` },
    { key: 'orders', label: `Orders (${orders?.length ?? 0})` },
    { key: 'trades', label: `Trades (${trades?.length ?? 0})` },
    { key: 'logs', label: 'Logs' },
    { key: 'revisions', label: `Config history (${revisions?.length ?? 0})` },
  ]

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/strategies" className="text-slate-500 hover:text-slate-300">←</Link>
            <h1 className="text-xl font-bold text-slate-100">{strategy.name}</h1>
            <ModeBadge mode={strategy.mode} />
            <StatusBadge status={strategy.status} errorMessage={strategy.error_message} />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {strategy.strategy_type} · {strategy.config.data.timeframe} ·{' '}
            {strategy.config.universe.symbols.join(', ')} · config v{strategy.config_version}
          </div>
          {strategy.status === 'error' && strategy.error_message && (
            <div className="mt-1 text-sm text-red-400">{strategy.error_message}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StrategyControls strategy={strategy} onChanged={refresh} size="md" />
          <Link to={`/strategies/${strategy.id}/edit`} className="btn-secondary">Edit config</Link>
          {strategy.mode === 'paper' && (
            <button
              className="btn-secondary text-amber-400"
              disabled={strategy.status === 'running' || strategy.status === 'paused'}
              title={strategy.status === 'running' || strategy.status === 'paused' ? 'Stop the strategy first' : undefined}
              onClick={() => setResetOpen(true)}
            >
              Reset paper
            </button>
          )}
        </div>
      </div>

      {/* equity */}
      <div className="card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Equity</h2>
          {equity && (
            <div className="flex items-baseline gap-4 text-sm">
              <span className="text-lg font-bold text-slate-100">{fmtInr(equity.equity)}</span>
              <span className={pnlClass(equity.realized_pnl)}>
                real {fmtSigned(equity.realized_pnl)}
              </span>
              <span className={pnlClass(equity.unrealized_pnl)}>
                unreal {fmtSigned(equity.unrealized_pnl)}
              </span>
            </div>
          )}
        </div>
        <EquityChart data={(pnl ?? []).map((p) => ({ at: p.at, equity: p.equity }))} height={240} />
      </div>

      {/* tabs */}
      <div className="card">
        <div className="flex flex-wrap gap-1 border-b border-slate-800 px-2 pt-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t.key
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'positions' && <PositionsTable positions={positions ?? []} />}

        {tab === 'orders' && (
          <div className="overflow-x-auto">
            {!orders?.length ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">No orders</div>
            ) : (
              <table className="w-full">
                <thead className="border-b border-slate-800">
                  <tr>
                    <th className="th">Time</th>
                    <th className="th">Symbol</th>
                    <th className="th">Side</th>
                    <th className="th text-right">Qty (filled)</th>
                    <th className="th">Type</th>
                    <th className="th text-right">Avg price</th>
                    <th className="th">Status</th>
                    <th className="th">Tag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-800/40">
                      <td className="td whitespace-nowrap text-slate-400">{fmtDateTime(o.placed_at)}</td>
                      <td className="td font-medium text-slate-100">{o.symbol}</td>
                      <td className={`td font-semibold ${o.transaction_type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {o.transaction_type}
                      </td>
                      <td className="td text-right tabular-nums">{o.quantity} ({o.filled_quantity})</td>
                      <td className="td text-slate-400">{o.order_type} {o.product}</td>
                      <td className="td text-right tabular-nums">{o.average_price ? fmtInr(o.average_price) : '—'}</td>
                      <td className={`td text-xs font-semibold ${ORDER_STATUS_CLASS[o.status] ?? 'text-amber-400'}`}
                          title={o.status_message || undefined}>
                        {o.status}
                      </td>
                      <td className="td text-xs text-slate-500">{o.tag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'trades' && (
          <div className="overflow-x-auto">
            {!trades?.length ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">No trades</div>
            ) : (
              <table className="w-full">
                <thead className="border-b border-slate-800">
                  <tr>
                    <th className="th">Time</th>
                    <th className="th">Symbol</th>
                    <th className="th">Side</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Price</th>
                    <th className="th text-right">Charges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {trades.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="td whitespace-nowrap text-slate-400">{fmtDateTime(t.executed_at)}</td>
                      <td className="td font-medium text-slate-100">{t.symbol}</td>
                      <td className={`td font-semibold ${t.transaction_type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.transaction_type}
                      </td>
                      <td className="td text-right tabular-nums">{t.quantity}</td>
                      <td className="td text-right tabular-nums">{fmtInr(t.price)}</td>
                      <td className="td text-right tabular-nums text-slate-500">{fmtInr(t.charges)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'logs' && (
          <div className="max-h-[32rem] overflow-y-auto">
            <LogsList logs={logs ?? []} />
          </div>
        )}

        {tab === 'revisions' && (
          <div className="divide-y divide-slate-800/70">
            {!revisions?.length && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">No revisions</div>
            )}
            {(revisions ?? []).map((r) => (
              <div key={r.version} className="px-4 py-3">
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setOpenRevision(openRevision === r.version ? null : r.version)}
                >
                  <span className="text-sm font-medium text-slate-200">
                    v{r.version}
                    {r.version === strategy.config_version && (
                      <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        CURRENT
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500">
                    {fmtDateTime(r.created_at)} {openRevision === r.version ? '▲' : '▼'}
                  </span>
                </button>
                {openRevision === r.version && (
                  <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-300">
                    {JSON.stringify(r.config, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Reset paper account?"
        onClose={() => setResetOpen(false)}
        onConfirm={doReset}
        confirmLabel="Reset"
        danger
      >
        This resets the strategy's virtual cash and paper positions back to the starting state.
        Trade history stays in the logs.
      </ConfirmDialog>
    </div>
  )
}
