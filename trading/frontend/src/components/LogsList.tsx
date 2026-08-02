import type { LogEntry } from '../lib/api'
import { fmtTime } from '../lib/format'
import { LevelBadge } from './Badges'

export function LogsList({ logs, strategyNames }: {
  logs: LogEntry[]
  strategyNames?: Record<number, string>
}) {
  if (!logs.length) {
    return <div className="px-4 py-6 text-center text-sm text-slate-500">No log entries</div>
  }
  return (
    <ul className="divide-y divide-slate-800/70 font-mono text-xs">
      {logs.map((l) => (
        <li key={l.id} className="flex items-baseline gap-3 px-4 py-1.5 hover:bg-slate-800/40">
          <span className="shrink-0 tabular-nums text-slate-500">{fmtTime(l.at)}</span>
          <LevelBadge level={l.level} />
          {strategyNames && l.strategy_id != null && (
            <span className="shrink-0 text-amber-500/80">
              {strategyNames[l.strategy_id] ?? `#${l.strategy_id}`}
            </span>
          )}
          <span className="min-w-0 break-words text-slate-300">{l.message}</span>
        </li>
      ))}
    </ul>
  )
}
