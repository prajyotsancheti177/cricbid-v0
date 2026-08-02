# Zerodha Kite Connect API — Reference for Automated Trading (NSE/BSE)

> Compiled 2026-07-02. Primary sources: the official `pykiteconnect` library source
> (github.com/zerodha/pykiteconnect, `kiteconnect/connect.py` and `kiteconnect/ticker.py`,
> verified directly), the Kite Connect v3 HTTP docs (kite.trade/docs/connect/v3/), the
> Kite Connect developer forum, and Zerodha support pages. The kite.trade docs site was
> not directly reachable from this environment; facts sourced from it were cross-checked
> against the library source and forum posts. Items that could not be fully verified are
> marked **[unverified]**.

- REST root: `https://api.kite.trade`
- Login root: `https://kite.zerodha.com/connect/login`
- WebSocket root: `wss://ws.kite.trade`
- API version header: `X-Kite-Version: 3` (required on every request)
- Auth header: `Authorization: token api_key:access_token`
- Python client: `pip install kiteconnect` (v5+ requires Python 3; uses Twisted/autobahn for the ticker)

---

## 1. Authentication flow

Kite Connect uses a three-legged OAuth-like flow. There is **no permanent API token**;
sessions must be re-established every trading day.

### Flow

1. **Redirect the user to the login URL**:
   `https://kite.zerodha.com/connect/login?api_key=xxx&v=3`
   (`kite.login_url()` builds exactly this.)
2. User logs in on Zerodha's page (user ID + password + TOTP/app-code 2FA). Zerodha then
   redirects to the **redirect URL registered for the app** on developers.kite.trade, with
   `request_token=...&action=login&status=success` appended as query params.
   The `request_token` is single-use and short-lived (a few minutes).
3. **Exchange the request_token for an access_token**:
   `POST https://api.kite.trade/session/token` with form fields
   `api_key`, `request_token`, `checksum` where
   **`checksum = SHA-256(api_key + request_token + api_secret)`** (hex digest of the
   plain concatenation, in that order).
4. Response `data` contains: `access_token`, `public_token` (for websocket-only/browser
   use), `refresh_token` (empty for normal apps), `user_id`, `user_name`, `email`,
   `login_time`, `exchanges`, `products`, `order_types`, `avatar_url`, etc.
5. Send `Authorization: token api_key:access_token` on every subsequent request.

### pykiteconnect

```python
from kiteconnect import KiteConnect

kite = KiteConnect(api_key="your_api_key")
print(kite.login_url())                    # send user here; get request_token from redirect

data = kite.generate_session("request_token_here", api_secret="your_secret")
kite.set_access_token(data["access_token"])   # generate_session also sets it automatically

# persist for the rest of the day:
# json.dump({"access_token": data["access_token"]}, open("token.json", "w"))

# next process start, same day:
kite = KiteConnect(api_key="your_api_key", access_token=saved_token)
```

### Token expiry

- The `access_token` is valid for **one trading day only**. All tokens are flushed
  server-side **early each morning** — officially "around 6:00 AM"; forum reports say the
  actual flush happens around **07:30 AM IST** in practice. Do not rely on any time later
  than ~6:00 AM; regenerate before market open.
- Logging in again (web/app) does not invalidate the API session, but calling
  `kite.invalidate_access_token()` does, as can a password change.
- `refresh_token` / `renew_access_token()` exist in the API surface but refresh tokens are
  **only issued to specially-approved (exchange-approved platform) apps** — normal Connect
  apps get an empty `refresh_token` and must redo the full login daily. **[verified in
  library; approval detail per forum]**
- On token failure the API returns HTTP 403 with `error_type: "TokenException"`.
  pykiteconnect raises `kiteconnect.exceptions.TokenException` and, if registered, calls
  `kite.set_session_expiry_hook(callback)` — use this to trigger your re-login path.

### How automated apps handle daily re-login

SEBI/exchange rules require a daily authenticated login (2FA); Zerodha deliberately does
not offer a headless token grant. Common patterns:

1. **Manual morning step (recommended/compliant)**: a small web endpoint that you open
   once each morning; it redirects to the login URL, receives the `request_token` on the
   registered redirect URL, calls `generate_session`, and stores the token (file/DB/redis)
   for all downstream processes.
