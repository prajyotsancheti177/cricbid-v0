import type { StrategyMode, StrategyStatus } from '../lib/api'

export function StatusBadge({ status, errorMessage }: { status: StrategyStatus; errorMessage?: string }) {
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold'
  switch (status) {
    case 'running':
      return (
        <span className={`${base} bg-emerald-500/15 text-emerald-400`}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          RUNNING
        </span>
      )
    case 'paused':
      return (
        <span className={`${base} bg-amber-500/15 text-amber-400`}>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          PAUSED
        </span>
      )
    case 'error':
      return (
        <span className={`${base} bg-red-500/15 text-red-400`} title={errorMessage || 'error'}>
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          ERROR
        </span>
      )
    default:
      return (
        <span className={`${base} bg-slate-700/40 text-slate-400`}>
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          STOPPED
        </span>
      )
  }
}

export function ModeBadge({ mode }: { mode: StrategyMode }) {
  return mode === 'live' ? (
    <span className="inline-flex rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-400">
      LIVE
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-400">
      PAPER
    </span>
  )
}

export function LevelBadge({ level }: { level: string }) {
  const style =
    level === 'ERROR' ? 'text-red-400' :
    level === 'WARN' ? 'text-amber-400' :
    level === 'TRADE' ? 'text-emerald-400' :
    'text-slate-500'
  return <span className={`w-12 shrink-0 text-xs font-bold ${style}`}>{level}</span>
}
