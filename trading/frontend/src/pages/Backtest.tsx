import { useEffect, useMemo, useState } from 'react'
import { ConfigForm } from '../components/ConfigForm'
import { EquityChart } from '../components/EquityChart'
import { useToast } from '../components/Toast'
import {
  api,
  defaultConfig,
  type BacktestStats,
  type BacktestTrade,
  type EquityPoint,
  type Strategy,
  type StrategyConfig,
  type StrategyType,
} from '../lib/api'
import { fmtDate, fmtDateTime, fmtInr, fmtPct, fmtSigned, pnlClass } from '../lib/format'
import { usePoll } from '../lib/usePoll'

interface DisplayResult {
  label: string
  stats: BacktestStats
  equity_curve: EquityPoint[]
  trades: BacktestTrade[]
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function StatTile({ label, value, className = 'text-slate-100' }: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${className}`}>{value}</div>
    </div>
  )
}

function StatsGrid({ stats }: { stats: BacktestStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <StatTile
        label="Total return"
        value={fmtPct(stats.total_return_pct)}
        className={pnlClass(stats.total_return_pct)}
      />
      <StatTile label="Final equity" value={fmtInr(stats.final_equity, 0)} />
      <StatTile label="Trades" value={String(stats.num_trades)} />
      <StatTile label="Win rate" value={`${stats.win_rate_pct.toFixed(1)}%`} />
      <StatTile
        label="Avg trade P&L"
        value={fmtSigned(stats.avg_trade_pnl)}
        className={pnlClass(stats.avg_trade_pnl)}
      />
      <StatTile label="Best trade" value={fmtSigned(stats.best_trade)} className="text-emerald-400" />
      <StatTile label="Worst trade" value={fmtSigned(stats.worst_trade)} className="text-red-400" />
      <StatTile label="Max drawdown" value={`${stats.max_drawdown_pct.toFixed(2)}%`} className="text-red-400" />
      <StatTile label="Sharpe (est.)" value={stats.sharpe_estimate.toFixed(2)} />
      <StatTile label="Charges" value={fmtInr(stats.total_charges, 0)} className="text-amber-400" />
      <StatTile label="Starting cash" value={fmtInr(stats.starting_cash, 0)} />
    </div>
  )
}

export function Backtest() {
  const toast = useToast()
  const [types, setTypes] = useState<StrategyType[]>([])
  const [symbols, setSymbols] = useState<string[]>([])
  const [indicators, setIndicators] = useState<string[]>([])
  const [strategies, setStrategies] = useState<Strategy[]>([])

  const [strategyType, setStrategyType] = useState('')
  const [config, setConfig] = useState<StrategyConfig>(defaultConfig())
  const [prefillId, setPrefillId] = useState('')
  const [fromDate, setFromDate] = useState(isoDaysAgo(30))
  const [toDate, setToDate] = useState(isoDaysAgo(0))
  const [startingCash, setStartingCash] = useState(1000000)

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DisplayResult | null>(null)
  const { data: runs, refresh: refreshRuns } = usePoll(() => api.backtestRuns(), 30000)

  useEffect(() => {
    let alive = true
    Promise.all([api.strategyTypes(), api.symbols(), api.indicators(), api.strategies()])
      .then(([t, s, i, st]) => {
        if (!alive) return
        setTypes(t)
        setSymbols(s.symbols)
        setIndicators(i.indicators)
        setStrategies(st)
        if (t.length) {
          setStrategyType((cur) => cur || t[0].key)
          setConfig((c) =>
            Object.keys(c.params).length ? c : { ...c, params: { ...t[0].default_params } })
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : String(e)))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onTypeChange = (key: string) => {
    setStrategyType(key)
    setPrefillId('')
    const t = types.find((x) => x.key === key)
    if (t) setConfig((c) => ({ ...c, params: { ...t.default_params } }))
  }

  const prefill = (id: string) => {
    setPrefillId(id)
    const s = strategies.find((x) => x.id === Number(id))
    if (s) {
      setStrategyType(s.strategy_type)
      setConfig(s.config)
      toast.push(`Prefilled from "${s.name}"`, 'info')
    }
  }

  const run = async () => {
    setRunning(true)
    try {
      const res = await api.runBacktest({
        strategy_type: strategyType,
        config,
        from_date: fromDate,
        to_date: toDate,
        starting_cash: startingCash,
      })
      setResult({
        label: `Run #${res.id} — ${strategyType} · ${fromDate} → ${toDate}`,
        stats: res.stats,
        equity_curve: res.equity_curve,
        trades: res.trades,
      })
      refreshRuns()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const loadRun = async (id: number) => {
    try {
      const r = await api.backtestRun(id)
      setResult({
        label: `Run #${r.id} — ${r.strategy_type} · ${r.from_date} → ${r.to_date}`,
        stats: r.stats,
        equity_curve: r.equity_curve,
        trades: r.trades,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const runControls = useMemo(() => (
    <div className="card sticky top-16 z-20 flex flex-wrap items-end gap-4 border-amber-500/20 p-4">
      <div>
        <label className="label">Prefill from strategy</label>
        <select className="input w-56" value={prefillId} onChange={(e) => prefill(e.target.value)}>
          <option value="">— none (blank config) —</option>
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">From</label>
        <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </div>
      <div>
        <label className="label">To</label>
        <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>
      <div>
        <label className="label">Starting cash (₹)</label>
        <input
          type="number"
          className="input w-36"
          value={startingCash}
          min={10000}
          step={10000}
          onChange={(e) => setStartingCash(Number(e.target.value) || 1000000)}
        />
      </div>
      <button className="btn-primary h-9 px-5" disabled={running} onClick={run}>
        {running ? '⏳ Running…' : '▶ Run backtest'}
      </button>
    </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [prefillId, strategies, fromDate, toDate, startingCash, running, strategyType, config])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Backtest</h1>

      {runControls}

      {/* results */}
      {result && (
        <div className="card space-y-4 border-emerald-500/20 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{result.label}</h2>
          <StatsGrid stats={result.stats} />
          <EquityChart data={result.equity_curve} height={260} baseline={result.stats.starting_cash} />
          <div className="max-h-96 overflow-auto rounded-md border border-slate-800">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-slate-800 bg-slate-900">
                <tr>
                  <th className="th">Time</th>
                  <th className="th">Symbol</th>
                  <th className="th">Side</th>
                  <th className="th text-right">Qty</th>
                  <th className="th text-right">Price</th>
                  <th className="th text-right">P&L</th>
                  <th className="th">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {result.trades.map((t, i) => (
                  <tr key={i} className="hover:bg-slate-800/40">
                    <td className="td whitespace-nowrap text-slate-400">{fmtDateTime(t.at)}</td>
                    <td className="td font-medium text-slate-100">{t.symbol}</td>
                    <td className={`td font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.side}
                    </td>
                    <td className="td text-right tabular-nums">{t.quantity}</td>
                    <td className="td text-right tabular-nums">{fmtInr(t.price)}</td>
                    <td className={`td text-right font-semibold tabular-nums ${t.pnl != null ? pnlClass(t.pnl) : 'text-slate-500'}`}>
                      {t.pnl != null ? fmtSigned(t.pnl) : '—'}
                    </td>
                    <td className="td text-xs text-slate-500">{t.reason}</td>
                  </tr>
                ))}
                {!result.trades.length && (
                  <tr><td className="td py-6 text-center text-slate-500" colSpan={7}>No trades in this run</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* config form */}
      <ConfigForm
        types={types}
        symbols={symbols}
        indicators={indicators}
        strategyType={strategyType}
        onTypeChange={onTypeChange}
        config={config}
        onChange={setConfig}
      />

      {/* past runs */}
      <div className="card">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Past runs</h2>
        </div>
        {!runs?.length ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">No backtests yet</div>
        ) : (
          <ul className="divide-y divide-slate-800/70">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  className="flex w-full flex-wrap items-center gap-4 px-4 py-3 text-left hover:bg-slate-800/40"
                  onClick={() => loadRun(r.id)}
                >
                  <span className="w-14 text-sm font-semibold text-amber-400">#{r.id}</span>
                  <span className="w-44 text-sm text-slate-200">{r.strategy_type}</span>
                  <span className="text-xs text-slate-500">{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</span>
                  <span className={`ml-auto text-sm font-bold tabular-nums ${pnlClass(r.stats.total_return_pct)}`}>
                    {fmtPct(r.stats.total_return_pct)}
                  </span>
                  <span className="text-xs text-slate-500">{r.stats.num_trades} trades</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
