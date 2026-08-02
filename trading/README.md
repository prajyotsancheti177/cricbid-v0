# AutoTrader India

An automated, self-driving trading application for the Indian stock market (NSE) built on
**Zerodha Kite Connect**, with a customizable-at-every-level strategy engine and a
first-class **paper trading** mode so any strategy can be tested with live market
behaviour but zero real money.

> ⚠️ **Risk disclaimer**: algorithmic trading can lose real money quickly. This project
> defaults to paper mode everywhere; live trading is gated behind multiple explicit
> switches and confirmations. Nothing here is investment advice.

## What's inside

```
trading/
├── backend/          # FastAPI + strategy engine (Python)
│   ├── app/
│   │   ├── brokers/      # Broker interface: KiteBroker (live) + PaperBroker (simulated fills)
│   │   ├── data/         # Feeds: Kite historical/quotes, or deterministic SimFeed (no creds needed)
│   │   ├── engine/       # Runner loop, risk rails, rule DSL, runtime wiring
│   │   ├── strategies/   # Strategy base + built-ins (auto-discovered)
│   │   ├── backtest/     # Backtester reusing the exact same strategy code
│   │   ├── indicators/   # Registry-based indicator library (add your own)
│   │   └── api/          # REST API
│   └── strategies_user/  # 🔌 drop your own .py strategies here — auto-discovered
├── frontend/         # React + Vite + Tailwind dashboard
├── configs/examples/ # example strategy configs (YAML)
└── docs/research/    # agent research: Kite API, Indian strategies, engine design
```

## Quick start (no Kite account needed)

```bash
# backend
cd trading/backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000        # http://localhost:8000/docs

# frontend (second terminal)
cd trading/frontend
npm install && npm run dev                         # http://localhost:5173
```

Without Kite credentials the app runs on a **deterministic simulated feed** — you can
create strategies, paper trade, and backtest immediately. With credentials, paper
trading fills against **real market quotes**.

## Connecting Zerodha Kite

1. Create a Kite Connect app at <https://developers.kite.trade> (₹500/month for market
   data; order APIs are free on personal apps — see `docs/research/kite-api.md`).
   Set the redirect URL to `http://localhost:8000/api/auth/kite/callback`.
2. `cp backend/.env.example backend/.env` and fill `TRADING_KITE_API_KEY/SECRET`.
3. In the UI: **Settings → Get login URL**, log in on Zerodha, and the callback stores
   your session. **Access tokens expire daily (~6 AM IST)** — re-login each morning.

## The strategy model: customizable at every level

A strategy instance = a strategy type + a layered config tree. Every layer is
independent and editable per instance (form or raw JSON in the UI, YAML example in
`configs/examples/`):

| Layer       | What you control |
|-------------|------------------|
| `universe`  | exchange, symbol list |
| `data`      | timeframe (1m…day), lookback window |
| `filters`   | entry time window, square-off time, max trades/day, price/volume floors, plus an **extra declarative rule** ANDed onto every entry |
| `sizing`    | fixed qty / fixed ₹ value / % of capital / risk-based (risk X% of equity to the stop) |
| `risk`      | stop-loss %, take-profit %, trailing stop, max positions, daily max-loss kill switch, per-position notional cap |
| `execution` | MIS/CNC, MARKET/LIMIT (+offset), paper slippage, shorting on/off |
| `params`    | the strategy type's own knobs (schema-driven form in the UI) |

### Three ways to create your own strategy

1. **Configure a built-in**: `ma_crossover`, `rsi_reversion`, `supertrend`, `orb`,
   `vwap`, `bollinger_squeeze`, `macd_trend` — every parameter exposed.
2. **Declarative rules, zero code** — the `custom_rules` type:
   ```
   long_entry:  ema(9) crosses_above ema(21) and rsi(14) < 60
   long_exit:   ema(9) crosses_below ema(21)
   ```
   Any registered indicator works in rules (`sma, ema, rsi, atr, macd, vwap,
   supertrend, bollinger, stochastic, roc, hhv/llv`, …). Rules are parsed into a
   whitelisted AST — no arbitrary code execution.
3. **Python plugin**: drop a file into `backend/strategies_user/` subclassing
   `Strategy` (see `example_gap_fade.py`). It is auto-discovered, gets a generated
   config UI from its `param_schema`, and inherits the whole filter/sizing/risk/
   execution pipeline. Strategies only emit intents (`ctx.enter_long/exit`) — they
   can never bypass risk management or talk to the broker directly.

## Paper trading & backtesting

- **Paper mode** (default): each strategy gets an isolated virtual account
  (₹10L default) with fills simulated at quote ± slippage and Zerodha's real
  charge model (brokerage, STT, GST, stamp…). Switching a strategy paper↔live
  changes *nothing* in the strategy — only the broker behind it.
- **Backtest** first: the backtester replays historical candles (Kite historical
  when connected, deterministic synthetic data otherwise) through the *same*
  strategy code with next-bar-open fills, and reports return, drawdown, win rate,
  Sharpe estimate, and total charges.
- Recommended promotion path: **backtest → paper → live**.

## Live-trading safety rails (all enforced outside strategy code)

- Master switch `TRADING_LIVE_TRADING_ENABLED` (default **false**).
- Strategies are always created in paper mode; switching to live requires
  `?confirm_live=true` and a typed confirmation in the UI; starting a live strategy
  requires confirmation again.
- Global caps: max live orders/day, max notional per order, global daily-loss halt
  (`.env`), per-strategy daily-loss kill switch, forced MIS square-off before
  Zerodha's 15:20 cut-off.
- **KILL SWITCH** button (and `POST /api/kill-switch`): flattens every position and
  stops every strategy.

## API

Interactive docs at `http://localhost:8000/docs`. Highlights:
`/api/strategies` (CRUD + start/pause/stop + revisions), `/api/backtest`,
`/api/positions|orders|trades|pnl|logs`, `/api/account`, `/api/rules/validate`,
`/api/candles/{symbol}`, `/api/auth/kite/*`, `/api/kill-switch`.

## Research docs

Produced by dedicated research agents, in `docs/research/`:
- `kite-api.md` — Kite Connect auth, rate limits, order params, websocket, pricing, pitfalls
- `strategies-india.md` — 10 India-tuned strategy families + cost model & universe selection
- `strategy-engine-design.md` — the architecture behind this engine
