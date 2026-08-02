// Typed API client for the FastAPI backend (proxied through Vite at /api).

// ----------------------------------------------------------------- types
export interface Health {
  ok: boolean
  feed: string
  running_strategies: number
}

export interface AuthStatus {
  kite_configured: boolean
  kite_connected: boolean
  live_trading_enabled: boolean
  feed: 'sim' | 'kite'
}

export type ParamType = 'int' | 'float' | 'str' | 'bool' | 'choice'

export interface ParamSpec {
  name: string
  type: ParamType
  default: unknown
  min?: number
  max?: number
  options?: string[]
  description?: string
}

export interface StrategyType {
  key: string
  name: string
  description: string
  param_schema: ParamSpec[]
  default_params: Record<string, unknown>
}

export interface UniverseConfig {
  exchange: string
  symbols: string[]
  max_symbols: number
}

export const TIMEFRAMES = [
  'minute', '3minute', '5minute', '10minute', '15minute', '30minute', '60minute', 'day',
] as const

export interface DataConfig {
  timeframe: string
  lookback_candles: number
  use_ticks: boolean
}

export interface TimeFilterConfig {
  trade_start: string
  trade_end: string
  square_off: string
  days: number[]
}

export interface FiltersConfig {
  time: TimeFilterConfig
  max_trades_per_day: number
  min_price: number
  max_price: number
  min_volume: number
  extra_entry_rule: string
}

export type SizingMethod = 'fixed_quantity' | 'fixed_value' | 'percent_capital' | 'risk_based'

export interface SizingConfig {
  method: SizingMethod
  value: number
  max_quantity: number
}

export interface RiskConfig {
  stop_loss_pct: number
  take_profit_pct: number
  trailing_stop_pct: number
  max_positions: number
  max_loss_per_day: number
  max_position_value: number
}

export interface ExecutionConfig {
  product: 'MIS' | 'CNC' | 'NRML'
  order_type: 'MARKET' | 'LIMIT'
  limit_offset_pct: number
  variety: string
  slippage_pct: number | null
  allow_short: boolean
}

export interface StrategyConfig {
  universe: UniverseConfig
  data: DataConfig
  filters: FiltersConfig
  sizing: SizingConfig
  risk: RiskConfig
  execution: ExecutionConfig
  params: Record<string, unknown>
}

export type StrategyStatus = 'stopped' | 'running' | 'paused' | 'error'
export type StrategyMode = 'paper' | 'live'

export interface Strategy {
  id: number
  name: string
  strategy_type: string
  mode: StrategyMode
  status: StrategyStatus
  config: StrategyConfig
  config_version: number
  error_message: string
  created_at: string
  updated_at: string
}

export interface ConfigRevision {
  version: number
  config: StrategyConfig
  created_at: string
}

export interface Position {
  id: number
  strategy_id: number | null
  mode: string
  exchange: string
  symbol: string
  product: string
  quantity: number
  average_price: number
  last_price: number
  realized_pnl: number
  stop_loss: number
  take_profit: number
}

export interface Order {
  id: number
  strategy_id: number | null
  broker_order_id: string
  mode: string
  exchange: string
  symbol: string
  transaction_type: string
  quantity: number
  filled_quantity: number
  order_type: string
  product: string
  price: number
  average_price: number
  status: string
  status_message: string
  tag: string
  placed_at: string
}

export interface Trade {
  id: number
  strategy_id: number | null
  mode: string
  symbol: string
  transaction_type: string
  quantity: number
  price: number
  charges: number
  executed_at: string
}

