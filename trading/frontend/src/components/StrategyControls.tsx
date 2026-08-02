import { useState } from 'react'
import { api, type Strategy } from '../lib/api'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'

/** Start / pause / stop buttons with the flatten-on-stop and confirm-live flows. */
export function StrategyControls({ strategy, onChanged, size = 'sm' }: {
  strategy: Strategy
  onChanged: () => void
  size?: 'sm' | 'md'
}) {
  const toast = useToast()
  const [stopOpen, setStopOpen] = useState(false)
  const [liveStartOpen, setLiveStartOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(okMsg)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const start = () => {
    if (strategy.mode === 'live') setLiveStartOpen(true)
    else run(() => api.startStrategy(strategy.id), `Started "${strategy.name}"`)
  }

  const pad = size === 'md' ? '' : 'px-2.5 py-1 text-xs'
  const canStart = strategy.status === 'stopped' || strategy.status === 'error' || strategy.status === 'paused'
  const canPause = strategy.status === 'running'
  const canStop = strategy.status === 'running' || strategy.status === 'paused'

  return (
    <div className="flex items-center gap-1.5">
      {canStart && (
        <button className={`btn-success ${pad}`} disabled={busy} onClick={start}>
          ▶ Start
        </button>
      )}
      {canPause && (
        <button
          className={`btn-secondary ${pad}`}
          disabled={busy}
          onClick={() => run(() => api.pauseStrategy(strategy.id), `Paused "${strategy.name}"`)}
        >
          ⏸ Pause
        </button>
      )}
      {canStop && (
        <button className={`btn-danger ${pad}`} disabled={busy} onClick={() => setStopOpen(true)}>
          ⏹ Stop
        </button>
      )}

      <ConfirmDialog
        open={stopOpen}
        title={`Stop "${strategy.name}"?`}
        onClose={() => setStopOpen(false)}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setStopOpen(false)}>Cancel</button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setStopOpen(false)
                run(() => api.stopStrategy(strategy.id, false), `Stopped "${strategy.name}" (positions kept)`)
              }}
            >
              Stop only
            </button>
            <button
              className="btn-danger"
              disabled={busy}
              onClick={() => {
                setStopOpen(false)
                run(() => api.stopStrategy(strategy.id, true), `Stopped "${strategy.name}" and flattened`)
              }}
            >
              Stop &amp; flatten
            </button>
          </>
        }
      >
        Do you want to <strong>flatten</strong> (exit) any open positions as part of stopping, or
        leave them open?
      </ConfirmDialog>

      <ConfirmDialog
        open={liveStartOpen}
        title="Start LIVE strategy?"
        onClose={() => setLiveStartOpen(false)}
        onConfirm={() => {
          setLiveStartOpen(false)
          run(() => api.startStrategy(strategy.id, true), `Started LIVE "${strategy.name}"`)
        }}
        confirmLabel="Start live trading"
        danger
      >
        <p>
          <strong className="text-red-400">"{strategy.name}" is in LIVE mode.</strong> Starting it
          will place real orders with real money through your Zerodha account.
        </p>
      </ConfirmDialog>
    </div>
  )
}
