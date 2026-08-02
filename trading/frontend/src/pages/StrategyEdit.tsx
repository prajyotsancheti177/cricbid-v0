import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ModeBadge } from '../components/Badges'
import { ConfigForm } from '../components/ConfigForm'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import {
  api,
  defaultConfig,
  type Strategy,
  type StrategyConfig,
  type StrategyType,
} from '../lib/api'

export function StrategyEdit() {
  const { id } = useParams()
  const editId = id ? Number(id) : null
  const navigate = useNavigate()
  const toast = useToast()

  const [types, setTypes] = useState<StrategyType[]>([])
  const [symbols, setSymbols] = useState<string[]>([])
  const [indicators, setIndicators] = useState<string[]>([])
  const [loaded, setLoaded] = useState(editId === null)

  const [existing, setExisting] = useState<Strategy | null>(null)
  const [name, setName] = useState('')
  const [strategyType, setStrategyType] = useState('')
  const [config, setConfig] = useState<StrategyConfig>(defaultConfig())
  const [saving, setSaving] = useState(false)
  const [liveModalOpen, setLiveModalOpen] = useState(false)
  const [liveConfirmText, setLiveConfirmText] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([api.strategyTypes(), api.symbols(), api.indicators()])
      .then(([t, s, i]) => {
        if (!alive) return
        setTypes(t)
        setSymbols(s.symbols)
        setIndicators(i.indicators)
        if (editId === null && t.length) {
          const first = t[0]
          setStrategyType((st) => st || first.key)
          setConfig((c) =>
            Object.keys(c.params).length ? c : { ...c, params: { ...first.default_params } })
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : String(e)))
    if (editId !== null) {
      api.strategy(editId)
        .then((s) => {
          if (!alive) return
          setExisting(s)
          setName(s.name)
          setStrategyType(s.strategy_type)
          setConfig(s.config)
          setLoaded(true)
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : String(e)))
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  const onTypeChange = (key: string) => {
    setStrategyType(key)
    const t = types.find((x) => x.key === key)
    if (t) setConfig((c) => ({ ...c, params: { ...t.default_params } }))
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error('Give the strategy a name')
      return
    }
    setSaving(true)
    try {
      if (editId === null) {
        const created = await api.createStrategy({
          name: name.trim(),
          strategy_type: strategyType,
          mode: 'paper',
          config,
        })
        toast.success(`Created "${created.name}" in paper mode`)
        navigate(`/strategies/${created.id}`)
      } else {
        const updated = await api.updateStrategy(editId, { name: name.trim(), config })
        setExisting(updated)
        setConfig(updated.config)
        toast.success(`Saved "${updated.name}" (config v${updated.config_version})`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const switchMode = async (mode: 'paper' | 'live') => {
    if (!existing) return
    try {
      const updated = await api.updateStrategy(existing.id, { mode }, mode === 'live')
      setExisting(updated)
      setLiveModalOpen(false)
      setLiveConfirmText('')
      toast.success(mode === 'live'
        ? `"${updated.name}" is now LIVE — it will place real orders when started`
        : `"${updated.name}" is back in paper mode`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  if (!loaded) {
    return <div className="py-20 text-center text-slate-500">Loading strategy…</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            {editId === null ? 'New strategy' : `Edit: ${existing?.name ?? ''}`}
          </h1>
          {editId === null && (
            <p className="mt-1 text-sm text-slate-500">
              New strategies always start in <span className="font-semibold text-sky-400">paper</span>{' '}
              mode; you can switch to live after testing.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {existing && (
            <Link to={`/strategies/${existing.id}`} className="btn-secondary">← Detail</Link>
          )}
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : editId === null ? 'Create strategy' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* mode switch (edit only) */}
      {existing && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Trading mode</span>
            <ModeBadge mode={existing.mode} />
            {existing.status !== 'stopped' && (
              <span className="text-xs text-amber-500">stop the strategy to change mode</span>
            )}
          </div>
          {existing.mode === 'paper' ? (
            <button
              className="btn-danger"
              disabled={existing.status !== 'stopped' && existing.status !== 'error'}
              onClick={() => setLiveModalOpen(true)}
            >
              Switch to LIVE…
            </button>
          ) : (
            <button
              className="btn-secondary"
              disabled={existing.status !== 'stopped' && existing.status !== 'error'}
              onClick={() => switchMode('paper')}
            >
              Switch back to paper
            </button>
          )}
        </div>
      )}

      <ConfigForm
        types={types}
        symbols={symbols}
        indicators={indicators}
        strategyType={strategyType}
        onTypeChange={editId === null ? onTypeChange : undefined}
        name={name}
        onNameChange={setName}
        config={config}
        onChange={setConfig}
      />

      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : editId === null ? 'Create strategy' : 'Save changes'}
        </button>
      </div>

      {/* scary live-mode modal */}
      <ConfirmDialog
        open={liveModalOpen}
        title="⚠ Switch to LIVE trading?"
        onClose={() => { setLiveModalOpen(false); setLiveConfirmText('') }}
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => { setLiveModalOpen(false); setLiveConfirmText('') }}
            >
              Cancel
            </button>
            <button
              className="btn-danger"
              disabled={liveConfirmText !== (existing?.name ?? '')}
              onClick={() => switchMode('live')}
            >
              I understand — go LIVE
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-md border border-red-500/40 bg-red-950/40 p-3 text-red-300">
            In LIVE mode this strategy places <strong>real orders with real money</strong> through
            your Zerodha account the moment it is started. Losses are real. Make sure it has been
            tested thoroughly in paper mode and backtests.
          </p>
          <p>
            Type the strategy name <code className="rounded bg-slate-800 px-1.5 py-0.5 text-amber-400">{existing?.name}</code>{' '}
            to confirm:
          </p>
          <input
            className="input"
            value={liveConfirmText}
            onChange={(e) => setLiveConfirmText(e.target.value)}
            placeholder={existing?.name}
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}