export interface PnlPoint {
  at: string
  strategy_id: number | null
  mode: string
  equity: number
  realized_pnl: number
  unrealized_pnl: number
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'TRADE'

export interface LogEntry {
  id: number
  at: string
  strategy_id: number | null
  level: LogLevel
  message: string
}

export interface PaperAccount {
  cash: number
  starting_cash: number
  realized_pnl: number
  unrealized_pnl: number
  total_charges: number
  equity: number
}

export interface Account {
  feed: string
  kite_connected: boolean
  live_trading_enabled: boolean
  paper_accounts: Record<string, PaperAccount>
  live: Record<string, unknown> | null
}

export interface BacktestStats {
  starting_cash: number
  final_equity: number
  total_return_pct: number
  num_trades: number
  win_rate_pct: number
  avg_trade_pnl: number
  best_trade: number
  worst_trade: number
  max_drawdown_pct: number
  sharpe_estimate: number
  total_charges: number
}

export interface BacktestTrade {
  at: string
  symbol: string
  side: string
  quantity: number
  price: number
  charges: number
  reason: string
  pnl: number | null
}

export interface EquityPoint {
  at: string
  equity: number
}

export interface BacktestResult {
  id: number
  stats: BacktestStats
  equity_curve: EquityPoint[]
  trades: BacktestTrade[]
}

export interface BacktestRunSummary {
  id: number
  strategy_type: string
  from_date: string
  to_date: string
  stats: BacktestStats
  created_at: string
}

export interface BacktestRunDetail extends BacktestRunSummary {
  config: StrategyConfig
  equity_curve: EquityPoint[]
  trades: BacktestTrade[]
}

export interface Candle {
  at: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface RuleValidation {
  ok: boolean
  error?: string
  normalized?: string
}

// ----------------------------------------------------------------- client
export class ApiError extends Error {
  status: number

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body && body.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      }
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export const api = {
  health: () => request<Health>('/api/health'),
  authStatus: () => request<AuthStatus>('/api/auth/status'),
  kiteLoginUrl: () => request<{ login_url: string }>('/api/auth/kite/login-url'),
  kiteToken: (request_token: string) =>
    request<{ connected: boolean; user_id: string }>('/api/auth/kite/token', {
      method: 'POST',
      body: JSON.stringify({ request_token }),
    }),

  strategyTypes: () => request<StrategyType[]>('/api/strategies/types'),
  indicators: () => request<{ indicators: string[] }>('/api/strategies/indicators'),
  strategies: () => request<Strategy[]>('/api/strategies'),
  strategy: (id: number) => request<Strategy>(`/api/strategies/${id}`),
  createStrategy: (body: { name: string; strategy_type: string; mode: 'paper'; config: StrategyConfig }) =>
    request<Strategy>('/api/strategies', { method: 'POST', body: JSON.stringify(body) }),
  updateStrategy: (
    id: number,
    body: { name?: string; mode?: StrategyMode; config?: StrategyConfig },
    confirmLive = false,
  ) =>
    request<Strategy>(`/api/strategies/${id}${qs({ confirm_live: confirmLive || undefined })}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteStrategy: (id: number) =>
    request<{ deleted: number }>(`/api/strategies/${id}`, { method: 'DELETE' }),
  revisions: (id: number) => request<ConfigRevision[]>(`/api/strategies/${id}/revisions`),
  startStrategy: (id: number, confirmLive = false) =>
    request<Strategy>(`/api/strategies/${id}/start${qs({ confirm_live: confirmLive || undefined })}`, {
      method: 'POST',
    }),
  pauseStrategy: (id: number) =>
    request<Strategy>(`/api/strategies/${id}/pause`, { method: 'POST' }),
  stopStrategy: (id: number, flatten: boolean) =>
    request<Strategy>(`/api/strategies/${id}/stop?flatten=${flatten}`, { method: 'POST' }),
  resetPaper: (id: number) =>
    request<{ reset: number }>(`/api/strategies/${id}/reset-paper`, { method: 'POST' }),

  positions: (strategyId?: number, openOnly = true) =>
    request<Position[]>(`/api/positions${qs({ strategy_id: strategyId, open_only: openOnly })}`),
  orders: (strategyId?: number, limit = 100) =>
    request<Order[]>(`/api/orders${qs({ strategy_id: strategyId, limit })}`),
  trades: (strategyId?: number, limit = 100) =>
    request<Trade[]>(`/api/trades${qs({ strategy_id: strategyId, limit })}`),
  pnl: (strategyId?: number, limit = 500) =>
    request<PnlPoint[]>(`/api/pnl${qs({ strategy_id: strategyId, limit })}`),
  logs: (opts: { strategyId?: number; level?: string; limit?: number } = {}) =>
    request<LogEntry[]>(
      `/api/logs${qs({ strategy_id: opts.strategyId, level: opts.level, limit: opts.limit ?? 200 })}`,
    ),
  account: () => request<Account>('/api/account'),
  killSwitch: () =>
    request<{ halted_strategies: number[] }>('/api/kill-switch', { method: 'POST' }),

  symbols: () => request<{ symbols: string[] }>('/api/symbols'),
  candles: (symbol: string, timeframe = '5minute', lookback = 100) =>
    request<{ symbol: string; timeframe: string; candles: Candle[] }>(
      `/api/candles/${encodeURIComponent(symbol)}${qs({ timeframe, lookback })}`,
    ),
  validateRule: (rule: string) =>
    request<RuleValidation>('/api/rules/validate', { method: 'POST', body: JSON.stringify({ rule }) }),

  runBacktest: (body: {
    strategy_type: string
    config: StrategyConfig
    from_date: string
    to_date: string
    starting_cash: number
  }) => request<BacktestResult>('/api/backtest', { method: 'POST', body: JSON.stringify(body) }),
  backtestRuns: () => request<BacktestRunSummary[]>('/api/backtest/runs'),
  backtestRun: (id: number) => request<BacktestRunDetail>(`/api/backtest/runs/${id}`),
}

// Mirrors the backend's StrategyConfigSchema defaults (app/schemas.py).
export function defaultConfig(params: Record<string, unknown> = {}): StrategyConfig {
  return {
    universe: { exchange: 'NSE', symbols: ['RELIANCE', 'TCS', 'HDFCBANK'], max_symbols: 50 },
    data: { timeframe: '5minute', lookback_candles: 200, use_ticks: false },
    filters: {
      time: { trade_start: '09:20', trade_end: '15:00', square_off: '15:15', days: [0, 1, 2, 3, 4] },
      max_trades_per_day: 10,
      min_price: 20,
      max_price: 100000,
      min_volume: 0,
      extra_entry_rule: '',
    },
    sizing: { method: 'fixed_value', value: 25000, max_quantity: 10000 },
    risk: {
      stop_loss_pct: 1,
      take_profit_pct: 2,
      trailing_stop_pct: 0,
      max_positions: 5,
      max_loss_per_day: 5000,
      max_position_value: 200000,
    },
    execution: {
      product: 'MIS',
      order_type: 'MARKET',
      limit_offset_pct: 0.05,
      variety: 'regular',
      slippage_pct: null,
      allow_short: true,
    },
    params: { ...params },
  }
}