2. **Semi-automated with TOTP**: scripted login using `requests` + `pyotp` against
   `kite.zerodha.com/api/login` and `/api/twofa` to fetch the request_token, then normal
   token exchange. Widely used in practice but **not officially supported** and brittle —
   Zerodha discourages it and login-page changes can break it.
3. Store the token with the date; on any `TokenException` mid-session, alert and halt new
   order placement rather than blindly retrying.

---

## 2. Order APIs

### Endpoints (from `_routes` in connect.py)

| Action | Method + path | pykiteconnect |
|---|---|---|
| Place | `POST /orders/{variety}` | `kite.place_order(...)` → returns `order_id` (string) |
| Modify | `PUT /orders/{variety}/{order_id}` | `kite.modify_order(...)` |
| Cancel | `DELETE /orders/{variety}/{order_id}` | `kite.cancel_order(variety, order_id)` |
| Orderbook | `GET /orders` | `kite.orders()` |
| Order history | `GET /orders/{order_id}` | `kite.order_history(order_id)` |
| Tradebook | `GET /trades` | `kite.trades()` |
| Trades of one order | `GET /orders/{order_id}/trades` | `kite.order_trades(order_id)` |
| Auto-slice place | `POST /orders/{variety}` + `autoslice=true` | `kite.place_autoslice_order(...)` (v5.2+, splits qty over exchange freeze limits; returns dict with parent `order_id` and `children`) |
| Margin required for order(s) | `POST /margins/orders` | `kite.order_margins(params)` |
| Basket margin | `POST /margins/basket` | `kite.basket_order_margins(params)` |
| Charges preview | `POST /charges/orders` | `kite.get_virtual_contract_note(params)` |
| GTT triggers | `GET/POST/PUT/DELETE /gtt/triggers` | `kite.place_gtt(...)` etc. |

### Order parameters (exact names the API/library expects)

| Param | Values / notes |
|---|---|
| `variety` | `regular`, `amo` (after-market), `co` (cover), `iceberg`, `auction` (library constants `VARIETY_REGULAR`, `VARIETY_AMO`, `VARIETY_CO`, `VARIETY_ICEBERG`, `VARIETY_AUCTION`). Note: bracket orders (`bo`) were discontinued in 2020. |
| `exchange` | `NSE`, `BSE`, `NFO`, `BFO`, `CDS`, `BCD`, `MCX` |
| `tradingsymbol` | e.g. `INFY`, `NIFTY25JULFUT`, `NIFTY2571025000CE` (take exact symbols from the instruments dump) |
| `transaction_type` | `BUY` / `SELL` |
| `quantity` | integer; in units of shares/lots-in-units (for derivatives, quantity = lots × lot_size) |
| `product` | `CNC` (equity delivery), `MIS` (intraday, auto square-off), `NRML` (overnight F&O/CDS/MCX), `CO` |
| `order_type` | `MARKET`, `LIMIT`, `SL` (stoploss-limit: needs `trigger_price` + `price`), `SL-M` (stoploss-market: needs `trigger_price`; library constant is `ORDER_TYPE_SLM`) |
| `price` | for LIMIT/SL; must be a multiple of tick_size |
| `trigger_price` | for SL / SL-M / CO |
| `validity` | `DAY`, `IOC`, `TTL` (with `validity_ttl` = minutes the order stays live) |
| `disclosed_quantity` | equity only; ≥ 10% of quantity |
| `iceberg_legs` | 2–10 (variety `iceberg` only; each leg = quantity/legs, min leg sizes apply) |
| `iceberg_quantity` | per-leg quantity for iceberg |
| `auction_number` | for `auction` variety (from `kite.get_auction_instruments()`) |
| `tag` | optional alphanumeric string (max 20 chars) echoed back on the order — use to mark strategy origin |
| `market_protection` | `-1` for automatic protection, or 0–100 (%) — caps how far a MARKET/SL-M order can execute from LTP |

`modify_order` accepts: `variety`, `order_id`, `parent_order_id` (for CO legs),
`quantity`, `price`, `order_type`, `trigger_price`, `validity`,
`disclosed_quantity`, `market_protection`.
`cancel_order(variety, order_id, parent_order_id=None)`; `exit_order()` is the alias used
to exit CO positions (cancels/exits the second leg).

