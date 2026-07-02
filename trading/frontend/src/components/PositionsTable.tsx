import type { Position } from '../lib/api'
import { fmtInr, fmtSigned, pnlClass } from '../lib/format'

export function unrealizedPnl(p: Position): number {
  return (p.last_price - p.average_price) * p.quantity
}

export function PositionsTable({ positions, showStrategy, strategyNames }: {
  positions: Position[]
  showStrategy?: boolean
  strategyNames?: Record<number, string>
}) {
  if (!positions.length) {
    return <div className="px-4 py-6 text-center text-sm text-slate-500">No open positions</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-slate-800">
          <tr>
            <th className="th">Symbol</th>
            {showStrategy && <th className="th">Strategy</th>}
            <th className="th">Product</th>
            <th className="th text-right">Qty</th>
            <th className="th text-right">Avg</th>
            <th className="th text-right">LTP</th>
            <th className="th text-right">Unrealized</th>
            <th className="th text-right">SL / TP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {positions.map((p) => {
            const upnl = unrealizedPnl(p)
            return (
              <tr key={p.id} className="hover:bg-slate-800/40">
                <td className="td font-medium text-slate-100">
                  {p.symbol}
                  <span className={`ml-2 text-xs ${p.quantity > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {p.quantity > 0 ? 'LONG' : 'SHORT'}
                  </span>
                </td>
                {showStrategy && (
                  <td className="td text-slate-400">
                    {p.strategy_id != null ? strategyNames?.[p.strategy_id] ?? `#${p.strategy_id}` : '—'}
                  </td>
                )}
                <td className="td text-slate-400">{p.product}</td>
                <td className="td text-right tabular-nums">{p.quantity}</td>
                <td className="td text-right tabular-nums">{fmtInr(p.average_price)}</td>
                <td className="td text-right tabular-nums">{fmtInr(p.last_price)}</td>
                <td className={`td text-right font-semibold tabular-nums ${pnlClass(upnl)}`}>
                  {fmtSigned(upnl)}
                </td>
                <td className="td text-right text-xs tabular-nums text-slate-500">
                  {p.stop_loss > 0 ? fmtInr(p.stop_loss) : '—'} / {p.take_profit > 0 ? fmtInr(p.take_profit) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
