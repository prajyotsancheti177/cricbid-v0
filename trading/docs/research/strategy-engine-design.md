# Strategy Engine Design — Maximally Customizable, Config-Driven Trading Engine

**Status:** Draft v1 · 2026-07-02
**Scope:** Python backend, Zerodha Kite Connect API, Indian equities/F&O (NSE/BSE)
**Goal:** Users create their own strategies and override *every* layer of an existing
strategy — universe, timeframe, indicators, entry/exit logic, filters, sizing, risk,
execution, schedule — purely via configuration. Paper trading simulates fills against
live prices so any strategy can be validated without real money. Switching a strategy
from paper to live requires **zero code changes**.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Layered Strategy Anatomy](#2-layered-strategy-anatomy)
3. [Config-Driven Strategies](#3-config-driven-strategies)
4. [Broker Abstraction](#4-broker-abstraction)
5. [Runtime Model](#5-runtime-model)
6. [Persistence Schema](#6-persistence-schema)
7. [Safety Rails for Live Mode](#7-safety-rails-for-live-mode)
8. [Indicator Library](#8-indicator-library)
9. [Backtest-Lite](#9-backtest-lite)
10. [Directory Layout](#10-directory-layout)
11. [Open Questions & Future Work](#11-open-questions--future-work)

---

## 1. Design Principles

| # | Principle | Consequence |
|---|-----------|-------------|
| P1 | **Config over code.** A strategy *instance* is data, not code. | Every tunable lives in a validated parameter tree (Pydantic models); the engine never needs edits to run a new variant. |
| P2 | **Layered composition with per-layer override.** | Each of the ten layers (§2) is an independent, swappable component with a defaults → template → instance override chain. |
| P3 | **Broker-agnostic strategy code.** | Strategies emit *intents* (`OrderRequest` objects); they never talk to Kite directly. `PaperBroker` and `KiteBroker` are interchangeable behind one interface. |
| P4 | **Same code path everywhere.** | Backtest, paper, and live all execute the identical `Strategy.on_bar/on_tick` code. Only the `Broker` and `DataFeed` implementations differ. This is the single most important invariant in the system. |
| P5 | **Default to safe.** | New instances default to `mode: paper`. Going live requires explicit, audited confirmation plus hard caps (§7). |
| P6 | **Everything persisted, everything replayable.** | Orders, fills, positions, config versions, and engine events land in SQLite (SQLAlchemy), enabling audit, crash recovery, and P&L reconstruction. |
| P7 | **Declarative first, escape hatch second.** | 90% of strategies should be expressible as rule expressions in YAML. The remaining 10% drop a `.py` plugin into `strategies/` — auto-discovered, same lifecycle. |
| P8 | **Fail closed.** | Any unhandled error in a live strategy transitions it to `ERROR`, cancels its open orders, and (configurably) flattens its positions. The portfolio kill-switch halts everything. |

---

## 2. Layered Strategy Anatomy

A strategy instance is a stack of ten layers. Each layer is (a) a named component
resolved from a registry, (b) configured by its own parameter subtree, and
(c) independently overridable per instance without touching the others.

```
┌──────────────────────────────────────────────────────────────┐
│ 10. Schedule        when the strategy is awake / squared off  │
│  9. Execution       order type, product, variety, slippage    │
│  8. Risk mgmt       SL/TP/trailing, max loss, max positions   │
│  7. Position sizing capital → quantity                        │
│  6. Filters         time-of-day, volatility, regime gates     │
│  5. Signal rules    entry/exit boolean expressions            │
│  4. Indicators      derived series over OHLCV                 │
│  3. Data/Timeframe  candle interval(s), history depth, ticks  │
│  2. Universe        which instruments                         │
│  1. Identity        name, template class, mode, broker        │
└──────────────────────────────────────────────────────────────┘
```

Data flows bottom-up each evaluation cycle:

```
Universe → DataFeed (candles/ticks) → IndicatorPipeline → RuleEvaluator
   → Filters (gate) → Sizer (qty) → RiskManager (approve/modify/veto)
   → ExecutionPolicy (order params) → Broker (paper|live)
```

### 2.1 Universe

Which instruments the strategy trades. Resolvers, selected by `type`:

| Type | Config | Notes |
|------|--------|-------|
| `static` | `symbols: [NSE:RELIANCE, NSE:TCS]` | Fixed list. |
| `index_constituents` | `index: NIFTY50` / `NIFTYBANK` | Resolved daily from Kite instruments dump + a maintained constituents table. |
| `screener` | `expression: "avg_volume(20) > 1e6 and close > 100"` | Evaluated pre-market over the candidate pool; produces the day's list. |
| `derivative` | `underlying: NSE:NIFTY 50, kind: fut/atm_ce/atm_pe, expiry: nearest` | Resolves to concrete tradingsymbols at runtime (rolls handled by re-resolution). |

Universe resolution runs at a configurable cadence (`resolve: daily | on_start`).
The resolved list is snapshotted to the DB so a day's trading is reproducible.

### 2.2 Data / Timeframe

- `interval`: one of Kite's supported candles — `minute`, `3minute`, `5minute`,
  `10minute`, `15minute`, `30minute`, `60minute`, `day`. Multi-timeframe supported:
  a primary interval drives evaluation; secondary intervals (e.g., `day` for a
  trend filter) are available to indicators via `htf("day").ema(50)`.
- `history_bars`: warm-up depth (must cover the longest indicator lookback; the
  engine validates this at config-load time and errors if insufficient).
- `use_ticks`: if true, the strategy also receives `on_tick` callbacks (for
  tick-level trailing stops or breakout triggers) via the Kite WebSocket
  (`KiteTicker`) or the paper feed.
- Candle source: Kite `historical_data` for warm-up + a **CandleAggregator** that
  builds forming candles from the tick stream intraday (Kite historical API lags;
  aggregation gives on-close evaluation with no delay). Aggregated candles are
  reconciled against the historical API after the fact and discrepancies logged.

### 2.3 Indicators

Named, parameterized derived series (§8). Config declares what the strategy needs;
the engine computes them incrementally per instrument per timeframe and exposes
them to the rule evaluator by call syntax: `ema(21)`, `rsi(14)`, `atr(14)`,
`vwap()`, `supertrend(10, 3)`. Anything referenced in a rule expression is
auto-added to the pipeline — explicit declaration is only needed for indicators
used solely by Python plugins.

### 2.4 Signal rules (entry/exit)

Boolean expressions over indicators, price fields, and position state (§3.3).
Separate `entry.long`, `entry.short`, `exit.long`, `exit.short` expressions.
Exits from the rule layer coexist with risk-layer exits (SL/TP/trailing/EOD);
**whichever fires first wins**, and risk-layer exits can never be disabled in
live mode, only widened.

### 2.5 Filters

Gates evaluated *before* entry signals (they suppress entries; they never
suppress exits). Composable list; all must pass:

| Filter | Example config | Semantics |
|--------|----------------|-----------|
| `time_of_day` | `windows: [["09:30","14:45"]]` | Only enter inside windows (IST). |
| `volatility` | `metric: atr_pct(14), min: 0.5, max: 3.0` | ATR as % of price within band. |
| `trend_regime` | `expression: "htf('day').close > htf('day').ema(200)"` | Arbitrary expression gate. |
| `event_blackout` | `days: [budget, rbi_policy], expiry_day: false` | Calendar-driven suppression. |
| `spread` | `max_spread_pct: 0.15` | Skip illiquid moments (from quote depth). |
| `custom` | `plugin: my_filters.NewsFilter` | Python escape hatch. |

### 2.6 Position sizing

`Sizer` components map (signal, capital, instrument, price) → quantity:

| Type | Config | Formula |
|------|--------|---------|
| `fixed_quantity` | `qty: 50` | Constant. |
| `fixed_notional` | `notional: 100000` | `floor(notional / price)` (lot-rounded for F&O). |
| `percent_capital` | `pct: 10` | % of the *strategy's allocated capital*. |
| `risk_per_trade` | `risk_pct: 1.0, stop_ref: sl` | `qty = (capital × risk_pct) / |entry − stop|` — sizes so a stop-out loses exactly risk_pct. |
| `volatility_target` | `target_daily_vol_pct: 0.5, metric: atr(14)` | Inverse-volatility sizing. |
| `custom` | plugin | Escape hatch. |

Every sizer output is clamped by risk-layer caps (max qty per order, max notional,
freeze quantity for F&O, available margin from `broker.margins()`).

### 2.7 Risk management

Two scopes, both declarative:

**Per-trade** (attached to each position at entry):
- `stop_loss`: `{type: percent|atr|points|indicator, value: …}` — e.g.
  `{type: atr, mult: 2.0}` or `{type: indicator, expression: "supertrend(10,3)"}`.
- `take_profit`: same forms; optional multiple targets with partial exits
  (`targets: [{at: 1R, exit_pct: 50}, {at: 2R, exit_pct: 50}]`).
- `trailing`: `{type: percent|atr|breakeven_after, …}`, tick- or bar-driven.
- `max_holding`: `{bars: 20}` or `{time: "15:10"}` (time exit / EOD square-off).

**Per-strategy:**
- `max_open_positions`, `max_positions_per_symbol` (default 1),
  `max_trades_per_day`, `max_consecutive_losses` (pause after N),
  `max_daily_loss` (₹ or % of allocated capital → flatten + pause for the day),
  `max_drawdown_pct` (from strategy equity peak → stop).

**Portfolio-level** (engine-wide, owned by the `RiskGovernor`, not by any strategy):
- `portfolio_max_daily_loss`, `portfolio_max_open_notional`,
  `portfolio_max_margin_utilization_pct`, `max_orders_per_minute` (global rate cap).
- Breach ⇒ **kill-switch** (§5.4): cancel all open orders, flatten all positions,
  halt all strategies, require manual re-arm.

Enforcement point: the `RiskManager` sits between sizing and execution and can
**approve, shrink, or veto** every order intent. Stops/targets are enforced
engine-side (monitored on ticks/bars) rather than relying solely on broker SL
orders — with an option to *also* place a broker-side SL-M as a belt-and-braces
backstop for live mode (`hard_stop_at_broker: true`).

### 2.8 Execution policy

How an approved intent becomes an order:

```yaml
execution:
  product: MIS            # MIS | CNC | NRML
  variety: regular        # regular | amo | iceberg | co
  order_type: LIMIT       # MARKET | LIMIT | SL | SL-M
  limit_offset_ticks: 2   # for LIMIT: last_price ± n ticks in our favor... or aggressive
  slippage_tolerance_pct: 0.25   # abort if quote moved beyond this vs. signal price
  unfilled_timeout_sec: 20       # then: cancel | convert_to_market | reprice
  on_timeout: reprice
  max_reprices: 2
  split_above_qty: 1800   # slice large orders (freeze-qty aware for F&O)
  validity: DAY
```

The execution layer also owns idempotency: every intent carries a deterministic
`client_order_id` (`{instance_id}:{symbol}:{signal_bar_ts}:{side}:{seq}`) used as
the Kite `tag`, so retries after a network error never double-place (§7).

### 2.9 Schedule

```yaml
schedule:
  trading_days: [MON, TUE, WED, THU, FRI]      # minus exchange holiday calendar
  session: {start: "09:15", end: "15:30"}      # NSE hours, IST
  entry_window: {start: "09:20", end: "15:00"} # no fresh entries outside
  square_off: "15:12"                          # mandatory for MIS
  warmup_at: "09:00"                           # fetch history, resolve universe
  holidays: nse_calendar                       # pluggable calendar source
```

### 2.10 Override chain

Effective config = deep-merge of three documents, later wins:

```
engine defaults (defaults.yaml)
  ⊕ strategy template (templates/ema_crossover.yaml — ships with the class)
    ⊕ instance overrides (the user's document)
```

Because every layer is keyed independently, a user can, e.g., take the stock
`ema_crossover` template and override *only* `risk.stop_loss` and `universe` —
two lines — and get a fully distinct, versioned instance. Merge semantics:
mappings deep-merge; lists **replace** (predictable); `null` deletes a key.
The merged result is validated against the full Pydantic schema and the
*resolved* config is what gets versioned in the DB (§6), so audit never depends
on reconstructing the merge.

---

## 3. Config-Driven Strategies

### 3.1 Model

> **strategy instance = strategy class + full parameter tree**

- **Strategy class**: a named behavior template — either a built-in declarative
  runner (`rule_strategy`, which interprets expressions) or a Python plugin class.
- **Parameter tree**: the ten-layer config. YAML on disk (human-authored),
  canonical JSON in the DB (machine-versioned). JSON Schema is auto-generated
  from the Pydantic models for editor autocomplete and UI form generation.

### 3.2 Worked example

```yaml
# configs/instances/reliance_ema_cross.yaml
schema_version: 1
instance:
  name: reliance-ema-cross-v2
  strategy: rule_strategy          # or a plugin: "my_plugins.MeanRevert"
  mode: paper                      # paper | live  (default: paper)
  enabled: true
  capital: 200000                  # ₹ allocated to this instance

universe:
  type: static
  symbols: [NSE:RELIANCE, NSE:HDFCBANK, NSE:INFY]

data:
  interval: 5minute
  history_bars: 300
  use_ticks: true                  # tick-driven trailing stop
  secondary_intervals: [day]

signals:
  entry:
    long:  "ema(9) crosses_above ema(21) and rsi(14) < 60 and volume > sma(volume, 20)"
    short: "ema(9) crosses_below ema(21) and rsi(14) > 40"
  exit:
    long:  "ema(9) crosses_below ema(21)"
    short: "ema(9) crosses_above ema(21)"

filters:
  - type: time_of_day
    windows: [["09:30", "14:45"]]
  - type: trend_regime
    expression: "htf('day').close > htf('day').ema(50)"
    applies_to: long               # gate longs only; shorts ungated by this filter
  - type: volatility
    metric: atr_pct(14)
    min: 0.4
    max: 2.5

sizing:
  type: risk_per_trade
  risk_pct: 1.0                    # 1% of instance capital risked per trade
  max_qty: 500

risk:
  per_trade:
    stop_loss:   {type: atr, mult: 2.0}
    take_profit: {type: atr, mult: 4.0}
    trailing:    {type: breakeven_after, trigger: 1.5R, then: {type: atr, mult: 1.5}}
    max_holding: {time: "15:05"}
  per_strategy:
    max_open_positions: 3
    max_positions_per_symbol: 1
    max_trades_per_day: 10
    max_daily_loss: {pct: 3.0}     # of instance capital → flatten & pause for day
    max_consecutive_losses: 4

execution:
  product: MIS
  order_type: LIMIT
  limit_offset_ticks: 2
  slippage_tolerance_pct: 0.25
  unfilled_timeout_sec: 20
  on_timeout: reprice
  max_reprices: 2

schedule:
  session: {start: "09:15", end: "15:30"}
  entry_window: {start: "09:20", end: "15:00"}
  square_off: "15:12"

paper:                             # only used when mode=paper
  starting_cash: 200000
  slippage: {type: percent, value: 0.03}
  fill_on: quote                   # quote | next_tick | bar_close
  charges_model: zerodha_equity_intraday
```

### 3.3 Declarative rule expression language

A small, safe DSL — **not** Python `eval`. Implemented with a proper grammar
(Lark or a hand-rolled Pratt parser) compiling to an AST evaluated against a
per-symbol context. Whitelisted grammar only; no attribute access, no calls
outside the indicator registry, no imports — by construction, not by sandboxing.

**Vocabulary**

- *Price fields:* `open, high, low, close, volume, oi, last_price`
- *Indicators:* any registered name with positional args — `ema(21)`,
  `rsi(14)`, `atr(14)`, `sma(volume, 20)` (indicator-of-series supported)
- *Series ops:* `[n]` history index — `close[1]` = previous bar's close;
  `highest(high, 20)`, `lowest(low, 20)`
- *Cross operators:* `crosses_above`, `crosses_below` (edge-triggered:
  `a[1] <= b[1] and a > b` — fire once per cross, the #1 rookie bug eliminated
  by construction)
- *Comparisons & logic:* `> >= < <= == != and or not`, parentheses
- *Position state:* `position.qty`, `position.side`, `position.entry_price`,
  `position.pnl_pct`, `position.bars_held`, `position.r_multiple`
- *Multi-timeframe:* `htf('day').ema(50)` — forward-filled to the primary TF
  using only *closed* higher-TF bars (no lookahead)
- *Time:* `time_between("09:30","14:30")`, `minutes_since_open`

**Compile-time validation** (at config load, before the strategy can start):
unknown identifiers, arity errors, type errors (comparing series to bool), and
lookback requirements (auto-computes required `history_bars`) are all rejected
with line/column errors. The compiled AST is cached with the config version.

**Determinism guarantee:** expressions are evaluated on *closed* candles only
(`on_bar`), so backtest/paper/live see identical values. Tick-path expressions
are limited to a whitelisted subset (`last_price`, position state) to avoid
intra-bar repainting.

### 3.4 Python plugin escape hatch

For logic beyond the DSL, drop a file into `strategies/`:

```python
# strategies/gap_fade.py  (illustrative — engine contract, not app code)
from engine.strategy import Strategy, param

class GapFade(Strategy):
    """Fade opening gaps larger than a threshold."""
    gap_pct   = param(float, default=1.5, ge=0.1, le=10.0)
    fade_frac = param(float, default=0.5)

    def on_session_start(self, ctx): ...
    def on_bar(self, ctx, bar):          # same ctx/broker API in backtest/paper/live
        if ctx.position(bar.symbol).qty == 0 and self.is_fadeable_gap(ctx, bar):
            ctx.order(bar.symbol, side="SELL", qty=ctx.size(bar.symbol))
    def on_tick(self, ctx, tick): ...    # optional
    def on_order_update(self, ctx, order): ...
```

- **Auto-discovery:** at startup (and on demand via `reload`), the engine scans
  `strategies/*.py`, imports each module, and registers every `Strategy`
  subclass under `module.ClassName` (and an optional `name = "gap_fade"` alias).
  Import errors quarantine the file with a logged event; they never crash the engine.
- **Params are still config:** `param()` descriptors define the plugin's
  parameter schema, so plugin instances get the same validation, versioning,
  UI form generation, and override chain as declarative ones. All ten layers
  except `signals` still come from config — a plugin replaces *only* the signal
  layer by default, and may optionally override sizing/filters by implementing
  hooks (`size()`, `allow_entry()`).
- **Sandboxing stance:** plugins are trusted code (this is the user's own
  machine/account). The safety boundary is the RiskManager + safety rails,
  which plugin orders pass through *identically* — a plugin cannot bypass caps
  because it can only emit intents via `ctx.order()`, never touch the broker.

---

## 4. Broker Abstraction

### 4.1 Interface

One abstract interface; strategies and the engine depend only on it:

```python
class Broker(ABC):                       # signatures only — design contract
    def place_order(self, req: OrderRequest) -> OrderId: ...
    def modify_order(self, order_id, **changes) -> OrderId: ...
    def cancel_order(self, order_id) -> None: ...
    def orders(self) -> list[Order]: ...
    def positions(self) -> list[Position]: ...
    def holdings(self) -> list[Holding]: ...
    def margins(self) -> Margins: ...            # available cash / utilized
    def quote(self, symbols) -> dict[str, Quote]: ...   # ltp + depth
    def subscribe_ticks(self, tokens, callback) -> Subscription: ...
    def on_order_update(self, callback) -> None: ...    # async fill/reject events
```

`OrderRequest` is broker-neutral: `symbol, exchange, side, qty, order_type,
product, price, trigger_price, validity, tag(client_order_id)`. All fills —
paper or live — arrive through the same `on_order_update` callback, so strategy
and risk code have exactly one fill-handling path (P4).

### 4.2 KiteBroker (live)

- Thin adapter over `kiteconnect.KiteConnect` + `KiteTicker`.
- Maps `OrderRequest` → `kite.place_order(...)`; passes `client_order_id` as `tag`.
- Normalizes Kite's order postbacks (WebSocket `on_order_update`) and *also*
  polls `kite.orders()` every N seconds as reconciliation — postbacks can drop.
- Handles: rate limits (token bucket ~3 req/s, Kite's documented cap), retries
  with jitter on 5xx/network (never blind-retrying `place_order` — instead query
  by tag first to check whether the order landed), session expiry (access token
  invalid → engine-wide transition to `ERROR`, live strategies halt, alert fired;
  daily login flow re-arms it).
- One shared `KiteTicker` connection multiplexed across all strategies
  (Kite allows limited connections; a `TickRouter` fans ticks out by token).

### 4.3 PaperBroker (simulated)

Same interface, fills simulated against real quotes:

- **Price source:** the live tick/quote stream (market hours) or last-known
  quote (off hours; fills marked `stale_price=true`). In backtest-lite, the
  historical bar feed (§9). The PaperBroker itself is agnostic — it asks an
  injected `PriceSource` for the current price, which is why the same class
  serves paper trading *and* backtesting.
- **Fill model (configurable per instance):**
  - `MARKET`: fill at ltp ± `slippage` (percent, ticks, or half-spread from
    depth when available), direction-aware (buys fill higher, sells lower).
  - `LIMIT`: fill when touch price crosses the limit (`ltp <= limit` for buys);
    fills at the limit price. Optional `fill_probability_at_touch` for realism.
  - `SL / SL-M`: armed at trigger, then market/limit semantics.
  - Optional `latency_ms` before fill eligibility; optional partial fills for
    qty above a per-symbol `depth_qty`.
- **Accounting:** virtual cash per instance (`starting_cash`), average-price
  position tracking (long/short, product-aware), realized/unrealized P&L
  marked to ltp, margin model approximating Zerodha (MIS leverage, NRML span
  approximation — configurable multipliers), and a **charges model**
  (brokerage ₹20/0.03%, STT, exchange txn, GST, SEBI, stamp) so paper P&L is
  net-of-costs honest rather than flattering.
- **Persistence:** every simulated order/fill/position/cash change is written to
  the same DB tables as live (discriminated by `mode='paper'`), so P&L reports,
  equity curves, and the UI are mode-agnostic and paper state survives restarts.
- **Rejects realistically:** insufficient virtual margin, market closed (unless
  `allow_offhours: true`), price-band violations — so paper surfaces the same
  failure modes users will meet live.

### 4.4 Mode selection

`mode: paper | live` in the instance config is consumed by a `BrokerFactory` at
instance start; nothing downstream knows which it got. Both brokers are held
behind the same `ctx.broker` slot. **Switching modes = editing one config field**
(plus passing the go-live gate, §7). A single engine process can run paper and
live instances side by side — the factory hands each instance the right broker,
and the RiskGovernor tracks live exposure separately.

---

## 5. Runtime Model

### 5.1 Process anatomy

```
                    ┌────────────────────────────────────────┐
                    │                Engine                   │
                    │                                        │
  Kite WS ─ ticks ─▶ TickRouter ──▶ CandleAggregator         │
                    │      │               │                 │
                    │      │        bar-close events         │
                    │      ▼               ▼                 │
                    │  ┌─────────────────────────┐           │
                    │  │        EventBus          │◀── Scheduler (cron: warmup,
                    │  └─────────────────────────┘    session open/close, square-off)
                    │      │ per-instance queues        
                    │      ▼                             
                    │  StrategyRunner × N  ──intents──▶ RiskManager ─▶ ExecutionGateway
                    │  (one per instance,                    │              │
                    │   own asyncio task)                    ▼              ▼
                    │                               RiskGovernor      Broker (paper|live)
                    │                               (portfolio)            │
                    │                                        ◀─ order updates
                    └────────────────────────────────────────┘
```

- **Concurrency:** single `asyncio` process. Each strategy instance runs as its
  own task consuming a private event queue — one slow strategy cannot starve
  the tick pipeline, and per-instance ordering (bar → signals → orders) is
  guaranteed. CPU-heavy indicator work stays vectorized in pandas/NumPy;
  incremental updates keep per-bar cost O(1) per indicator.
- **Events:** `Tick`, `BarClose(symbol, interval)`, `OrderUpdate`, `Timer(cron)`,
  `Command(start/stop/pause/flatten)`, `KillSwitch`. All events also stream to
  the `events` table (§6) for audit/replay.

### 5.2 Scheduler

- Wakes instances on their cadence: `BarClose` events are emitted per
  `(symbol, interval)` by the CandleAggregator (wall-clock aligned to exchange
  candle boundaries with a small grace delay for late ticks, e.g. 500 ms).
  Instances subscribed to `5minute` get exactly one wake per symbol per 5 min.
- Cron-style session hooks per instance from the `schedule` layer: warmup
  (fetch history, resolve universe, prime indicators), session open, entry
  window open/close, mandatory square-off, session close (final P&L snapshot).
- Holiday/half-day aware via a pluggable NSE calendar.

### 5.3 Per-instance state machine

```
                 ┌──────────┐
        create   │ STOPPED  │◀───────────────┐
        ────────▶│          │                │ stop / square-off done
                 └────┬─────┘                │
                start │ (validate config,    │
                      │  warmup, connect)    │
                 ┌────▼─────┐   pause   ┌────┴─────┐
                 │ RUNNING  │──────────▶│  PAUSED   │  (manages exits only;
                 │          │◀──────────│           │   no new entries)
                 └────┬─────┘  resume   └────┬─────┘
                      │ unhandled exception, │
                      │ risk breach, broker  │
                      ▼ failure              ▼
                 ┌──────────┐          (same error path)
                 │  ERROR   │── manual ack + restart ─▶ STOPPED
                 └──────────┘
```

- Transitions are persisted (instance row + event log) so a crashed engine
  restores each instance to its last state on boot — after **reconciliation**:
  on startup the engine diffs DB-known orders/positions against
  `broker.orders()/positions()` (live) or its own tables (paper), adopts
  orphans, and flags mismatches before any strategy runs.
- `PAUSED` semantics: exits, stops, trailing, and square-off keep working;
  entries are suppressed. This is the safe intermediate state and the automatic
  response to `max_consecutive_losses` / `max_daily_loss`.
- `ERROR` policy per instance: `on_error: pause | flatten_and_stop` (live
  default: `flatten_and_stop`).

### 5.4 Kill-switch

Triggered by: portfolio risk breach (§2.7), manual command (UI/CLI
`engine kill`), broker session failure, or a watchdog (event loop stalled,
tick feed silent > N seconds during market hours). Sequence:

1. Set engine flag `HALTED` — the ExecutionGateway rejects **all** new intents
   at the door (checked before anything else, so no race).
2. Cancel every open order across instances.
3. Flatten every open position with `MARKET` orders (paper and live), retrying
   with escalation and alerting on any leg that fails.
4. Transition all instances to `ERROR`; persist a `kill_switch` event with reason.
5. Require explicit manual re-arm (`engine arm --confirm`) — never auto-resumes,
   even next session.

---

## 6. Persistence Schema

SQLite via SQLAlchemy (2.x, declarative). Single file DB (`engine.db`), WAL
mode for concurrent reader (UI) + writer (engine). All money as integer paise
or `Numeric(14,2)` — never float. All timestamps UTC in storage, IST at edges.

```
strategies                     ── the catalog of strategy classes/templates
  id PK, name UNIQUE, kind ENUM(rule|plugin), plugin_path NULL,
  template_config JSON, created_at

strategy_instances             ── a user's configured instance
  id PK, name UNIQUE, strategy_id FK, mode ENUM(paper|live|backtest),
  state ENUM(stopped|running|paused|error), capital NUMERIC,
  current_config_version FK, live_approved_at NULL, live_approved_by NULL,
  created_at, updated_at

strategy_configs               ── versioned, immutable config snapshots
  id PK, instance_id FK, version INT, config JSON,        -- fully-resolved merge
  config_hash TEXT, valid_from, valid_to NULL, created_by, note
  UNIQUE(instance_id, version)
  -- every order/trade references the config_version that produced it

orders
  id PK, instance_id FK, config_version FK, mode,
  client_order_id UNIQUE,      -- idempotency key (also sent as Kite tag)
  broker_order_id NULL, symbol, exchange, side, qty, filled_qty,
  order_type, product, price, trigger_price,
  status ENUM(pending|open|partially_filled|complete|cancelled|rejected),
  status_reason TEXT, signal_expression TEXT NULL,  -- which rule fired (audit)
  placed_at, updated_at

order_events                   ── full lifecycle audit per order
  id PK, order_id FK, status, payload JSON, at

trades                         ── fills (one order ⇒ 1..n fills)
  id PK, order_id FK, instance_id FK, mode, symbol, side,
  qty, price, charges NUMERIC, exchange_trade_id NULL, executed_at

positions                      ── current open state (rebuilt from trades on boot)
  id PK, instance_id FK, mode, symbol, product,
  qty, avg_price, side, stop_price NULL, target_price NULL,
  trail_state JSON, opened_at, updated_at
  UNIQUE(instance_id, symbol, product)

round_trips                    ── closed-trade analytics (entry↔exit pairing)
  id PK, instance_id FK, symbol, side, qty, entry_price, exit_price,
  entry_at, exit_at, gross_pnl, charges, net_pnl, r_multiple,
  exit_reason ENUM(signal|sl|tp|trail|time|square_off|kill|manual)

equity_snapshots               ── per-instance equity curve
  id PK, instance_id FK, mode, at,
  cash, positions_value, realized_pnl_day, unrealized_pnl, equity,
  open_positions INT, margin_used
  -- cadence: every bar close of the instance's interval + session close;
  -- portfolio curve = SUM over instances, materialized by a view

events                         ── engine/strategy log (structured)
  id PK, instance_id NULL FK, level, kind        -- state_change|signal|risk_veto|
  , payload JSON, at                             -- fill|error|kill_switch|config_change

paper_accounts
  id PK, instance_id FK UNIQUE, starting_cash, cash, updated_at
```

Design notes:
- **Config versioning:** configs are immutable; an edit inserts version N+1 and
  flips `current_config_version`. A running instance picks up new config only
  at a safe boundary (next bar close, or restart if structural fields changed —
  universe/interval). Orders/trades carry `config_version`, so any historical
  fill is traceable to the exact parameters that produced it.
- **Recovery:** `positions` is a cache; source of truth is the trades ledger.
  On boot: rebuild positions from trades, then reconcile with the broker (§5.3).
- **Retention:** ticks are *not* persisted (volume); candles are cached in a
  separate `candles` table keyed `(symbol, interval, ts)` to cut Kite historical
  API calls and to feed backtest-lite.

---

## 7. Safety Rails for Live Mode

Layered, engine-enforced, **outside** strategy code (a buggy or malicious
plugin passes through every one of these). Checks run in the ExecutionGateway,
strictly ordered:

```
intent → [0 engine armed?] → [1 mode gates] → [2 duplicate guard]
       → [3 count caps] → [4 notional caps] → [5 price sanity]
       → [6 margin check] → place
```

1. **Default-to-paper.** `mode` defaults to `paper`; the schema has no way to
   omit it into live. Going live requires *all* of:
   - `live_approved_at` set via an explicit interactive confirmation
     (`engine golive <instance> ` → shows resolved config diff vs. paper run,
     recent paper stats — trades, win rate, max DD — and requires typing the
     instance name to confirm);
   - a minimum paper track: configurable gate, default **≥ 3 sessions and
     ≥ 10 round-trips in paper** (overridable with `--force`, which is itself logged);
   - valid Kite session at start.
2. **Order-count caps.** Per instance: `max_orders_per_day` (default 25),
   `max_orders_per_minute` (default 5). Engine-wide: global orders/day and
   orders/minute token bucket (also keeps us under Kite rate limits). Breach ⇒
   instance → `PAUSED` + alert; global breach ⇒ kill-switch.
3. **Notional caps.** Per order (`max_order_notional`, default ₹2L), per
   instance open notional, and portfolio open notional / margin utilization.
   Caps are *hard defaults present even if the user's config omits them* —
   omitting a cap gets you the conservative default, not infinity.
4. **Price-band sanity.** Before placing: fetch quote; reject if limit/trigger
   price deviates > X% from ltp (default 3%), if outside the exchange circuit
   band (from quote), if ltp is stale (> N sec old), or if computed qty exceeds
   `max_qty_vs_avg_volume` (e.g. order > 5% of 20-day avg volume). Catches the
   classic fat-finger and bad-tick classes.
5. **Duplicate-order guards.** Three layers:
   - deterministic `client_order_id` with a DB UNIQUE constraint — the same
     signal on the same bar can never place twice, across retries *and* restarts;
   - in-flight lock per `(instance, symbol, side)` — no second entry while one
     is pending;
   - network-error protocol: on timeout from `place_order`, *query by tag*
     before any retry.
6. **Margin pre-check.** `broker.margins()` before placing; reject locally
   rather than eating a broker rejection (cleaner failure, no rate-limit burn).
7. **Session/watchdog rails.** Live instances refuse to start without a fresh
   Kite session; tick-feed silence or event-loop stall during market hours
   trips the kill-switch (§5.4); all live order placements emit alerts
   (Telegram/email hook) with a per-minute digest to avoid spam.
8. **Two-man rule for config edits on a live instance:** edits force the
   instance through `PAUSED` and re-display the go-live diff confirmation.

---

## 8. Indicator Library

### 8.1 Design

- **Pure functions over pandas.** Every indicator is
  `f(df: DataFrame[OHLCV], *args) -> Series | DataFrame` — no state, no I/O,
  no engine imports. Trivially unit-testable against known-good references
  (pandas-ta/TA-Lib parity tests in CI).
- **Registry by name.** A global `IndicatorRegistry` maps
  `name → (fn, signature, lookback_fn)`. Config strings resolve through it:
  the rule compiler sees `ema(21)` and binds `registry["ema"]` with arg `21`.
  `lookback_fn(args)` reports warm-up bars needed (e.g. `ema: 3×period`), which
  is how the engine auto-computes and validates `history_bars`.
- **Registration is a decorator:**

  ```python
  @indicator("ema", lookback=lambda period: 3 * period)
  def ema(df, period: int) -> pd.Series:
      return df["close"].ewm(span=period, adjust=False).mean()
  ```

- **Incremental evaluation.** The naive model (recompute over the rolling
  window each bar) is the *correctness reference* and the default — windows
  are small (≤ a few thousand rows) and vectorized pandas is fast enough for
  dozens of instruments. An optional streaming path (per-indicator O(1) update
  classes) exists behind the same registry for tick-frequency use; both paths
  are cross-checked in tests.
- **Caching & sharing.** Indicator results are memoized per
  `(symbol, interval, indicator, args, last_bar_ts)` and shared across all
  instances — ten strategies using `ema(21)` on RELIANCE 5-min compute it once.
- **No-lookahead discipline:** indicators only ever see closed bars; the
  forming candle is excluded from `df` by the pipeline, not by convention.

### 8.2 Built-ins (v1)

Trend: `sma, ema, wma, supertrend, adx, psar` · Momentum: `rsi, macd, stoch,
roc, cci` · Volatility: `atr, atr_pct, bbands, stddev, donchian` · Volume:
`vwap, obv, volume_sma, mfi` · Utility: `highest, lowest, change, pct_change,
typical_price, prev_day_high/low/close, opening_range(minutes)`.

### 8.3 Custom indicators

Same escape-hatch pattern as strategies: drop a `.py` into `indicators/`;
auto-discovery imports it and every `@indicator`-decorated function joins the
registry, immediately usable in any rule expression by name. Collisions with
built-ins are rejected (must use a distinct name); import errors quarantine the
file. Custom indicators get the same purity contract and are exercised by a
`verify-indicator` CLI that runs them over sample data and checks for NaN
discipline, length preservation, and lookahead (recompute-with-truncated-data
equality test).

---

## 9. Backtest-Lite

**Purpose:** validate a strategy instance over historical candles *before*
paper/live — same code, same config, different clock. Explicitly "lite": bar
close fills with a slippage model, not an order-book simulator; it answers
"does this logic behave as intended and roughly make sense", not "what exact
Sharpe will I get".

### 9.1 Mechanism — reuse, don't reimplement

Backtest = the normal engine wiring with three substitutions:

| Component | Live/Paper | Backtest-lite |
|-----------|-----------|---------------|
| Clock | wall clock | `SimClock` — jumps bar to bar |
| DataFeed | Kite WS + CandleAggregator | `HistoricalFeed` — replays cached candles (from the `candles` table, backfilled via `kite.historical_data`) |
| Broker | KiteBroker / PaperBroker(live quotes) | **the same PaperBroker**, with `PriceSource` = the replay feed |

Everything else — StrategyRunner, rule evaluator, indicator pipeline, filters,
sizer, RiskManager, ExecutionGateway, persistence — is byte-for-byte the code
that runs live (P4). This is the property that makes backtest results
*predictive of paper behavior by construction*: there is no separate backtest
implementation to drift.

### 9.2 Fill semantics & honesty rules

- Signals evaluate on bar close; fills execute at the **next bar's open**
  ± slippage (default), or `same_bar_close` if explicitly chosen (flagged as
  optimistic in the report). LIMIT/SL orders fill when a subsequent bar's
  high/low range crosses the price; intra-bar SL *and* TP both touched ⇒
  **worst-case-first** resolution (stop assumed hit) — conservative by default.
- Charges model applied to every fill; the report shows gross vs. net.
- Multi-timeframe uses only closed higher-TF bars (same rule as live).
- Runs are persisted like any other mode (`mode='backtest'`, own instance run
  id), so equity curves and round-trips use the same tables/queries/UI.

### 9.3 Interface & promotion flow

```
engine backtest configs/instances/reliance_ema_cross.yaml \
       --from 2025-01-01 --to 2025-06-30
```

Outputs: equity curve, net/gross P&L, #round-trips, win rate, avg R, max
drawdown, exposure %, per-exit-reason breakdown, and per-rule fire counts
(which entry expression triggered how often — invaluable for debugging a rule
that never fires). Optional `--param-grid risk.per_trade.stop_loss.mult=1.5,2,2.5`
runs a small grid (each cell is just another config version).

**Promotion pipeline** (encouraged, and partially enforced by §7's go-live gate):

```
backtest-lite (months of history)
   → paper (live prices, ≥3 sessions / ≥10 round-trips)
      → live (explicit confirmation + caps)
```

---

## 10. Directory Layout

```
trading/
  engine/                    # core (users never edit)
    brokers/                 # broker.py (ABC), kite_broker.py, paper_broker.py
    data/                    # feeds, candle aggregator, candle cache
    rules/                   # DSL grammar, compiler, evaluator
    indicators/              # built-ins + registry
    risk/                    # RiskManager, RiskGovernor, kill-switch
    execution/               # ExecutionGateway, idempotency, safety rails
    runtime/                 # EventBus, Scheduler, StrategyRunner, state machine
    persistence/             # SQLAlchemy models, migrations (alembic)
    backtest/                # SimClock, HistoricalFeed, report
  strategies/                # user plugin .py files (auto-discovered)
  indicators/                # user custom indicators (auto-discovered)
  configs/
    defaults.yaml
    templates/               # per-strategy-class default trees
    instances/               # user instance YAMLs
  docs/research/strategy-engine-design.md   # this document
```

---

## 11. Open Questions & Future Work

- **Options strategies as first-class multi-leg units** (spreads/straddles with
  leg-linked risk) — v1 handles single-leg derivatives via the `derivative`
  universe resolver; multi-leg needs a `LegGroup` abstraction in sizing/risk.
- **Websocket instrument limits** (Kite: 3000 tokens/connection) — fine for v1;
  large screener universes may need subscription prioritization.
- **UI**: the JSON-Schema-from-Pydantic approach makes a form-based strategy
  builder cheap; sequencing after CLI + YAML workflow is solid.
- **Backtest fidelity upgrades**: minute-data-driven fills for daily strategies;
  spread/impact models from recorded depth.
- **Multi-account / multi-broker**: the Broker ABC is already the seam; add
  per-instance `broker: kite|<other>` when needed.
- **Config hot-reload granularity**: v1 applies non-structural changes at next
  bar close and requires restart for structural ones; finer-grained live
  tuning (e.g., trailing params) could be whitelisted later.