### Example

```python
order_id = kite.place_order(
    variety=kite.VARIETY_REGULAR,
    exchange=kite.EXCHANGE_NSE,
    tradingsymbol="INFY",
    transaction_type=kite.TRANSACTION_TYPE_BUY,
    quantity=1,
    product=kite.PRODUCT_MIS,
    order_type=kite.ORDER_TYPE_LIMIT,
    price=1450.50,
    validity=kite.VALIDITY_DAY,
    tag="strat1",
)

kite.modify_order(variety=kite.VARIETY_REGULAR, order_id=order_id, price=1451.00)
kite.cancel_order(variety=kite.VARIETY_REGULAR, order_id=order_id)
```

### Order lifecycle / statuses

Placement is **asynchronous**: a successful `place_order` only means the order was
accepted by Zerodha's OMS; final state arrives via polling `orders()` or via the
WebSocket order update. Statuses you will see in `status`:

- Transient/interim: `PUT ORDER REQ RECEIVED`, `VALIDATION PENDING`, `OPEN PENDING`,
  `MODIFY VALIDATION PENDING`, `MODIFY PENDING`, `CANCEL PENDING`,
  `TRIGGER PENDING` (SL/SL-M waiting for trigger), `AMO REQ RECEIVED`
- Stable: `OPEN`, `COMPLETE`, `CANCELLED`, `REJECTED` (library constants exist for the
  last three: `STATUS_COMPLETE`, `STATUS_REJECTED`, `STATUS_CANCELLED`)

Treat only `COMPLETE / CANCELLED / REJECTED` as terminal; interim strings can vary, so
code should not enumerate them exhaustively. Rejection reason is in `status_message`.
Key order fields: `order_id`, `exchange_order_id`, `status`, `filled_quantity`,
`pending_quantity`, `cancelled_quantity`, `average_price`, `order_timestamp`,
`exchange_timestamp`, `tag`.

### Order count limits (per Zerodha policy)

- Max **10 orders/second** per API key (order endpoints).
- Max **200 order placements/minute** per API key.
- Max **3,000 orders/day** per API key (forum answers have also cited 5,000 at some point
  — assume 3,000 to be safe) **[unverified exact daily cap]**.
- An individual order can be **modified at most ~25 times**, after which modifications are
  blocked **[unverified]**.
- Exchange **freeze quantity** limits cap single-order size in F&O (e.g. NIFTY ~1800 qty,
  varies); use `place_autoslice_order` or slice manually.

---

## 3. Market data (REST)

### Quote endpoints

Instruments are addressed as `exchange:tradingsymbol` (e.g. `NSE:INFY`, `NSE:NIFTY 50`
for the index), passed as repeated `i=` query params.

| Endpoint | pykiteconnect | Returns | Max instruments/request |
|---|---|---|---|
| `GET /quote` | `kite.quote(["NSE:INFY", ...])` | full quote: `last_price`, `volume`, OHLC, `oi`, `depth` (5 levels), `upper_circuit_limit`, `lower_circuit_limit`, `average_price`, timestamps | up to **500** |
| `GET /quote/ohlc` | `kite.ohlc([...])` | `instrument_token`, `last_price`, `ohlc{}` | up to **1000** |
| `GET /quote/ltp` | `kite.ltp([...])` | `instrument_token`, `last_price` only | up to **1000** |

Quote REST calls are rate-limited to **1 req/s** — these are snapshot APIs. For anything
continuous, use the WebSocket.

```python
q = kite.quote("NSE:INFY")
print(q["NSE:INFY"]["last_price"], q["NSE:INFY"]["depth"]["buy"][0])
print(kite.ltp("NSE:NIFTY 50")["NSE:NIFTY 50"]["last_price"])
```

### Historical candle data

`GET /instruments/historical/{instrument_token}/{interval}?from=...&to=...&continuous=0&oi=0`
(needs the historical-data permission on the app subscription).

