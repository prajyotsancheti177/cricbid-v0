import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ModeBadge, StatusBadge } from '../components/Badges'
import { EquityChart } from '../components/EquityChart'
import { LogsList } from '../components/LogsList'
import { PositionsTable } from '../components/PositionsTable'
import { api, type EquityPoint, type PnlPoint } from '../lib/api'
import { fmtInr, fmtSigned, pnlClass } from '../lib/format'
import { usePoll } from '../lib/usePoll'

/** Fold per-strategy snapshots into one combined curve (sum of last-known equities). */
function combinedEquity(points: PnlPoint[]): EquityPoint[] {
  const last = new Map<number | string, number>()
  const out: EquityPoint[] = []
  for (const p of points) {
    last.set(p.strategy_id ?? 'global', p.equity)
    let sum = 0
    last.forEach((v) => { sum += v })
    out.push({ at: p.at, equity: sum })
  }
  return out
}

export function Dashboard() {
  const { data: pnl } = usePoll(() => api.pnl(), 5000)
  const { data: positions } = usePoll(() => api.positions(), 5000)
  const { data: tradeLogs } = usePoll(() => api.logs({ level: 'TRADE', limit: 30 }), 5000)
  const { data: account } = usePoll(() => api.account(), 5000)
  const { data: strategies } = usePoll(() => api.strategies(), 5000)

  const curve = useMemo(() => combinedEquity(pnl ?? []), [pnl])
  const strategyNames = useMemo(() => {
    const m: Record<number, string> = {}
    for (const s of strategies ?? []) m[s.id] = s.name
    return m
  }, [strategies])
  const strategyById = useMemo(() => {
    const m = new Map((strategies ?? []).map((s) => [s.id, s]))
    return m
  }, [strategies])

  const paperAccounts = Object.entries(account?.paper_accounts ?? {})

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>

      {/* equity curve */}
      <div className="card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Combined equity — all strategies
          </h2>
          {curve.length > 0 && (
            <span className="text-lg font-bold text-slate-100">
              {fmtInr(curve[curve.length - 1].equity)}
            </span>
          )}
        </div>
        <EquityChart data={curve} height={280} />
      </div>

      {/* paper account cards */}
      {paperAccounts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paperAccounts.map(([sid, acct]) => {
            const s = strategyById.get(Number(sid))
            const totalPnl = acct.realized_pnl + acct.unrealized_pnl
            return (
              <Link
                key={sid}
                to={`/strategies/${sid}`}
                className="card block p-4 transition-colors hover:border-slate-600"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-semibold text-slate-100">
                    {s?.name ?? `Strategy #${sid}`}
                  </span>
                  <div className="flex gap-1.5">
                    {s && <ModeBadge mode={s.mode} />}
                    {s && <StatusBadge status={s.status} errorMessage={s.error_message} />}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Equity</div>
                    <div className="font-semibold tabular-nums text-slate-100">{fmtInr(acct.equity)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Cash</div>
                    <div className="tabular-nums text-slate-300">{fmtInr(acct.cash)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">P&amp;L (real + unreal)</div>
                    <div className={`font-semibold tabular-nums ${pnlClass(totalPnl)}`}>{fmtSigned(totalPnl)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Charges</div>
                    <div className="tabular-nums text-slate-400">{fmtInr(acct.total_charges)}</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* open positions */}
        <div className="card">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Open positions</h2>
          </div>
          <PositionsTable positions={positions ?? []} showStrategy strategyNames={strategyNames} />
        </div>

        {/* trade logs */}
        <div className="card">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Recent trades (log)</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <LogsList logs={tradeLogs ?? []} strategyNames={strategyNames} />
          </div>
        </div>
      </div>
    </div>
  )
}
