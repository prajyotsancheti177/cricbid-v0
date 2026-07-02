import { useState } from 'react'
import { useToast } from '../components/Toast'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800/70 py-2.5 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${ok ? 'text-emerald-400' : 'text-slate-500'}`}>
        {value}
      </span>
    </div>
  )
}

export function Settings() {
  const toast = useToast()
  const { data: auth, refresh } = usePoll(() => api.authStatus(), 5000)
  const [requestToken, setRequestToken] = useState('')
  const [busy, setBusy] = useState(false)

  const getLoginUrl = async () => {
    try {
      const { login_url } = await api.kiteLoginUrl()
      window.open(login_url, '_blank', 'noopener')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const exchangeToken = async () => {
    if (!requestToken.trim()) {
      toast.error('Paste the request_token first')
      return
    }
    setBusy(true)
    try {
      const res = await api.kiteToken(requestToken.trim())
      if (res.connected) {
        toast.success(`Kite connected as ${res.user_id}`)
        setRequestToken('')
        refresh()
      } else {
        toast.error('Token exchanged but the session did not connect')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Settings</h1>

      {/* Kite connect */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-500">
          Zerodha Kite connection
        </h2>
        <div className="mt-3">
          <Row
            label="API key configured"
            value={auth?.kite_configured ? 'Yes' : 'No'}
            ok={!!auth?.kite_configured}
          />
          <Row
            label="Kite session"
            value={auth?.kite_connected ? 'Connected' : 'Not connected'}
            ok={!!auth?.kite_connected}
          />
          <Row
            label="Market data feed"
            value={auth?.feed === 'kite' ? 'Kite (live)' : 'Simulated'}
            ok={auth?.feed === 'kite'}
          />
        </div>

        <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
          Kite access tokens <strong className="text-amber-400">expire every day around 6:00 AM IST</strong>,
          so connecting is a morning ritual: get the login URL, sign in on Zerodha, then copy the{' '}
          <code className="rounded bg-slate-800 px-1 text-sky-300">request_token</code> query parameter
          from the redirect URL and paste it below. Paper trading works fully without a Kite session
          (simulated feed).
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            className="btn-secondary self-start"
            onClick={getLoginUrl}
            disabled={!auth?.kite_configured}
            title={auth?.kite_configured ? undefined : 'Set TRADING_KITE_API_KEY / SECRET in the backend env first'}
          >
            ↗ Get Kite login URL (opens new tab)
          </button>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Paste request_token from the redirect URL"
              value={requestToken}
              onChange={(e) => setRequestToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') exchangeToken() }}
            />
            <button className="btn-primary shrink-0" disabled={busy} onClick={exchangeToken}>
              {busy ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </div>
      </div>

      {/* live trading master switch */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-500">
          Live trading master switch
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-sm font-bold ${
              auth?.live_trading_enabled
                ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-slate-700 text-slate-500'
            }`}
          >
            {auth?.live_trading_enabled ? 'ENABLED' : 'DISABLED'}
          </span>
          <span className="text-xs text-slate-500">(read-only — set via backend environment)</span>
        </div>
        <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
          This is a global safety gate on top of per-strategy live mode. To enable real-money
          trading, set{' '}
          <code className="rounded bg-slate-800 px-1 text-sky-300">TRADING_LIVE_TRADING_ENABLED=true</code>{' '}
          in <code className="rounded bg-slate-800 px-1 text-sky-300">trading/backend/.env</code> and
          restart the backend. Even then, each strategy must individually be switched to LIVE mode
          and each live start must be confirmed.
        </div>
      </div>
    </div>
  )
}