```python
from datetime import datetime
candles = kite.historical_data(
    instrument_token=738561,              # RELIANCE, from instruments dump
    from_date=datetime(2026, 6, 1, 9, 15),   # or "2026-06-01 09:15:00"
    to_date=datetime(2026, 6, 30, 15, 30),
    interval="5minute",
    continuous=False,                     # True = continuous futures series
    oi=False,                             # True adds open interest
)
# -> [{"date": datetime(tz aware IST), "open":..., "high":..., "low":..., "close":..., "volume":..., ("oi":...)}, ...]
```

Intervals and **max date span per request** (loop over windows for more):

| interval | max days/request |
|---|---|
| `minute` | 60 |
| `2minute` | 60 |
| `3minute` | 100 |
| `4minute` | 100 |
| `5minute` | 100 |
| `10minute` | 100 |
| `15minute` | 200 |
| `30minute` | 200 |
| `60minute` | 400 |
| `day` | 2000 |

Rate limit: **3 req/s**. There is no documented daily request cap, but hammering it gets
throttled with HTTP 429 (`NetworkException`). Intraday history goes back years
(Zerodha advertises ~10 years of intraday for NSE/BSE since the 2025 bundling); candles
are built from Zerodha's own tick stream and can differ marginally from exchange bhavcopy.

### Instruments dump (CSV)

- `GET https://api.kite.trade/instruments` — full dump, all exchanges (gzipped CSV,
  several MB, ~100k rows).
- `GET https://api.kite.trade/instruments/{exchange}` — e.g. `/instruments/NFO`.
- Refreshed daily (~8:00 AM IST); **fetch once per day and cache** — it is not meant to
  be polled.

CSV columns: `instrument_token`, `exchange_token`, `tradingsymbol`, `name`, `last_price`,
`expiry`, `strike`, `tick_size`, `lot_size`, `instrument_type` (EQ/FUT/CE/PE),
`segment` (e.g. NFO-OPT, INDICES), `exchange`.

`instrument_token` is the numeric ID used for WebSocket subscriptions and historical
data; `tradingsymbol`+`exchange` is what order APIs take. `lot_size` gives derivative lot
sizes; equity lot_size is 1.

```python
import pandas as pd
instruments = pd.DataFrame(kite.instruments("NFO"))   # library parses CSV to list[dict]
nifty_fut = instruments[(instruments.name == "NIFTY") & (instruments.instrument_type == "FUT")]
```

---

## 4. WebSocket streaming — KiteTicker

- URL: `wss://ws.kite.trade?api_key=xxx&access_token=yyy` (library builds this).
- Binary frames carry ticks (big-endian packed); text frames carry JSON (order updates,
  errors). 1-byte heartbeats keep the connection alive.
- **Limits: max 3,000 instruments per connection; up to 3 connections per api_key**
  (soft limit) → 9,000 instruments max. Subscribing beyond 3,000 fails with an error but
  leaves the connection up.
- Ticks are **not** every trade — Kite streams up to ~1–2 snapshots per second per
  instrument **[unverified exact frequency]**.

### Modes (packet sizes from ticker.py)

| Mode | Constant | Payload |
|---|---|---|
| `ltp` | `MODE_LTP` | 8 bytes: `instrument_token`, `last_price` |
| `quote` (default on subscribe) | `MODE_QUOTE` | 44 bytes: + `last_traded_quantity`, `average_traded_price`, `volume_traded`, `total_buy_quantity`, `total_sell_quantity`, `ohlc`, `change` |
| `full` | `MODE_FULL` | 184 bytes: quote + `last_trade_time`, `oi`, `oi_day_high`, `oi_day_low`, `exchange_timestamp`, `depth` (5 buy + 5 sell levels: `price`, `quantity`, `orders`) |

Indices stream 28/32-byte packets (LTP+OHLC+change, full adds `exchange_timestamp`) and
have `tradable: False`.

### Usage

