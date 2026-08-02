# Algorithmic Trading Strategies for the Indian Market (NSE / Zerodha)

Research notes for systematic strategies on NSE cash equities and index instruments,
executable via Zerodha (Kite Connect API). Focus: liquid NIFTY-universe stocks and
index products. All parameters below are *starting defaults for backtesting*, not
guarantees — every one of them must be validated on Indian data (NSE ticks/1-min bars)
with the full cost model in Section 12 applied.

Last updated: 2026-07-02.

---

## Table of contents

1. [Opening Range Breakout (ORB)](#1-opening-range-breakout-orb)
2. [Moving Average Crossover](#2-moving-average-crossover)
3. [RSI Mean Reversion (RSI-2 and RSI-14)](#3-rsi-mean-reversion)
4. [Supertrend Following](#4-supertrend-following)
5. [VWAP Reversion / VWAP Trend](#5-vwap-reversion--vwap-trend)
6. [Bollinger Band Squeeze / Breakout](#6-bollinger-band-squeeze--breakout)
7. [Momentum / Rotation (NIFTY 200 top-N)](#7-momentum--rotation-positional)
8. [Gap Trading (Gap-and-Go vs Gap-Fade)](#8-gap-trading)
9. [Pairs / Statistical Arbitrage](#9-pairs--statistical-arbitrage)
10. [MACD Trend-Confirmation Combos](#10-macd-trend-confirmation-combos)
11. [Universe Selection for India](#11-universe-selection-for-india)
12. [Realistic Cost Model (Zerodha)](#12-realistic-cost-model-zerodha)
13. [Slippage Assumptions](#13-slippage-assumptions)
14. [Market Timing and Session Structure](#14-market-timing-and-session-structure)
15. [India-Specific Structural Rules (cheat sheet)](#15-india-specific-structural-rules-cheat-sheet)

---

## India-wide ground rules (apply to every strategy below)

- **Session:** NSE cash market 09:15–15:30 IST. Pre-open auction 09:00–09:08.
- **MIS auto square-off:** Zerodha force-closes equity MIS (intraday) positions from
  **~15:20 IST** and charges **₹50 + 18% GST per position** for doing it. Every
  intraday strategy must self-square-off by **15:15** at the latest.
- **No shorting in CNC:** you cannot short a stock for delivery. Shorts are intraday
  MIS only (must cover same day) or via F&O (futures / buying puts). A short CNC sale
  that isn't covered goes to **auction settlement with penalties up to ~20%**.
- **T+1 settlement:** stocks bought today are delivered T+1. Selling stock bought
  yesterday (BTST) is allowed on Zerodha but carries early-payin/auction risk;
  same-day sell of a CNC buy is treated as intraday.
- **Leverage:** SEBI peak-margin rules cap intraday equity leverage at **5x max**
  (20% margin, VaR+ELM floor); many stocks get less. No broker offers more.
- **Circuit limits:** non-F&O stocks have hard price bands (2/5/10/20%). A stock
  locked at circuit has no counterparty — stop-losses do not fill. Index-level
  breakers halt the whole market at ±10/15/20%.
- **STT drag:** securities transaction tax makes true high-frequency strategies on
  cash equities uneconomical. Anything with < ~0.3–0.4% average gross edge per
  round trip intraday is usually dead after costs (see Section 12).
- **Order types:** SEBI/exchange support bracket-style via broker (Zerodha GTT for
  positional, regular SL/SL-M for intraday). SL-M (market stop) is blocked on stock
  options but fine on equities.

---

## 1. Opening Range Breakout (ORB)

### Concept
The first 15 minutes of NSE trading (09:15–09:30) digests overnight news, SGX/GIFT
Nifty gap, and global cues. The high/low of that range acts as intraday
support/resistance; a decisive break tends to continue, because institutional VWAP
execution algos and momentum traders pile onto the move.

### Default parameters and rules
- **Opening range (OR):** high/low of 09:15–09:30 (three 5-min candles or one
  15-min candle).
- **Entry (long):** 5-min candle **closes above OR-high** after 09:30. Enter next
  candle open (or stop-limit at OR-high + 0.05%). Symmetric for shorts below OR-low
  (MIS only).
- **Confirmation filter (recommended):** breakout candle volume ≥ **1.5×** the
  20-period average 5-min volume, and price on the side of VWAP (long only above
  VWAP).
- **Range filter:** skip if OR width < 0.3% (no energy) or > 1.5% (news/event risk,
  stop too far) of the stock price.
- **One trade per symbol per day.** No fresh entries after **13:00**.
- **Initial stop:** opposite side of the OR, capped at **0.75%** from entry
  (if OR is wider, size down or skip).
- **Target / exit:** first target **1R** (book 50%), trail rest with 20-EMA on 5-min
  or a 0.5% trailing stop. Hard time exit **15:10–15:15**.

### Indicators
15-min opening range levels, VWAP, 20-period volume SMA, 20-EMA (for trailing).

### Timeframe / instruments
5-min bars; **NIFTY 50 constituents** (RELIANCE, HDFCBANK, ICICIBANK, SBIN, TATAMOTORS,
etc.) — need tight spreads because the entry chases a breakout. Also works on NIFTY /
BANKNIFTY futures.

### Risk management defaults
- Risk **0.5–1.0% of account equity per trade** (position size = risk ÷ stop distance).
- Max 3–4 concurrent ORB positions; max daily loss 2% of equity → stop trading.
- MIS product type; leverage ≤ 3x even though 5x is available.

### India-specific considerations
- 09:15–09:20 on NSE is noisy — spreads are wide and the pre-open equilibrium price
  often gets violently retested. Defining the OR as 09:15–09:30 (not 09:15–09:20)
  filters much of this.
- Big overnight gaps (>1%) driven by GIFT Nifty/US markets make the OR unreliable —
  combine with the gap rules in Section 8 (skip or trade the gap strategy instead).
- Shorts require MIS; square off by 15:15 to avoid the ₹50+GST broker square-off.
- STT (0.025% on sell) + brokerage on both legs: an ORB round trip costs roughly
  0.08–0.12% including slippage. 1R target with 0.75% stop clears this; scalping
  variants (0.3% targets) do not.
- Event days (RBI policy ~10:00, quarterly results intraday, budget day) invalidate
  the OR — maintain an event calendar and skip.

### Known failure modes
- **Choppy/range days** (~60% of days): both sides break and reverse ("whipsaw both
  directions"), producing two full losses on the same symbol if you allow re-entry.
- False break at exactly OR-high (stop-hunt), then real move — mitigated by the
  candle-close rule rather than tick-touch entries.
- Expiry-day (Tuesday NIFTY / monthly stock expiry) pin-to-strike behaviour kills
  index ORB follow-through.

---

## 2. Moving Average Crossover

### 2a. Intraday: EMA 9/21

**Concept.** Fast/slow EMA cross captures intraday trend legs after the open settles.

**Rules (defaults):**
- 5-min bars. **Long:** EMA(9) crosses above EMA(21) **and** price > VWAP.
  **Short (MIS):** EMA(9) below EMA(21) and price < VWAP.
- Trade window **09:45–14:45** only (skip open noise; no new trades near close).
- **Stop:** 0.5% or below the swing low preceding the cross, whichever is nearer.
- **Exit:** opposite cross, or VWAP recross against you, or 15:15 time stop.
- **Chop filter (essential):** only take the signal if ADX(14) on 5-min > 20, or if
  the day's range so far > 0.6× 14-day ATR. Raw 9/21 crosses lose money on Indian
  large caps after costs without a trend filter.

**Instruments:** NIFTY 50 / high-beta liquid names (TATASTEEL, ADANIENT, BAJFINANCE),
NIFTY/BANKNIFTY futures. **Risk:** 0.5% equity per trade, max 3 positions.

### 2b. Positional: SMA 50/200 (Golden/Death cross)

**Rules (defaults):**
- Daily bars. **Buy (CNC)** when SMA(50) crosses above SMA(200); **exit** on the
  reverse cross or a 15% trailing stop from the post-entry high, whichever first.
- No shorting the death cross in cash (CNC can't short) — either go flat, or express
  shorts via index futures/puts if hedging a portfolio.
- Optional regime filter: only take stock-level golden crosses when NIFTY 50 itself
  is above its own 200-SMA.

**Instruments:** NIFTY 100 constituents; or apply to NIFTYBEES/JUNIORBEES ETFs as a
simple regime switch. **Risk:** equal-weight 5–10% of equity per position, portfolio
max 100% invested, per-stock stop 15%.

### India-specific considerations
- Positional CNC: **zero brokerage** on Zerodha, but STT 0.1% each side + 0.015%
  stamp on buy + DP charge ₹13.5+GST per scrip on sell day ⇒ ~0.25% + ₹16 round
  trip. Fine for holding periods of weeks/months; ruinous if the cross whipsaws
  weekly.
- Death-cross "exit to cash" works well in India because index drawdowns (2008,
  2020, 2022) are deep; but you forfeit dividends and re-entry is late.
- T+1: exiting a positional signal releases funds next day — matters for rotation
  into the next signal.

### Known failure modes
- Sideways markets 2013-type / 2015-type grinds: 50/200 whipsaws 3–4 times a year,
  each costing ~5–8%.
- Intraday 9/21 without ADX/VWAP filter is a net loser on most NIFTY 50 names —
  Indian large caps mean-revert intraday more than they trend.
- Lag: by the time SMA(200) cross confirms, 10–20% of the move is gone. Accept it;
  don't "anticipate" the cross.

---

## 3. RSI Mean Reversion

### 3a. RSI-2 (Connors-style), positional swing, long-only

**Concept.** Deep short-term oversold in a long-term uptrend snaps back within days.
Long-only in India (no CNC shorting) — which is fine, because the short side of RSI-2
is weak anyway.

**Rules (defaults):**
- Daily bars. **Setup:** Close > SMA(200) (long-term uptrend) **and** RSI(2) < 10
  (aggressive: < 5).
- **Entry:** next-day open, CNC. Optional scale-in: half at RSI-2 < 10, half at < 5.
- **Exit:** close > SMA(5), or RSI(2) > 70, or **time stop 7 trading days** —
  whichever first. Exit at next open after the signal.
- **No hard stop-loss on individual entries** in the classic version; instead cap
  position size and use a disaster stop at **-8%** from entry (gap/news protection).

**Instruments:** NIFTY 100 stocks (need mean-reverting, non-manipulable names);
also works on NIFTYBEES. **Risk:** max 10% of equity per name, max 5 concurrent,
skip stocks with results announcements inside the next 3 sessions.

### 3b. RSI-14 swing variant

- Daily bars. **Long:** RSI(14) crosses back **up through 30** while close >
  SMA(200); **exit** at RSI(14) > 60 or 10-day time stop or -5% stop.
- Slower, fewer signals, better suited to midcaps where RSI-2 triggers too rarely.
- Intraday variant: RSI(14) on 15-min, buy < 25 / exit > 55, only above daily
  SMA(50), MIS — works on BANKNIFTY constituents but edge is thin after costs.

### Indicators
RSI(2) / RSI(14), SMA(200), SMA(5).

### India-specific considerations
- CNC delivery: buy today, and if the bounce comes tomorrow you're selling T+1 stock
  (BTST) — allowed on Zerodha but shows as BTST; fine for liquid names.
- Costs: CNC round trip ≈ 0.25%; average RSI-2 winner on NIFTY 100 names is
  ~1.5–2.5%, so costs are tolerable, unlike intraday variants.
- **Do not run on smallcaps / circuit-prone names:** an oversold smallcap can go
  lower-circuit for days — no exit at any price (see Section 11).
- India's frequent policy/news gap-downs (tax changes, SEBI orders, group-level
  contagion like Adani Jan-2023) mean the "no stop" purist version needs the -8%
  disaster stop and a group-exposure cap.

### Known failure modes
- **Falling knives:** RSI-2 < 5 during a genuine de-rating (fraud, results miss)
  keeps getting more oversold. The SMA(200) filter helps but doesn't save you on
  gap events.
- Strategy is short-vol in character: many small wins, occasional -8% hits.
  Position-count discipline is the whole risk model.
- Bear markets: the SMA(200) filter turns the system off for months — that's a
  feature, but the equity curve flatlines.

---

## 4. Supertrend Following

### Concept
Supertrend(ATR-period, multiplier) is a trailing ATR band that flips
bullish/bearish when price closes through it. It is arguably the single most
popular retail indicator in India — which means its default levels on liquid
names attract self-fulfilling flow, and also stop-hunts.

### Default parameters and rules
- **Supertrend(10, 3)** — the canonical Indian default.
- **Intraday:** 15-min bars on NIFTY/BANKNIFTY futures or liquid F&O stocks.
  **Long** when candle closes above the Supertrend line (line flips green);
  **exit/flip short (MIS/futures)** when it closes below (flips red).
  Trade window 09:30–15:10; square off open MIS by 15:15.
- **Positional:** daily bars, Supertrend(10, 3) long-only on NIFTY 100 names or
  index ETF; exit on flip. Some Indian desks use (7, 2.5) for faster daily signals.
- **Filter (strongly recommended):** take longs only when price > 200-EMA
  (daily) and/or ADX(14) > 20. Raw always-in-market Supertrend churns in ranges.
- **Stop:** the Supertrend line itself is the stop (that's the design). Add a hard
  cap: if line is > 1.5× ATR(14) away, size down.
- **Optional profit-taking:** book 50% at 2× ATR in favour, trail rest on the line.

### Indicators
Supertrend(10,3), ATR(10/14), 200-EMA, ADX(14).

### Timeframe / instruments
15-min for intraday (NIFTY fut, BANKNIFTY fut, top-20 F&O stocks); daily for
positional (NIFTY 100, ETFs).

### Risk management defaults
- Position size = 1% equity risk ÷ (entry − Supertrend line).
- Intraday: max 2 index positions or 4 stock positions.
- Positional: long-only in cash (flips to "red" mean exit, not short).

### India-specific considerations
- Because (10,3) on 15-min NIFTY is watched by an enormous retail crowd, entries
  right at the flip get slippage from crowding; entering on the *close* of the flip
  candle (not intrabar) avoids the worst of it.
- Positional short flips can only be expressed via futures (margin ~10–12% of
  contract) or puts — factor F&O costs (Section 12) and Tuesday/monthly expiry roll.
- Intraday flips average 2–4 per day per instrument in a range — with ₹20+STT per
  round trip, a ₹1-lakh position churning 3 flips loses ~0.25–0.35% to costs alone
  on a flat day.

### Known failure modes
- **Range-bound whipsaw** is the dominant failure: 2024-style sideways months
  produce 8–12 consecutive small losses. The ADX/200-EMA filter and per-day flip
  limits (max 2 re-entries) are mandatory.
- Late entries after extended trends: the flip confirms after a large ATR move;
  entering then often buys the top of the leg.
- Overnight gaps through the daily Supertrend line: actual exit is far worse than
  the theoretical line price. Backtests that fill at the line overstate results —
  fill at next open in simulation.

---

## 5. VWAP Reversion / VWAP Trend

### Concept
VWAP (volume-weighted average price, session-anchored at 09:15) is the benchmark
institutional execution price on NSE. Two exploitable behaviours:
(a) **Trend days:** price holds one side of VWAP all day; pullbacks *to* VWAP get
bought/sold by execution algos. (b) **Range days:** extensions far from VWAP revert
to it.

### 5a. VWAP trend (pullback continuation) — defaults
- 5-min bars. **Regime check at 10:00:** price has stayed above VWAP ≥ 80% of bars
  since open and VWAP slope is up ⇒ long-bias trend day.
- **Entry:** first/second pullback that touches VWAP (or VWAP ± 0.05%) and prints a
  rejection candle (close back above VWAP). Long at that candle close.
- **Stop:** 0.4% below VWAP or below pullback low. **Target:** day high, then trail
  20-EMA. Max 2 attempts per day; time exit 15:15.

### 5b. VWAP reversion (fade the extension) — defaults
- Compute rolling standard-deviation bands around VWAP (session-to-date σ of
  price−VWAP). **Fade at ±2σ** (short at +2σ / long at −2σ, shorts MIS) *only* when
  ADX(14, 5-min) < 20 (range day) and no pending news.
- **Target:** VWAP itself. **Stop:** 2.8–3.0σ. Trade window 10:15–14:30.
- Best on **index futures and top-5 mega caps** (RELIANCE, HDFCBANK, ICICIBANK,
  INFY, TCS) whose flow is dominated by institutional VWAP execution.

### Indicators
Session VWAP, VWAP σ-bands, ADX(14), 20-EMA, cumulative volume.

### Risk management defaults
0.5% equity risk per trade; reversion book must be flat by 15:10; never average a
losing fade more than once.

### India-specific considerations
- NSE VWAP anchors at 09:15 cash open. The 09:00–09:08 pre-open auction volume
  prints as the first tick — include it or your VWAP diverges from Kite's.
- Reversion targets are small (0.3–0.6%), so the ~0.08–0.12% intraday cost+slippage
  eats 20–30% of the gross edge — trade only the top-liquidity names and use limit
  orders at the band.
- Expiry days: index price pins and the σ-bands compress — reversion works better,
  trend variant worse.

### Known failure modes
- Fading a ±2σ extension on what is actually a **news-driven trend day** (results
  leak, block deal): the single worst loss category. The ADX filter and an
  event-calendar veto are essential.
- Trend variant late in the day: post-14:30 pullbacks to VWAP often *break* it as
  intraday players unwind MIS.
- Low-volume midcaps: VWAP is dominated by a few block prints and mean-reverts to
  nothing — restrict universe hard.

---

## 6. Bollinger Band Squeeze / Breakout

### Concept
Volatility cycles: contraction (squeeze) precedes expansion. When Bollinger Bands
(20, 2) narrow to a multi-week low, the eventual directional break tends to travel.

### Default parameters and rules
- **Bands:** BB(20, 2.0) on daily (positional) or 15-min (intraday).
- **Squeeze definition:** BandWidth = (Upper − Lower) / Middle at its lowest over
  the past **120 bars** (daily) — or the Keltner variant: BB inside Keltner(20, 1.5)
  ⇒ "squeeze on".
- **Entry (long):** close above the upper band while squeeze was on within the last
  5 bars, **with volume ≥ 1.5× 20-bar average**. Breakdown side: intraday MIS short
  or skip (positional cash can't short).
- **Stop:** middle band (20-SMA) or 1.5× ATR(14), whichever nearer; cap 4% positional
  / 0.7% intraday.
- **Exit:** close back below middle band, or trail 2.5× ATR from highest close.
  Time stop: 20 bars without progress ⇒ scratch.

### Indicators
Bollinger(20,2), BandWidth, Keltner(20,1.5) optional, ATR(14), volume SMA(20).

### Timeframe / instruments
Daily on NIFTY 200 liquid names (squeeze breakouts are where midcaps shine —
use only F&O-listed midcaps for liquidity); 15-min on index futures.

### Risk management defaults
1% equity risk per trade positional; max 6 open breakouts; skip entries within
2 sessions of results.

### India-specific considerations
- Indian midcap squeezes often resolve upward violently and hit **upper circuits**
  — great when you're in, but you cannot *enter* a stock locked at 20% UC; use
  stop-limit entries placed the prior evening (GTT) rather than chasing at open.
- Conversely, failed breakouts in non-F&O names can gap to lower circuit —
  restrict to F&O-listed names where no hard circuit applies and futures provide
  an exit.
- Watch for squeeze setups created by **stock-specific corporate actions**
  (record dates, splits) — the "breakout" is mechanical, not tradeable.

### Known failure modes
- **Head-fake:** first break is opposite to the real move (classic Bollinger
  failure). The volume filter and the middle-band stop limit the damage; some
  desks trade the *second* break after a head-fake, which tests better.
- Squeeze in a dead stock: low BandWidth from illiquidity, not coiling — the
  liquidity filter (Section 11) removes these.
- Broad-market veto: individual squeezes triggering during an index-level selloff
  fail en masse; add "NIFTY above 50-DMA" as a long-side regime gate.

---

## 7. Momentum / Rotation (Positional)

### Concept
Cross-sectional momentum: each month, hold the N strongest stocks in a liquid
universe. This is the best-documented persistent factor in Indian equities —
NSE itself runs NIFTY200 Momentum 30 / NIFTY Midcap150 Momentum 50 indices, and
the factor's live index history in India beats cap-weighted NIFTY over full cycles
(with deeper drawdowns).

### Default parameters and rules
- **Universe:** NIFTY 200 constituents passing liquidity filters (Section 11).
- **Ranking score:** 12-month return **skipping the most recent month** (12-1), or
  the NSE-style blend: average of 6-month and 12-month **volatility-adjusted**
  returns (return ÷ daily-return σ of the same lookback).
- **Portfolio:** **top 20** by score (top 15–30 all work), equal-weight or
  inverse-volatility weight, per-name cap 8%.
- **Rebalance:** monthly, first trading day, at/near close. **Buffer rule** to cut
  churn: a holding exits only if it falls below rank 40 (hold zone 20–40).
- **Regime filter (drawdown control):** if NIFTY 50 closes the month below its
  200-DMA (or 10-month SMA), move 50–100% to liquid funds/cash instead of
  rebalancing in.
- **Stops:** none per-name in the classic version (rebalance is the exit); optional
  25% per-name disaster stop.
- **Exclusions:** stocks in ASM/GSM surveillance stages, F&O ban not relevant
  (cash), stocks with < 6 months listing history, upcoming known events optional.

### Indicators
12-1 momentum, 6m/12m Sharpe-style scores, 200-DMA regime filter, ATR/σ for weights.

### Timeframe / instruments
Daily data, monthly action. CNC delivery. Capital: works from ~₹2–3 lakh up
(below that, 20 names × lot-of-one rounding hurts).

### Risk management defaults
Fully invested when regime is on; ~15–20 names; per-name ≤ 8%; sector cap 30%;
expected max drawdown 25–35% (2008-analog worse) — size the allocation accordingly.

### India-specific considerations
- **Costs favour this strategy on Zerodha:** delivery brokerage is ₹0; monthly
  two-way churn of ~20–30% of the book costs ~0.06–0.08% of portfolio/month in
  STT+charges — negligible vs the factor premium.
- T+1: sell the exits, buy the entries next day, or use the sale proceeds same-day
  (Zerodha allows buying against sale credit).
- **Taxation shapes holding behaviour:** < 12-month holding = STCG 20%; momentum
  turnover means mostly STCG — this is the biggest real-world drag, bigger than
  transaction costs.
- Momentum in India is strongly midcap-flavoured; enforce median-traded-value
  filters or the top ranks fill with movers you can't exit at size.
- Circuit risk: a momentum name hit by fraud news can go LC repeatedly (no exit) —
  per-name cap and preferring F&O-listed names mitigates.

### Known failure modes
- **Momentum crashes:** sharp bear-market reversals (Apr 2009-style, Apr 2020
  rebound) where the long book is full of low-beta defensives / prior winners that
  lag violently. The 200-DMA regime filter halves but does not eliminate this.
- Whipsaw around the regime filter in sideways years (in-out-in costs).
- Crowding: multiple Indian smallcase/PMS products run near-identical NIFTY200
  momentum; month-start rebalance slippage in overlapping names is real — execute
  spread over the day or a day early/late.

---

## 8. Gap Trading

### Concept
NSE opens 09:15 after overnight global moves (US close, GIFT Nifty). Gaps carry
information: **small gaps tend to fill** (mean reversion), **large gaps with
follow-through tend to run** (gap-and-go). The index and single stocks behave
differently — index gaps fade more, stock gaps on real news run more.

### Definitions
Gap % = (today's 09:15 open − yesterday's close) / yesterday's close.
Classify at open: small 0.2–0.5%, medium 0.5–1.0%, large > 1.0% (index);
for single stocks scale by ATR: small < 0.5× ATR(14), large > 1× ATR.

### 8a. Gap-fade (index) — defaults
- Instrument: NIFTY futures (or NIFTYBEES MIS). **Setup:** small/medium gap
  (0.2–0.75%) **with no scheduled event** (RBI, budget, expiry, major global print).
- **Entry:** 09:20–09:30, fade toward the fill — e.g. gap-up ⇒ short (futures/MIS)
  when the first 5-min candle closes below its open, target = yesterday's close.
- **Stop:** beyond the day's opening extreme + 0.15%, or 0.5× gap size beyond entry.
- **Exit:** gap fill (yesterday's close), or 12:00 time stop (unfilled by noon ⇒
  likely trend day, get out), or stop.

### 8b. Gap-and-go (stocks) — defaults
- **Setup:** stock gaps > 2% (or > 1× ATR) on identifiable news (results beat,
  order win) with pre-open auction volume elevated; stock is F&O-listed and liquid.
- **Entry:** break of the first 15-min high (this is ORB layered on a gap) with
  volume; long-bias only for cash, shorts via MIS on gap-downs.
- **Stop:** low of first 15 min, capped 1%. **Target:** 2R or trail 20-EMA(5-min);
  square off 15:15 (or convert a strong winner to CNC before close if thesis is
  multi-day).
- **Skip:** gap > 6–8% (most of the move done; halt/circuit risk), and gaps caused
  by dividend ex-dates or corporate actions (not real gaps).

### Indicators
Prior close, pre-open auction price/volume, first 15-min range, VWAP, ATR(14).

### Risk management defaults
0.5% equity risk per trade; one index gap trade per day; max 3 stock gap trades;
daily loss cap 1.5%.

### India-specific considerations
- **Pre-open auction (09:00–09:08)** sets the official open; the 09:15 print can
  jump from the auction indicative price in the last seconds — never send market
  orders into 09:15:00–09:15:30 (see Section 14).
- GIFT Nifty (ex-SGX) gives the gap direction by ~09:00 — usable for pre-computing
  which playbook applies.
- Gap-downs > 4–5% on non-F&O stocks risk opening straight into lower circuit —
  untradeable; only trade gaps on F&O-listed names.
- Index expiry days (weekly NIFTY expiry) distort gap-fill statistics — treat as
  event days.

### Known failure modes
- Fading a gap that was the *start* of a multi-day repricing (global risk-off) —
  the 12:00 time stop and event veto are the protection.
- Gap-and-go on illiquid movers: the 15-min-high break fills 0.3–0.5% worse than
  backtest.
- Statistics drift: index gap-fill frequency is regime-dependent (fills ~60–70% of
  small gaps in ranging regimes, far less in trending ones); recalibrate quarterly.

---

## 9. Pairs / Statistical Arbitrage

### Concept
Two fundamentally-linked stocks (same sector, similar business) have a spread that
mean-reverts. Trade the spread: short the rich leg, long the cheap leg,
market-neutral. Canonical Indian pairs: **HDFCBANK–ICICIBANK**, KOTAKBANK–AXISBANK,
SBIN–BANKBARODA (PSU banks), TCS–INFY, HINDUNILVR–NESTLEIND (weaker), MARUTI–M&M.

### Default parameters and rules
- **Pair qualification (rolling, recompute monthly):** daily closes, 252-day
  window; correlation of returns > 0.7 **and** Engle–Granger cointegration test
  (ADF on residuals of log-price regression) p < 0.05. Hedge ratio β from the same
  regression (or Kalman-filter β for the ambitious).
- **Spread:** S = log(P₁) − β·log(P₂). **Z-score** over a **60-day** rolling
  mean/σ of S.
- **Entry:** |z| > **2.0** ⇒ short the expensive leg, long the cheap leg, rupee-
  neutral (β-weighted notionals).
- **Exit:** z crosses **0** (target), or **|z| > 3.0 stop** (relationship break),
  or **time stop 20 trading days**, or cointegration test fails at monthly refresh.
- **Half-life check:** only trade pairs whose spread half-life (from OU/AR(1) fit)
  is 5–25 days; slower ties up capital, faster is noise.

### Execution vehicles in India (critical)
- **The short leg cannot be CNC.** Options, in order of practicality:
  1. **Stock futures both legs** (cleanest; both names above are F&O). Lot sizes
     force notional granularity (~₹5–10 lakh per leg minimum) and monthly rollover
     costs (~0.05–0.15% per roll incl. spread).
  2. Long leg cash + short leg futures (adds dividend/roll asymmetry).
  3. Intraday-only MIS both legs (limits you to same-day convergence — a different,
     much weaker strategy).
  SLB (securities lending) exists on NSE but retail access/liquidity is poor.

### Indicators
Rolling correlation, ADF/cointegration p-value, hedge ratio β, spread z-score,
half-life.

### Timeframe / instruments
Daily bars for signals; F&O-listed liquid pairs only. Holding 1–4 weeks.

### Risk management defaults
- Per-pair gross exposure ≤ 20% of capital (both legs), 3–5 pairs max.
- Hard stop at |z| = 3 **and** a rupee stop of 2% of combined notional.
- Kill the pair on structural news: merger (the HDFC Ltd–HDFCBANK merger of 2023
  permanently rebased that spread), RBI action on one bank, index
  inclusion/exclusion.

### India-specific considerations
- **F&O ban list:** if a stock's market-wide position limit is > 95% utilised, it
  enters the ban and you cannot open new futures positions — check the daily NSE
  ban list before entry; never hold half a pair because the other leg is banned.
- Futures margin ~18–25% per leg with no cross-margin benefit for arbitrary pairs
  at the broker level ⇒ capital efficiency is poor; return on *margin* is what to
  measure.
- Rollover every month (last Thursday for stock F&O): budget 2 extra round trips
  per leg per month held; expiry-week basis noise pollutes the spread — widen the
  entry threshold in expiry week or use next-month contracts.
- STT on futures (0.02% sell side) + ₹20/order × 4 orders per round trip is small
  relative to typical 1.5–3% spread convergence, so costs are fine; **slippage on
  the second leg** (legging risk) is the real execution cost — use simultaneous
  orders or a spread-execution routine.

### Known failure modes
- **Cointegration breakdown** — the dominant killer. A regulatory hit, management
  event, or re-rating makes the spread trend; z goes 2 → 3 → 4. The |z|=3 stop and
  monthly re-test are non-negotiable.
- Sector-wide shocks are *not* hedged if β is stale — refresh β monthly.
- Overfitting: scanning 200×200 stocks for "cointegrated" pairs finds hundreds of
  spurious ones; restrict to fundamentally-paired names first, statistics second.

---

## 10. MACD Trend-Confirmation Combos

### Concept
MACD(12, 26, 9) is a trend/momentum oscillator best used **not** as a standalone
signal (raw MACD crosses whipsaw badly on Indian dailies) but as a *confirmation
layer* on top of a primary setup.

### Combo A — Positional: 200-EMA + MACD cross (daily)
- **Long entry:** close > EMA(200) **and** MACD line crosses above signal line
  **below the zero line** (buying the dip in an uptrend, not the extension).
- **Exit:** MACD crosses down above zero, or -6% stop, or close < EMA(200).
- Universe: NIFTY 100. Risk 1% per trade, ≤ 8 positions.

### Combo B — Intraday: Supertrend + MACD agreement (15-min)
- **Long:** Supertrend(10,3) green **and** MACD histogram ticks up from negative
  to positive (or MACD > signal). Exit on Supertrend flip or MACD cross-down.
  Cuts Supertrend's range-whipsaw roughly in half at the cost of later entries.

### Combo C — Divergence at extremes (swing)
- Daily. Price makes a lower low but MACD histogram makes a higher low
  (bullish divergence) **while** RSI(14) < 35 and price within 2% of a defined
  support. Entry on first close above prior day's high; stop below divergence low;
  target 2R. Discretion-heavy — hardest of the three to automate honestly
  (divergence definitions leak hindsight); codify strictly (two swing pivots,
  minimum 5 bars apart) or skip.

### Indicators
MACD(12,26,9) + histogram, EMA(200), Supertrend(10,3), RSI(14).

### Risk management defaults
Same as host strategy (MACD is the filter, not the sizer): 0.5–1% risk per trade;
positional stops 5–6%, intraday 0.5–0.75%.

### India-specific considerations
- MACD parameters were tuned on US dailies; on Indian midcaps consider (5, 35, 5)
  variants only after walk-forward testing — default (12,26,9) is the sane start.
- The positional combo is CNC long-only; MACD sell-crosses are exits, not shorts.
- Expect long flat periods when NIFTY chops around its 200-EMA (e.g., much of
  2015, H2-2024-style congestion): combo A simply stops trading.

### Known failure modes
- Standalone MACD crosses on daily NIFTY stocks ≈ break-even before costs, negative
  after — always pair with a regime filter (this is the whole point of the combos).
- Signal lag stacking: two lagging filters (200-EMA + MACD + Supertrend) can leave
  only the last 40% of a trend; don't stack more than two.
- Divergence pattern-mining in backtests is a notorious hindsight trap — freeze the
  pivot definition before testing.

---

## 11. Universe Selection for India

A strategy's realized performance in India is determined as much by the universe as
by the signal. Recommended screens, refreshed **monthly**:

### Liquidity filters (defaults)
| Filter | Intraday strategies | Positional strategies |
|---|---|---|
| Median daily traded value (60d) | ≥ ₹100 crore | ≥ ₹25 crore |
| Price | ≥ ₹50 (avoid tick-size % distortion) | ≥ ₹30 |
| Median bid-ask spread | ≤ 5 bps (top-of-book) | ≤ 15 bps |
| Your order vs liquidity | order ≤ 1% of avg 1-min volume | order ≤ 5% of avg daily volume |
| Listing history | ≥ 6 months | ≥ 12 months |

Practical universes: **NIFTY 50** for index-grade intraday; **F&O-listed stocks
(~180–190 names)** for anything requiring shorts or needing circuit-free price
discovery; **NIFTY 200 ∩ liquidity screen** for positional/momentum.

### Exclusion lists (check daily/weekly)
- **F&O ban list (daily, NSE website/API):** stocks at > 95% of market-wide
  position limit — no *new* derivative positions allowed. Affects pairs/short legs.
  Ban-period stocks also tend to be in speculative blow-off phases — bad for
  mean-reversion longs too.
- **ASM / GSM surveillance lists (NSE/BSE):** Additional/Graded Surveillance
  Measure stocks carry 100% margin, 5% price bands, possible trade-for-trade
  (T2T) settlement — **no intraday allowed in T2T**. Exclude all stages.
- **Circuit-prone names:** exclude any stock that hit its upper/lower circuit on
  > 3 of the last 60 sessions. Non-F&O stocks have hard bands (2%, 5%, 10%, or
  20%); F&O stocks have a 10% operating range that *flexes* intraday, so they
  effectively always have an exit price.
- **Event vetoes (per-trade):** results date within N days (N=2 intraday setups,
  N=3 mean reversion), ex-dividend/split/bonus dates (fake gaps), open offers,
  index reconstitution effective dates (Mar/Sep for NIFTY).
- **Group-risk cap:** cap exposure per promoter group (Adani 2023 showed
  single-group contagion across 8+ liquid names).

---

## 12. Realistic Cost Model (Zerodha)

Rates as of mid-2026 (post the Oct-2024 STT/exchange-fee revisions). Verify
against https://zerodha.com/charges before go-live; SEBI/exchanges revise
periodically.

### Per-order charges — equity

| Component | Delivery (CNC) | Intraday (MIS) |
|---|---|---|
| Brokerage | **₹0** | **min(₹20, 0.03% of turnover)** per executed order |
| STT | **0.1%** on buy AND sell | **0.025%** on **sell side only** |
| Exchange txn charge (NSE) | 0.00297% of turnover | 0.00297% of turnover |
| SEBI charges | 0.0001% (₹10/crore) | 0.0001% |
| Stamp duty | **0.015%** on **buy** only | **0.003%** on **buy** only |
| GST | 18% × (brokerage + txn charge + SEBI) | same |
| DP charge | **₹13.5 + GST (≈₹15.93)** per scrip per sell day | n/a |

### Per-order charges — F&O (for index/pairs execution)

| Component | Futures | Options |
|---|---|---|
| Brokerage | min(₹20, 0.03%) per order | flat ₹20 per order |
| STT | 0.02% on sell (on price) | 0.1% on sell (on premium) |
| Exchange txn (NSE) | 0.00173% | 0.03503% of premium |
| Stamp duty | 0.002% buy | 0.003% buy |
| SEBI | 0.0001% | 0.0001% |
| GST | 18% × (brokerage + txn + SEBI) | same |

### Formulae (equity intraday round trip, turnover T each side)

```
brokerage      = min(20, 0.0003 × T_buy) + min(20, 0.0003 × T_sell)
stt            = 0.00025 × T_sell
exch           = 0.0000297 × (T_buy + T_sell)
sebi           = 0.000001 × (T_buy + T_sell)
stamp          = 0.00003  × T_buy
gst            = 0.18 × (brokerage + exch + sebi)
total_intraday = brokerage + stt + exch + sebi + stamp + gst
```

Worked example, ₹1,00,000 per side intraday:
brokerage ₹40 + STT ₹25 + exch ₹5.94 + SEBI ₹0.20 + stamp ₹3 + GST ₹8.30
≈ **₹82.4 ≈ 0.082% of one-side notional** — *before slippage*. Add slippage
(Section 13) and a realistic all-in intraday round trip is **0.10–0.15%**.
⇒ an intraday strategy needs **≥ 0.25–0.30% average gross edge per trade** to be
worth running; per-trade gross below ~0.15% is structurally unprofitable on cash
equities in India (this is what kills naive scalping/HFT-lite).

### Formulae (equity delivery round trip)

```
stt   = 0.001 × (T_buy + T_sell)
exch  = 0.0000297 × (T_buy + T_sell)
sebi  = 0.000001 × (T_buy + T_sell)
stamp = 0.00015 × T_buy
gst   = 0.18 × (exch + sebi)            # brokerage is 0
dp    = 15.93                            # per scrip per sell day
total_delivery ≈ 0.236% of one-side notional + ₹16
```

Other fixed costs: **auto square-off ₹50+GST** per MIS position not closed by
15:20; call-&-trade ₹50; AMC ~₹300/yr. Taxes on P&L: intraday = business income
(slab); delivery STCG 20% (<1y), LTCG 12.5% above ₹1.25L exemption (>1y).

---

## 13. Slippage Assumptions

Backtest with **cost + slippage per side**, calibrated by instrument bucket:

| Bucket | Market-order slippage per side (assume) |
|---|---|
| NIFTY/BANKNIFTY futures | 0.01–0.02% (1 tick–1 point) |
| NIFTY 50 mega caps (RELIANCE, HDFCBANK…) | 0.02–0.04% |
| NIFTY 100–200 liquid names | 0.05–0.10% |
| Liquid midcaps (F&O-listed) | 0.10–0.20% |
| First/last 5 minutes, any name | 2–3× the above |
| Stop-loss (SL-M) fills in fast markets | 2× the above vs trigger |
| Breakout entries (crowded signals: ORB, Supertrend flips) | add 0.03–0.05% |

Rules of thumb:
- Use **limit orders** for mean-reversion entries (you're providing liquidity —
  slippage ≈ 0, but model 20–30% missed fills) and **marketable limits**
  (limit = LTP ± 0.1%) instead of raw market orders for breakouts.
- Model stop-losses as filled at trigger + slippage, never at the stop price.
- Gap-through-stop: positional stops on daily bars must fill at **next open**,
  not the stop level, in simulation.
- If backtest profitability disappears when you double the slippage assumption,
  the strategy has no margin of safety — discard.

---

## 14. Market Timing and Session Structure

| Window (IST) | Behaviour | Rule |
|---|---|---|
| 09:00–09:08 | Pre-open call auction (order collection to 09:07:59 ±random, match 09:08–09:12) | No continuous trading; read the indicative price for gap classification |
| 09:15:00–09:20 | Open: widest spreads, auction unwind, stop cascades | **No market orders.** No entries except pre-planned gap logic with limits |
| 09:15–09:30 | Opening range formation | ORB range-building; most systems observe only |
| 09:30–11:30 | Highest-quality trends and volume | Primary intraday entry window |
| 11:30–13:00 | Lunch lull, lowest volume, chop | Reduce/skip momentum entries; reversion OK |
| 13:00–14:30 | European open influence, second trend leg | Entries allowed; last fresh positional-style intraday entries by ~14:00 |
| 14:30–15:00 | MIS unwind flows begin | No new intraday entries after 14:45 |
| 15:00–15:15 | Accelerating square-off flow | Exit-only. Self square-off all MIS by **15:15** |
| 15:20 | **Zerodha MIS auto square-off** (₹50+GST/position) | Must already be flat |
| 15:30 | Cash close | — |
| 15:40–16:00 | Closing-price session (post-close, at closing price) | Ignorable for these strategies |

Other calendar structure: weekly **NIFTY option expiry** (Tuesday, post-2025
rationalisation — verify current day before coding) and **monthly stock F&O expiry
(last Thursday)** distort index intraday behaviour; **Muhurat trading** (Diwali,
~1 hr evening session) — exclude from backtests; ~15 exchange holidays/yr.

---

## 15. India-Specific Structural Rules (cheat sheet)

1. **MIS auto square-off 15:20 (Zerodha), ₹50+GST penalty** → all intraday systems
   hard-exit 15:15.
2. **No CNC shorting** → positional systems are long-only in cash; shorts = MIS
   (intraday) or F&O (futures/puts). Failed short delivery ⇒ auction penalty.
3. **T+1 settlement** → sale proceeds usable same day on Zerodha for new buys;
   delivery lands next day; BTST allowed but carries short-delivery tail risk.
4. **STT asymmetry** → delivery 0.1% both sides; intraday 0.025% sell-only. This,
   plus ₹20/order, is why sub-0.15%-edge strategies die in India.
5. **Circuit limits** → 2/5/10/20% hard bands on non-F&O stocks (no exit when
   locked); F&O stocks have flexing 10% bands (always an exit); index breakers at
   ±10/15/20% halt everything.
6. **F&O ban list** (MWPL > 95%) → no new derivative positions in that name;
   check daily before pairs/short entries.
7. **ASM/GSM/T2T surveillance** → extra margins, 5% bands, no intraday in T2T;
   exclude from universe.
8. **Peak margin / 5x max intraday leverage** → position sizing must assume ≤ 5x,
   realistically ≤ 3x.
9. **Pre-open auction 09:00–09:08** → sets the open; never market-order into
   09:15:00–09:15:30.
10. **Taxes:** intraday P&L = business income at slab; STCG 20%; LTCG 12.5%
    (> ₹1.25L). Tax drag often exceeds transaction-cost drag for positional
    systems — model it.

---

## Suggested priority for implementation/backtesting

Given cost realities and robustness, a sensible build order:

1. **Momentum rotation (Sec 7)** — best cost profile (₹0 delivery brokerage),
   strongest academic + live-index evidence in India, monthly cadence = easy ops.
2. **RSI-2 mean reversion (Sec 3)** — simple, complements momentum, CNC long-only.
3. **ORB (Sec 1)** — best-understood intraday edge; demands good execution infra.
4. **VWAP trend (Sec 5a)** and **Supertrend-with-filter (Sec 4)** — intraday trend
   capture; validate the chop filters hard.
5. **Pairs (Sec 9)** — only after F&O execution + margin management is solid.

Everything above must be walk-forward tested on NSE data with the Section 12 cost
model and Section 13 slippage before a single rupee of live capital.
