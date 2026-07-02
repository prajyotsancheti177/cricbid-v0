import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  api,
  TIMEFRAMES,
  type ParamSpec,
  type RuleValidation,
  type SizingMethod,
  type StrategyConfig,
  type StrategyType,
} from '../lib/api'

// ---------------------------------------------------------------- primitives
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-500">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}

function Field({ label, hint, children, wide }: {
  label: string
  hint?: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function parseNum(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function NumInput({ value, onChange, min, max, step, nullable, placeholder }: {
  value: number | null
  onChange: (v: number | null) => void
  min?: number
  max?: number
  step?: number
  nullable?: boolean
  placeholder?: string
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => {
    if (parseNum(text) !== value) setText(value === null ? '' : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      type="number"
      className="input"
      value={text}
      min={min}
      max={max}
      step={step ?? 'any'}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseNum(e.target.value)
        if (n !== null) onChange(n)
        else if (nullable) onChange(null)
      }}
    />
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </span>
      <span className="text-sm text-slate-300">{label ?? (checked ? 'Yes' : 'No')}</span>
    </button>
  )
}

// ---------------------------------------------------------------- symbol picker
function SymbolPicker({ selected, suggestions, onChange, max }: {
  selected: string[]
  suggestions: string[]
  onChange: (symbols: string[]) => void
  max: number
}) {
  const [text, setText] = useState('')
  const add = (raw: string) => {
    const sym = raw.trim().toUpperCase()
    if (!sym || selected.includes(sym) || selected.length >= max) return
    onChange([...selected, sym])
    setText('')
  }
  const remaining = suggestions.filter((s) => !selected.includes(s))
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full bg-slate-700/60 px-2.5 py-0.5 text-xs font-medium text-slate-200"
          >
            {s}
            <button
              type="button"
              className="text-slate-400 hover:text-red-400"
              onClick={() => onChange(selected.filter((x) => x !== s))}
            >
              ✕
            </button>
          </span>
        ))}
        {!selected.length && <span className="text-xs text-slate-500">No symbols selected</span>}
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          list="symbol-suggestions"
          placeholder="Add symbol (e.g. RELIANCE) and press Enter"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            }
          }}
        />
        <button type="button" className="btn-secondary" onClick={() => add(text)}>Add</button>
      </div>
      <datalist id="symbol-suggestions">
        {remaining.map((s) => <option key={s} value={s} />)}
      </datalist>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {remaining.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:border-amber-500 hover:text-amber-400"
              onClick={() => add(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- rule input
export function RuleInput({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [result, setResult] = useState<RuleValidation | null>(null)
  const [checking, setChecking] = useState(false)

  const validate = async () => {
    setChecking(true)
    try {
      setResult(await api.validateRule(value))
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input font-mono"
          value={value}
          placeholder={placeholder ?? 'e.g. ema(9) crosses_above ema(21)'}
          onChange={(e) => {
            onChange(e.target.value)
            setResult(null)
          }}
        />
        <button type="button" className="btn-secondary shrink-0" disabled={checking} onClick={validate}>
          {checking ? '…' : 'Validate'}
        </button>
      </div>
      {result && (
        result.ok ? (
          <p className="mt-1 text-xs text-emerald-400">
            ✓ Valid{result.normalized ? ` — ${result.normalized}` : ' (empty rule)'}
          </p>
        ) : (
          <p className="mt-1 text-xs text-red-400">✗ {result.error}</p>
        )
      )}
    </div>
  )
}

function IndicatorChips({ indicators }: { indicators: string[] }) {
  if (!indicators.length) return null
  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <div className="label">Available indicators</div>
      <div className="flex flex-wrap gap-1">
        {indicators.map((i) => (
          <code
            key={i}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-sky-300"
          >
            {i}
          </code>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- param fields
function ParamField({ spec, value, onChange, isRule }: {
  spec: ParamSpec
  value: unknown
  onChange: (v: unknown) => void
  isRule: boolean
}) {
  const label = spec.name.replace(/_/g, ' ')
  switch (spec.type) {
    case 'int':
    case 'float':
      return (
        <Field label={label} hint={spec.description}>
          <NumInput
            value={typeof value === 'number' ? value : Number(spec.default ?? 0)}
            min={spec.min}
            max={spec.max}
            step={spec.type === 'int' ? 1 : undefined}
            onChange={(n) => onChange(spec.type === 'int' && n !== null ? Math.round(n) : n)}
          />
        </Field>
      )
    case 'bool':
      return (
        <Field label={label} hint={spec.description}>
          <Toggle checked={!!value} onChange={onChange} />
        </Field>
      )
    case 'choice':
      return (
        <Field label={label} hint={spec.description}>
          <select className="input" value={String(value ?? spec.default ?? '')} onChange={(e) => onChange(e.target.value)}>
            {(spec.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      )
    default: // str
      return (
        <Field label={label} hint={spec.description} wide={isRule}>
          {isRule ? (
            <RuleInput value={String(value ?? '')} onChange={onChange} />
          ) : (
            <input className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
          )}
        </Field>
      )
  }
}

// ---------------------------------------------------------------- main form
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface ConfigFormProps {
  types: StrategyType[]
  symbols: string[]
  indicators: string[]
  strategyType: string
  onTypeChange?: (key: string) => void
  name?: string
  onNameChange?: (name: string) => void
  config: StrategyConfig
  onChange: (cfg: StrategyConfig) => void
}

export function ConfigForm(props: ConfigFormProps) {
  const { types, symbols, indicators, strategyType, onTypeChange, name, onNameChange, config, onChange } = props
  const [tab, setTab] = useState<'form' | 'json'>('form')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const type = useMemo(() => types.find((t) => t.key === strategyType), [types, strategyType])
  const isCustomRules = strategyType === 'custom_rules'

  // keep the JSON tab in sync with form edits
  useEffect(() => {
    if (tab === 'json') setJsonText(JSON.stringify(config, null, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])
  useEffect(() => {
    if (tab === 'json' && !jsonError) setJsonText(JSON.stringify(config, null, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  const applyJson = (text: string) => {
    setJsonText(text)
    try {
      const parsed = JSON.parse(text) as StrategyConfig
      setJsonError(null)
      onChange(parsed)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'invalid JSON')
    }
  }

  const set = <K extends keyof StrategyConfig>(key: K, patch: Partial<StrategyConfig[K]>) =>
    onChange({ ...config, [key]: { ...(config[key] as object), ...patch } as StrategyConfig[K] })
  const setParam = (pname: string, v: unknown) =>
    onChange({ ...config, params: { ...config.params, [pname]: v } })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-slate-800">
        {(['form', 'json'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'form' ? 'Form' : 'JSON'}
          </button>
        ))}
      </div>

      {tab === 'json' ? (
        <div className="card p-4">
          <textarea
            className="input h-96 w-full resize-y font-mono text-xs leading-relaxed"
            value={jsonText}
            onChange={(e) => applyJson(e.target.value)}
            spellCheck={false}
          />
          {jsonError ? (
            <p className="mt-2 text-xs text-red-400">✗ {jsonError} — fix the JSON to sync it back to the form</p>
          ) : (
            <p className="mt-2 text-xs text-emerald-400">✓ Valid JSON — synced with the form</p>
          )}
        </div>
      ) : (
        <>
          {/* -------- type & name -------- */}
          <Section title="Type & Name" subtitle="What the strategy does; params below adapt to the chosen type.">
            {onNameChange && (
              <Field label="Name" wide>
                <input
                  className="input"
                  value={name ?? ''}
                  placeholder="My intraday EMA crossover"
                  onChange={(e) => onNameChange(e.target.value)}
                />
              </Field>
            )}
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {types.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    disabled={!onTypeChange}
                    onClick={() => onTypeChange?.(t.key)}
                    className={`rounded-md border p-3 text-left transition-colors disabled:opacity-60 ${
                      t.key === strategyType
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-100">{t.name}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{t.description}</div>
                  </button>
                ))}
              </div>
              {!onTypeChange && (
                <p className="mt-2 text-xs text-slate-500">Strategy type cannot be changed after creation.</p>
              )}
            </div>
          </Section>

          {/* -------- universe -------- */}
          <Section title="Universe" subtitle="Which instruments the strategy watches.">
            <Field label="Exchange">
              <select
                className="input"
                value={config.universe.exchange}
                onChange={(e) => set('universe', { exchange: e.target.value })}
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </Field>
            <Field label="Max symbols">
              <NumInput
                value={config.universe.max_symbols}
                min={1}
                step={1}
                onChange={(n) => n !== null && set('universe', { max_symbols: Math.round(n) })}
              />
            </Field>
            <Field label="Symbols" wide>
              <SymbolPicker
                selected={config.universe.symbols}
                suggestions={symbols}
                max={config.universe.max_symbols}
                onChange={(s) => set('universe', { symbols: s })}
              />
            </Field>
          </Section>

          {/* -------- data -------- */}
          <Section title="Data" subtitle="Candle timeframe and history window fed to the strategy.">
            <Field label="Timeframe">
              <select
                className="input"
                value={config.data.timeframe}
                onChange={(e) => set('data', { timeframe: e.target.value })}
              >
                {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </Field>
            <Field label="Lookback candles" hint="History window given to the strategy (20–2000)">
              <NumInput
                value={config.data.lookback_candles}
                min={20}
                max={2000}
                step={1}
                onChange={(n) => n !== null && set('data', { lookback_candles: Math.round(n) })}
              />
            </Field>
            <Field label="Use ticks" hint="Also deliver raw ticks (live/paper)">
              <Toggle checked={config.data.use_ticks} onChange={(v) => set('data', { use_ticks: v })} />
            </Field>
          </Section>

          {/* -------- strategy params -------- */}
          <Section
            title="Strategy Params"
            subtitle={type ? `${type.name} — ${type.description}` : 'Pick a strategy type first.'}
          >
            {isCustomRules && <IndicatorChips indicators={indicators} />}
            {(type?.param_schema ?? []).map((spec) => (
              <ParamField
                key={spec.name}
                spec={spec}
                value={config.params[spec.name] ?? spec.default}
                onChange={(v) => setParam(spec.name, v)}
                isRule={isCustomRules && spec.type === 'str'}
              />
            ))}
            {type && !type.param_schema.length && (
              <p className="text-sm text-slate-500">This strategy type has no extra parameters.</p>
            )}
          </Section>

          {/* -------- filters -------- */}
          <Section title="Filters" subtitle="When entries are allowed.">
            <Field label="Trade start (IST)">
              <input
                type="time"
                className="input"
                value={config.filters.time.trade_start}
                onChange={(e) => set('filters', { time: { ...config.filters.time, trade_start: e.target.value } })}
              />
            </Field>
            <Field label="No entries after">
              <input
                type="time"
                className="input"
                value={config.filters.time.trade_end}
                onChange={(e) => set('filters', { time: { ...config.filters.time, trade_end: e.target.value } })}
              />
            </Field>
            <Field label="Square off at">
              <input
                type="time"
                className="input"
                value={config.filters.time.square_off}
                onChange={(e) => set('filters', { time: { ...config.filters.time, square_off: e.target.value } })}
              />
            </Field>
            <Field label="Trading days" wide>
              <div className="flex gap-1.5">
                {DAY_NAMES.map((d, i) => {
                  const on = config.filters.time.days.includes(i)
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                        on
                          ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                          : 'border-slate-700 text-slate-500 hover:border-slate-500'
                      }`}
                      onClick={() => {
                        const days = on
                          ? config.filters.time.days.filter((x) => x !== i)
                          : [...config.filters.time.days, i].sort((a, b) => a - b)
                        set('filters', { time: { ...config.filters.time, days } })
                      }}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="Max trades / day">
              <NumInput
                value={config.filters.max_trades_per_day}
                min={1}
                step={1}
                onChange={(n) => n !== null && set('filters', { max_trades_per_day: Math.round(n) })}
              />
            </Field>
            <Field label="Min price (₹)">
              <NumInput value={config.filters.min_price} min={0} onChange={(n) => n !== null && set('filters', { min_price: n })} />
            </Field>
            <Field label="Max price (₹)">
              <NumInput value={config.filters.max_price} min={0} onChange={(n) => n !== null && set('filters', { max_price: n })} />
            </Field>
            <Field label="Min volume" hint="Minimum last-candle volume to allow entry">
              <NumInput value={config.filters.min_volume} min={0} step={1} onChange={(n) => n !== null && set('filters', { min_volume: Math.round(n) })} />
            </Field>
            <Field label="Extra entry rule" hint="Optional rule ANDed with the strategy's entries" wide>
              <RuleInput
                value={config.filters.extra_entry_rule}
                onChange={(v) => set('filters', { extra_entry_rule: v })}
                placeholder="e.g. rsi(14) < 70 and volume > sma(20)"
              />
            </Field>
          </Section>

          {/* -------- sizing -------- */}
          <Section title="Sizing" subtitle="How big each position is.">
            <Field label="Method">
              <select
                className="input"
                value={config.sizing.method}
                onChange={(e) => set('sizing', { method: e.target.value as SizingMethod })}
              >
                <option value="fixed_quantity">Fixed quantity (shares)</option>
                <option value="fixed_value">Fixed value (₹ per trade)</option>
                <option value="percent_capital">Percent of capital (%)</option>
                <option value="risk_based">Risk based (% of equity risked to SL)</option>
              </select>
            </Field>
            <Field
              label="Value"
              hint={{
                fixed_quantity: 'Shares per trade',
                fixed_value: 'INR notional per trade',
                percent_capital: '% of equity per trade',
                risk_based: '% of equity risked to the stop-loss',
              }[config.sizing.method]}
            >
              <NumInput value={config.sizing.value} min={0} onChange={(n) => n !== null && set('sizing', { value: n })} />
            </Field>
            <Field label="Max quantity">
              <NumInput value={config.sizing.max_quantity} min={1} step={1} onChange={(n) => n !== null && set('sizing', { max_quantity: Math.round(n) })} />
            </Field>
          </Section>

          {/* -------- risk -------- */}
          <Section title="Risk" subtitle="Stops, targets, and per-strategy limits. 0 disables a knob.">
            <Field label="Stop loss %">
              <NumInput value={config.risk.stop_loss_pct} min={0} onChange={(n) => n !== null && set('risk', { stop_loss_pct: n })} />
            </Field>
            <Field label="Take profit %">
              <NumInput value={config.risk.take_profit_pct} min={0} onChange={(n) => n !== null && set('risk', { take_profit_pct: n })} />
            </Field>
            <Field label="Trailing stop %">
              <NumInput value={config.risk.trailing_stop_pct} min={0} onChange={(n) => n !== null && set('risk', { trailing_stop_pct: n })} />
            </Field>
            <Field label="Max open positions">
              <NumInput value={config.risk.max_positions} min={1} step={1} onChange={(n) => n !== null && set('risk', { max_positions: Math.round(n) })} />
            </Field>
            <Field label="Max loss / day (₹)" hint="Strategy-level kill switch; 0 disables">
              <NumInput value={config.risk.max_loss_per_day} min={0} onChange={(n) => n !== null && set('risk', { max_loss_per_day: n })} />
            </Field>
            <Field label="Max position value (₹)">
              <NumInput value={config.risk.max_position_value} min={0} onChange={(n) => n !== null && set('risk', { max_position_value: n })} />
            </Field>
          </Section>

          {/* -------- execution -------- */}
          <Section title="Execution" subtitle="How orders are placed at the broker.">
            <Field label="Product">
              <select
                className="input"
                value={config.execution.product}
                onChange={(e) => set('execution', { product: e.target.value as 'MIS' | 'CNC' | 'NRML' })}
              >
                <option value="MIS">MIS (intraday)</option>
                <option value="CNC">CNC (delivery)</option>
                <option value="NRML">NRML</option>
              </select>
            </Field>
            <Field label="Order type">
              <select
                className="input"
                value={config.execution.order_type}
                onChange={(e) => set('execution', { order_type: e.target.value as 'MARKET' | 'LIMIT' })}
              >
                <option value="MARKET">MARKET</option>
                <option value="LIMIT">LIMIT</option>
              </select>
            </Field>
            {config.execution.order_type === 'LIMIT' && (
              <Field label="Limit offset %" hint="LIMIT orders priced this % through the touch">
                <NumInput value={config.execution.limit_offset_pct} min={0} onChange={(n) => n !== null && set('execution', { limit_offset_pct: n })} />
              </Field>
            )}
            <Field label="Slippage % (paper)" hint="Paper-fill slippage override; blank = global default">
              <NumInput
                value={config.execution.slippage_pct}
                min={0}
                nullable
                placeholder="default"
                onChange={(n) => set('execution', { slippage_pct: n })}
              />
            </Field>
            <Field label="Allow short" hint="Shorts are intraday-only (MIS) on NSE cash">
              <Toggle checked={config.execution.allow_short} onChange={(v) => set('execution', { allow_short: v })} />
            </Field>
          </Section>
        </>
      )}
    </div>
  )
}