```python
import logging
from kiteconnect import KiteTicker

kws = KiteTicker("your_api_key", "your_access_token")

def on_ticks(ws, ticks):          # ticks = list of dicts as described above
    for t in ticks:
        print(t["instrument_token"], t["last_price"])

def on_connect(ws, response):
    ws.subscribe([738561, 5633])              # instrument_tokens (RELIANCE, ACC)
    ws.set_mode(ws.MODE_FULL, [738561])       # default mode after subscribe is quote

def on_order_update(ws, data):    # order postbacks over the same socket
    print(data["order_id"], data["status"], data["filled_quantity"])

def on_close(ws, code, reason):
    ws.stop()                     # stops the reactor; disables auto-reconnect

kws.on_ticks = on_ticks
kws.on_connect = on_connect
kws.on_order_update = on_order_update

kws.connect(threaded=True)        # threaded=True runs Twisted reactor in a daemon thread
                                  # omit for a blocking main-thread loop
```

### Reconnection behavior (built into the library)

- Auto-reconnect is **on by default** (`reconnect=True`), exponential backoff starting
  ~2s up to `reconnect_max_delay` (default 60s, min 5s), for `reconnect_max_tries`
  attempts (default 50, max 300).
- Callbacks: `on_reconnect(ws, attempts_count)` on each retry, `on_noreconnect(ws)` when
  retries are exhausted (page an operator / restart process here).
- The library **automatically resubscribes** all previously subscribed tokens with their
  modes after a reconnect (`resubscribe()` on non-first `on_open`).
- Ghost-connection guard: client pings every 2.5s; if no pong for >5s it drops and
  reconnects. **You will lose ticks during the gap** — reconcile state via REST
  (`positions()`, `orders()`, `quote()`) after reconnecting.
- Calling `ws.stop()` inside `on_close` disables reconnection entirely (Twisted reactor
  cannot restart in-process).
- An expired access_token causes the connect/reconnect to be refused (403) — reconnection
  cannot fix that; you must mint a new token and create a new KiteTicker.

---

## 5. Postbacks / order updates

Two delivery channels for order state changes:

1. **WebSocket order updates (preferred for a trading bot)**: JSON text messages
   `{"type": "order", "data": {...}}` on the same ticker socket; pykiteconnect surfaces
   them via `kws.on_order_update(ws, data)`. `data` is the full order object
   (`order_id`, `status`, `filled_quantity`, `average_price`, `tag`, ...). You get one
   update per state transition, including partial fills.
2. **HTTP postbacks**: if a **postback URL** is registered on the app (Connect apps
   only), Kite POSTs the JSON order payload to it on every update. Verify authenticity
   with `checksum = SHA-256(order_id + order_timestamp + api_secret)` included in the
   payload. Needs a public HTTPS endpoint; mainly for platforms serving many users.

Even with updates, poll `kite.orders()` periodically (e.g. every 10–30s) as a
reconciliation safety net — websocket messages can be missed across disconnects.

---

## 6. Rate limits

Official per-endpoint-category limits (per api_key; aggregated across all users of the
key):

| Category | Limit |
|---|---|
| Quote (`/quote*`) | **1 req/s** |
| Historical candles | **3 req/s** |
| Order placement/modify/cancel | **10 req/s** |
| Everything else (orders list, positions, margins, ...) | **10 req/s** |

Plus order-count limits: **10 orders/s**, **200 orders/min**, **~3,000 orders/day**, and
~25 modifications per order (see §2). Exceeding limits returns HTTP 429
(`NetworkException` in pykiteconnect); repeated abuse can get the app flagged/suspended.
pykiteconnect does **not** throttle for you — implement client-side rate limiting (token
bucket per category) and exponential backoff on 429.

---

## 7. Funds, margins, positions, holdings

| Endpoint | pykiteconnect | Notes |
|---|---|---|
| `GET /user/profile` | `kite.profile()` | user_id, products/exchanges enabled |
| `GET /user/margins` | `kite.margins()` | both segments |
| `GET /user/margins/{segment}` | `kite.margins("equity")` / `kite.margins(kite.MARGIN_EQUITY)` | segments: `equity`, `commodity` |
| `GET /portfolio/positions` | `kite.positions()` | returns `{"net": [...], "day": [...]}` |
| `GET /portfolio/holdings` | `kite.holdings()` | demat holdings (CNC) |
| `PUT /portfolio/positions` | `kite.convert_position(...)` | convert MIS↔CNC/NRML intraday |
| `POST /margins/orders` | `kite.order_margins([...])` | margin needed for hypothetical orders (JSON body) |
| `POST /margins/basket?consider_positions=true` | `kite.basket_order_margins([...])` | basket with hedge benefit; `mode="compact"` for totals only |

Margins response (per segment): `net` (total tradable balance), and
`available: {cash, live_balance, opening_balance, intraday_payin, collateral}`,
`utilised: {debits, exposure, span, option_premium, m2m_realised, m2m_unrealised, ...}`.

Position fields: `tradingsymbol`, `exchange`, `product`, `quantity` (signed net),
`overnight_quantity`, `average_price`, `last_price`, `pnl`, `m2m`, `realised`,
`unrealised`, `buy_quantity`/`sell_quantity`, `value`.
Holdings fields: `tradingsymbol`, `isin`, `quantity`, `t1_quantity`, `average_price`,
`last_price`, `pnl`, `collateral_quantity`.

```python
funds = kite.margins("equity")
cash = funds["available"]["live_balance"]

net_positions = kite.positions()["net"]
open_pos = [p for p in net_positions if p["quantity"] != 0]
```

---

## 8. Costs

Pricing has changed substantially over time — **verify current pricing at
developers.kite.trade before budgeting**:

- **Historical**: ₹2,000/month for a Kite Connect app + ₹2,000/month historical-data
  add-on (the long-standing pricing through 2024).
- **Feb 2025**: historical data add-on abolished — bundled into the base Connect
  subscription (with ~10 years of intraday NSE/BSE data).
- **Mar 2025 onwards (current model)**: order placement + account/portfolio APIs are
  **free** ("Kite Connect Personal" app type for individuals — no market-data access);
  the **market data APIs (live quotes + historical) cost ₹500/month** on a paid Connect
  app. Publisher (order-basket) API remains free.
- Per-API-call charges: none. Costs are flat monthly per app.
- **Exchange/statutory charges still apply to every trade** regardless of API pricing:
  brokerage (₹0 equity delivery; ₹20 or 0.03%/executed order intraday & F&O), STT/CTT,
  exchange transaction charges, SEBI fees, stamp duty, GST, and DP charges on delivery
  sells. Use `kite.get_virtual_contract_note()` (`POST /charges/orders`) to compute exact
  charges per order, and factor them into strategy PnL — high-frequency MIS strategies
  can be eaten alive by the flat ₹20/order.

---

## 9. pykiteconnect quick cookbook

```python
# ---- setup & auth (daily) ----
from kiteconnect import KiteConnect, KiteTicker
kite = KiteConnect(api_key=API_KEY)
data = kite.generate_session(request_token, api_secret=API_SECRET)
access_token = data["access_token"]

kite.set_session_expiry_hook(lambda: alert_and_relogin())

# ---- instruments (cache daily) ----
nse = kite.instruments("NSE")     # list of dicts, lot_size/tick_size parsed to numbers
token_by_symbol = {i["tradingsymbol"]: i["instrument_token"] for i in nse}

# ---- market snapshot ----
kite.ltp("NSE:INFY"); kite.ohlc("NSE:INFY"); kite.quote("NSE:INFY")

# ---- historical ----
candles = kite.historical_data(token_by_symbol["INFY"], "2026-06-01", "2026-06-30", "15minute")

# ---- orders ----
oid = kite.place_order(variety=kite.VARIETY_REGULAR, exchange=kite.EXCHANGE_NSE,
                       tradingsymbol="INFY", transaction_type=kite.TRANSACTION_TYPE_BUY,
                       quantity=1, product=kite.PRODUCT_MIS,
                       order_type=kite.ORDER_TYPE_SL, price=1451.0, trigger_price=1450.0,
                       validity=kite.VALIDITY_DAY, tag="strat1")
hist = kite.order_history(oid)            # list of state transitions
kite.cancel_order(kite.VARIETY_REGULAR, oid)

# ---- portfolio ----
kite.margins("equity"); kite.positions(); kite.holdings(); kite.orders(); kite.trades()

# ---- streaming ----
kws = KiteTicker(API_KEY, access_token)
kws.on_ticks = lambda ws, ticks: queue.put(ticks)      # keep callbacks non-blocking!
kws.on_connect = lambda ws, resp: (ws.subscribe(tokens), ws.set_mode(ws.MODE_QUOTE, tokens))
kws.on_order_update = lambda ws, d: order_queue.put(d)
kws.on_noreconnect = lambda ws: page_operator()
kws.connect(threaded=True)
```

Exceptions (all in `kiteconnect.exceptions`, subclasses of `KiteException` with `.code`):
`TokenException` (403, session dead), `InputException` (400, bad params),
`OrderException` (order placement/mod failure), `NetworkException` (429/5xx, throttled),
`PermissionException`, `DataException`, `GeneralException`.

---

## 10. Common pitfalls

1. **Token expiry mid-run**: tokens die every morning (~6:00–7:30 AM IST flush). A bot
   started yesterday will start throwing `TokenException` today. Regenerate the token
   before 9:00 AM daily; use `set_session_expiry_hook`; on expiry, stop placing new
   orders until re-authed. Remember the **websocket also dies** with the token.
2. **`place_order` success ≠ execution**: it returns as soon as the OMS accepts. The
   order can still be `REJECTED` (margin, circuit, RMS). Always confirm via order update
   / `order_history` before assuming a position exists.
3. **MIS auto square-off**: Zerodha RMS force-closes open MIS/CO positions starting
   **~3:20 PM IST for equity and equity F&O** (currency ~4:45 PM, commodity ~25 min
   before close), with a ₹50+GST per-position auto-square-off charge. Exit MIS positions
   yourself by ~3:15 PM. New MIS orders are blocked after square-off begins.
4. **Market hours**: NSE/BSE equity 9:15–15:30 IST; **pre-open 9:00–9:15** (order entry
   only 9:00–9:08 with random close, matching till ~9:12). Orders sent outside hours are
   rejected unless `variety="amo"`. AMO window is roughly post-close to next 9:15 (AMO
   for equity accepted ~3:45 PM–8:57 AM **[unverified exact window]**). No trading on
   exchange holidays — keep a holiday calendar; there are also special Muhurat sessions.
5. **Circuit limits**: every stock has daily price bands (`upper_circuit_limit` /
   `lower_circuit_limit` in `/quote`). LIMIT prices outside the band are rejected; a
   stock locked at circuit simply won't fill. **Stock options accept only LIMIT orders**
   (market orders blocked by Zerodha); use marketable limit orders instead of MARKET for
   illiquid contracts to avoid disastrous fills — or `market_protection`.
6. **Rate limits are per api_key, not per process** — multiple strategies sharing a key
   share the 1/s quote and 3/s historical budgets. Centralize API access behind one
   client with a rate limiter.
7. **Tick callbacks must be fast**: `on_ticks` runs on the Twisted reactor thread —
   blocking there stalls the socket and triggers the pong-timeout reconnect. Push ticks
   to a `queue.Queue` and process in another thread.
8. **Websocket gaps**: after any reconnect you've missed ticks and possibly order
   updates. `volume_traded` is cumulative for the day, which helps rebuild candles, but
   always re-fetch `orders()`/`positions()` after reconnects.
9. **Instrument tokens change**: derivative tokens change per expiry, and equity tokens
   can change after corporate actions. Never hardcode; refresh the instruments dump daily
   and map by `tradingsymbol`.
10. **Quantity semantics in F&O**: `quantity` is in units, not lots (1 NIFTY lot of 75 →
    `quantity=75`), and must be a multiple of `lot_size`; single orders above the freeze
    quantity are rejected (auto-slice or split).
11. **Price ticks**: prices must be multiples of `tick_size` (₹0.05 for most equity,
    ₹0.01 for many others post-2024 changes) or the order is rejected with
    `InputException`.
12. **`historical_data` date-span caps** (§3): requests over the per-interval max return
    an error — window your backfills.
13. **Postbacks only fire for orders placed via that app's api_key** (except the
    "full access" apps); orders placed manually on Kite web/app still show in `orders()`
    polling and in websocket order updates for the connected user.
14. **CO/iceberg restrictions**: cover orders are unavailable on many instruments and
    disabled during volatile periods; iceberg needs `validity=TTL` support awareness and
    min leg sizes.
15. **Don't log secrets**: `api_secret` and `access_token` grant full trading access.
    The access_token cannot be scoped or made read-only.
