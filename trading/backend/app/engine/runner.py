"""Per-strategy-instance runner.

The runner owns the loop for one strategy instance:
  candle scheduler -> strategy.on_candle -> intents -> filter/sizing/risk pipeline -> broker
plus a fast risk loop (stop-loss / take-profit / trailing / square-off / kill-switch)
that runs every few seconds independent of the candle timeframe.

Strategies never see the broker; they emit intents through the context. Every
customization layer of the config (filters, sizing, risk, execution) is applied here.
"""
import asyncio
import logging
import time as time_mod
from datetime import datetime, time as dtime
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select

from ..brokers.base import Broker, OrderRequest, zerodha_charges
from ..brokers.paper import PaperBroker
from ..config import settings
from ..data.feed import INTERVAL_MINUTES, SimFeed
from ..db import SessionLocal
from ..models import EventLog, Order, PnlSnapshot, Position, StrategyInstance, Trade
from ..schemas import StrategyConfigSchema
from ..strategies import REGISTRY, StrategyContext
from .rules import RuleError, compile_rule
from .runtime import runtime

log = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")

RISK_POLL_SECONDS = 10
SNAPSHOT_SECONDS = 60


def _parse_hhmm(s: str) -> dtime:
    h, m = s.split(":")
    return dtime(int(h), int(m))


class RunnerContext(StrategyContext):
    def __init__(self, runner: "StrategyRunner"):
        self._r = runner
        self.state: dict = {}

    @property
    def params(self) -> dict:
        return self._r.strategy.params

    def position(self, symbol: str) -> int:
        pos = self._r.positions.get(symbol)
        return pos["quantity"] if pos else 0

    def enter_long(self, symbol: str, reason: str = "") -> None:
        self._r.handle_entry(symbol, "BUY", reason)

    def enter_short(self, symbol: str, reason: str = "") -> None:
        self._r.handle_entry(symbol, "SELL", reason)

    def exit(self, symbol: str, reason: str = "") -> None:
        self._r.close_position(symbol, reason)

    def log(self, message: str, level: str = "INFO") -> None:
        self._r.log_event(message, level)


class StrategyRunner:
    def __init__(self, instance: StrategyInstance):
        self.id = instance.id
        self.name = instance.name
        self.mode = instance.mode
        self.cfg = StrategyConfigSchema(**(instance.config or {}))
        cls = REGISTRY.get(instance.strategy_type)
        if cls is None:
            raise ValueError(f"unknown strategy type '{instance.strategy_type}'")
        self.strategy = cls(self.cfg.params)
        self.ctx = RunnerContext(self)
        self.broker: Broker = self._make_broker()
        self.extra_entry_rule = None
        if self.cfg.filters.extra_entry_rule:
            self.extra_entry_rule = compile_rule(self.cfg.filters.extra_entry_rule)

        # in-memory positions: symbol -> dict(quantity, average_price, stop_loss,
        # take_profit, trail_anchor); persisted to the positions table on change
        self.positions: dict[str, dict] = {}
        self._restore_positions()

        self.paused = False
        self.halted_reason = ""
        self._stop = asyncio.Event()
        self._entries_today = 0
        self._entries_day = ""
        self._last_snapshot = 0.0
        self._last_candle_bucket = -1
        self._task: asyncio.Task | None = None
        # simulated feed has data around the clock; only enforce IST session
        # times when trading against real market data
        self.enforce_session = not isinstance(runtime.feed, SimFeed)

    # ------------------------------------------------------------------ setup
    def _make_broker(self) -> Broker:
        if self.mode == "live":
            if not runtime.kite_connected:
                raise RuntimeError("live mode requires an active Kite session (login first)")
            if not settings.live_trading_enabled:
                raise RuntimeError("live trading is disabled (set TRADING_LIVE_TRADING_ENABLED=true)")
            return runtime.kite
        return runtime.make_paper_broker(self.id, self.cfg.execution.slippage_pct)

    def _restore_positions(self) -> None:
        with SessionLocal() as db:
            rows = db.execute(
                select(Position).where(Position.strategy_id == self.id, Position.mode == self.mode,
                                       Position.quantity != 0)
            ).scalars().all()
        for row in rows:
            self.positions[row.symbol] = {
                "quantity": row.quantity, "average_price": row.average_price,
                "stop_loss": row.stop_loss, "take_profit": row.take_profit,
                "trail_anchor": row.trail_anchor,
            }

    # ------------------------------------------------------------------ lifecycle
    def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name=f"strategy-{self.id}")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=15)
            except asyncio.TimeoutError:
                self._task.cancel()
        try:
            await asyncio.to_thread(self.strategy.on_stop, self.ctx)
        except Exception:
            log.exception("on_stop failed for %s", self.name)
        self._persist_paper()

    async def _run(self) -> None:
        self.log_event(f"started ({self.mode} mode, {self.cfg.data.timeframe}, "
                       f"{len(self.cfg.universe.symbols)} symbols)")
        try:
            await asyncio.to_thread(self.strategy.on_start, self.ctx)
        except Exception as e:
            self._set_error(f"on_start failed: {e}")
            return
        step_min = INTERVAL_MINUTES.get(self.cfg.data.timeframe, 5)
        while not self._stop.is_set():
            try:
                now = time_mod.time()
                bucket = int(now // (step_min * 60))
                if bucket != self._last_candle_bucket and not self.paused:
                    self._last_candle_bucket = bucket
                    await asyncio.to_thread(self._candle_cycle)
                await asyncio.to_thread(self._risk_cycle)
            except Exception:
                log.exception("cycle error in %s", self.name)
                self.log_event(f"cycle error: see server logs", "ERROR")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=RISK_POLL_SECONDS)
            except asyncio.TimeoutError:
                pass

    # ------------------------------------------------------------------ candle cycle
    def _candle_cycle(self) -> None:
        if self.enforce_session and not self._within(self.cfg.filters.time.days):
            return
        for symbol in self.cfg.universe.symbols[: self.cfg.universe.max_symbols]:
            try:
                df = runtime.feed.candles(symbol, self.cfg.data.timeframe,
                                          self.cfg.data.lookback_candles, self.cfg.universe.exchange)
                if df.empty:
                    continue
                self._current_df = df
                self.strategy.on_candle(self.ctx, symbol, df)
            except Exception as e:
                log.exception("on_candle failed for %s/%s", self.name, symbol)
                self.log_event(f"on_candle error on {symbol}: {e}", "ERROR")
        self._current_df = None

    def _within(self, allowed_days: list[int]) -> bool:
        now = datetime.now(IST)
        if now.weekday() not in allowed_days:
            return False
        open_t = _parse_hhmm(settings.market_open)
        close_t = _parse_hhmm(settings.market_close)
        return open_t <= now.time() <= close_t

    def _in_entry_window(self) -> bool:
        if not self.enforce_session:
            return True
        now = datetime.now(IST)
        t = self.cfg.filters.time
        return (now.weekday() in t.days
                and _parse_hhmm(t.trade_start) <= now.time() <= _parse_hhmm(t.trade_end))

    # ------------------------------------------------------------------ entries
    def handle_entry(self, symbol: str, side: str, reason: str) -> None:
        f = self.cfg.filters
        if self.paused:
            return
        if side == "SELL" and not self.cfg.execution.allow_short:
            self.log_event(f"short entry on {symbol} blocked: shorts disabled in execution config", "WARN")
            return
        if side == "SELL" and self.cfg.execution.product == "CNC":
            self.log_event(f"short entry on {symbol} blocked: CNC cannot short (use MIS)", "WARN")
            return
        if not self._in_entry_window():
            return
        day = datetime.now(IST).strftime("%Y-%m-%d")
        if self._entries_day != day:
            self._entries_day, self._entries_today = day, 0
        if self._entries_today >= f.max_trades_per_day:
            return
        open_positions = sum(1 for p in self.positions.values() if p["quantity"] != 0)
        if open_positions >= self.cfg.risk.max_positions:
            return
        existing = self.positions.get(symbol, {}).get("quantity", 0)
        if (existing > 0 and side == "BUY") or (existing < 0 and side == "SELL"):
            return  # no pyramiding (open a second instance if you want that)

        ltp = self.broker.quote(symbol, self.cfg.universe.exchange)
        if ltp <= 0:
            self.log_event(f"no quote for {symbol}, entry skipped", "WARN")
            return
        if not (f.min_price <= ltp <= f.max_price):
            return
        df = getattr(self, "_current_df", None)
        if f.min_volume > 0 and df is not None and float(df["volume"].iloc[-1]) < f.min_volume:
            return
        if self.extra_entry_rule is not None and df is not None:
            try:
                if not self.extra_entry_rule.evaluate(df):
                    return
            except RuleError as e:
                self.log_event(f"extra_entry_rule error: {e}", "ERROR")
                return

        qty = self._position_size(ltp)
        if qty <= 0:
            self.log_event(f"sizing produced 0 quantity for {symbol} @ {ltp:.2f}", "WARN")
            return
        if ltp * qty > self.cfg.risk.max_position_value:
            qty = int(self.cfg.risk.max_position_value // ltp)
        if qty <= 0:
            return
        if not self._live_gates_ok(ltp * qty):
            return

        result = self._place(symbol, side, qty, reason=reason, tag=f"s{self.id}")
        if result is None:
            return
        fill = result.average_price or ltp
        signed = qty if side == "BUY" else -qty
        r = self.cfg.risk
        sl = tp = 0.0
        if r.stop_loss_pct > 0:
            sl = fill * (1 - r.stop_loss_pct / 100) if signed > 0 else fill * (1 + r.stop_loss_pct / 100)
        if r.take_profit_pct > 0:
            tp = fill * (1 + r.take_profit_pct / 100) if signed > 0 else fill * (1 - r.take_profit_pct / 100)
        self.positions[symbol] = {
            "quantity": signed, "average_price": fill,
            "stop_loss": round(sl, 2), "take_profit": round(tp, 2), "trail_anchor": fill,
        }
        self._entries_today += 1
        self._persist_position(symbol)
        self._persist_paper()
        self.log_event(f"{'LONG' if signed > 0 else 'SHORT'} {qty} {symbol} @ {fill:.2f} — {reason}", "TRADE")

    def _position_size(self, price: float) -> int:
        s = self.cfg.sizing
        equity = self._equity()
        if s.method == "fixed_quantity":
            qty = int(s.value)
        elif s.method == "fixed_value":
            qty = int(s.value // price)
        elif s.method == "percent_capital":
            qty = int((equity * s.value / 100) // price)
        else:  # risk_based: risk `value`% of equity to the stop-loss distance
            sl_pct = self.cfg.risk.stop_loss_pct
            if sl_pct <= 0:
                qty = int(s.value)  # no stop: degrade to fixed quantity
            else:
                risk_amount = equity * s.value / 100
                per_share_risk = price * sl_pct / 100
                qty = int(risk_amount // per_share_risk)
        return max(0, min(qty, s.max_quantity))

    def _equity(self) -> float:
        m = self.broker.margins()
        return float(m.get("equity") or m.get("cash") or 0.0)

    def _live_gates_ok(self, notional: float) -> bool:
        if self.mode != "live":
            return True
        if not settings.live_trading_enabled:
            self.log_event("live order blocked: live trading disabled", "WARN")
            return False
        if notional > settings.live_max_order_value:
            self.log_event(f"live order blocked: notional {notional:.0f} > cap "
                           f"{settings.live_max_order_value:.0f}", "WARN")
            return False
        with SessionLocal() as db:
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            count = db.execute(
                select(func.count(Order.id)).where(Order.mode == "live", Order.placed_at >= today)
            ).scalar() or 0
            realized_today = db.execute(
                select(func.coalesce(func.sum(
                    (Trade.price * Trade.quantity) *
                    case((Trade.transaction_type == "SELL", 1), else_=-1)), 0.0)
                ).where(Trade.mode == "live", Trade.executed_at >= today)
            ).scalar() or 0.0
        if count >= settings.live_max_orders_per_day:
            self.log_event("live order blocked: daily order cap reached", "WARN")
            return False
        if settings.live_max_daily_loss > 0 and realized_today < -settings.live_max_daily_loss:
            self.log_event("live order blocked: global daily loss limit hit", "ERROR")
            return False
        return True

    # ------------------------------------------------------------------ order placement
    def _place(self, symbol: str, side: str, qty: int, reason: str, tag: str):
        ex = self.cfg.execution
        price = 0.0
        if ex.order_type == "LIMIT":
            ltp = self.broker.quote(symbol, self.cfg.universe.exchange)
            off = 1 + ex.limit_offset_pct / 100 if side == "BUY" else 1 - ex.limit_offset_pct / 100
            price = round(ltp * off, 2)
        req = OrderRequest(
            symbol=symbol, transaction_type=side, quantity=qty,
            exchange=self.cfg.universe.exchange, order_type=ex.order_type,
            product=ex.product, price=price, variety=ex.variety, tag=tag,
        )
        result = self.broker.place_order(req)
        with SessionLocal() as db:
            order = Order(
                strategy_id=self.id, broker_order_id=result.broker_order_id, mode=self.mode,
                exchange=req.exchange, symbol=symbol, transaction_type=side, quantity=qty,
                filled_quantity=result.filled_quantity, order_type=ex.order_type,
                product=ex.product, price=price, average_price=result.average_price,
                status=result.status or ("COMPLETE" if result.ok else "REJECTED"),
                status_message=result.message, tag=tag,
            )
            db.add(order)
            db.flush()
            if result.ok and result.status == "COMPLETE":
                db.add(Trade(
                    strategy_id=self.id, order_id=order.id, mode=self.mode, exchange=req.exchange,
                    symbol=symbol, transaction_type=side, quantity=qty,
                    price=result.average_price,
                    charges=result.charges or zerodha_charges(
                        result.average_price, qty, side == "BUY", ex.product),
                ))
            db.commit()
        if not result.ok:
            self.log_event(f"order rejected for {symbol}: {result.message}", "ERROR")
            return None
        return result

    def close_position(self, symbol: str, reason: str) -> None:
        pos = self.positions.get(symbol)
        if not pos or pos["quantity"] == 0:
            return
        qty = abs(pos["quantity"])
        side = "SELL" if pos["quantity"] > 0 else "BUY"
        result = self._place(symbol, side, qty, reason=reason, tag=f"s{self.id}x")
        if result is None:
            return
        fill = result.average_price
        direction = 1 if pos["quantity"] > 0 else -1
        pnl = (fill - pos["average_price"]) * direction * qty
        pos["quantity"] = 0
        self._persist_position(symbol, realized_delta=pnl)
        self._persist_paper()
        self.log_event(f"EXIT {qty} {symbol} @ {fill:.2f} (P&L {pnl:+.2f}) — {reason}", "TRADE")

    def flatten_all(self, reason: str) -> None:
        for symbol, pos in list(self.positions.items()):
            if pos["quantity"] != 0:
                self.close_position(symbol, reason)

    # ------------------------------------------------------------------ risk loop
    def _risk_cycle(self) -> None:
        r = self.cfg.risk
        t = self.cfg.filters.time
        now_ist = datetime.now(IST)

        # forced intraday square-off
        if (self.enforce_session and self.cfg.execution.product == "MIS"
                and now_ist.time() >= _parse_hhmm(t.square_off)):
            open_pos = [s for s, p in self.positions.items() if p["quantity"] != 0]
            if open_pos:
                self.flatten_all(f"square-off at {t.square_off}")
            return

        day_pnl = 0.0
        for symbol, pos in list(self.positions.items()):
            if pos["quantity"] == 0:
                continue
            ltp = self.broker.quote(symbol, self.cfg.universe.exchange)
            if ltp <= 0:
                continue
            qty = pos["quantity"]
            direction = 1 if qty > 0 else -1
            day_pnl += (ltp - pos["average_price"]) * qty

            # trailing stop: ratchet the anchor, exit on retrace
            if r.trailing_stop_pct > 0:
                if direction > 0:
                    pos["trail_anchor"] = max(pos["trail_anchor"], ltp)
                    trail_stop = pos["trail_anchor"] * (1 - r.trailing_stop_pct / 100)
                    if ltp <= trail_stop:
                        self.close_position(symbol, f"trailing stop ({r.trailing_stop_pct}% off "
                                                    f"{pos['trail_anchor']:.2f})")
                        continue
                else:
                    pos["trail_anchor"] = min(pos["trail_anchor"], ltp)
                    trail_stop = pos["trail_anchor"] * (1 + r.trailing_stop_pct / 100)
                    if ltp >= trail_stop:
                        self.close_position(symbol, "trailing stop")
                        continue
            if pos["stop_loss"] > 0 and ((direction > 0 and ltp <= pos["stop_loss"])
                                         or (direction < 0 and ltp >= pos["stop_loss"])):
                self.close_position(symbol, f"stop-loss {pos['stop_loss']:.2f} hit")
                continue
            if pos["take_profit"] > 0 and ((direction > 0 and ltp >= pos["take_profit"])
                                           or (direction < 0 and ltp <= pos["take_profit"])):
                self.close_position(symbol, f"take-profit {pos['take_profit']:.2f} hit")
                continue
            self._persist_position(symbol, last_price=ltp)

        # strategy-level daily kill switch (open P&L based)
        if r.max_loss_per_day > 0 and day_pnl < -r.max_loss_per_day:
            self.flatten_all("daily max loss hit — kill switch")
            self.paused = True
            self.halted_reason = f"kill switch: open P&L {day_pnl:.0f} breached max_loss_per_day"
            self._set_status("paused", self.halted_reason)
            self.log_event(self.halted_reason, "ERROR")

        # periodic equity snapshot
        now = time_mod.time()
        if now - self._last_snapshot >= SNAPSHOT_SECONDS:
            self._last_snapshot = now
            self._snapshot(day_pnl)

    def _snapshot(self, unrealized: float) -> None:
        m = self.broker.margins()
        equity = float(m.get("equity") or m.get("cash") or 0.0)
        realized = float(m.get("realized_pnl", 0.0))
        with SessionLocal() as db:
            db.add(PnlSnapshot(strategy_id=self.id, mode=self.mode, equity=equity,
                               realized_pnl=realized, unrealized_pnl=unrealized))
            db.commit()

    # ------------------------------------------------------------------ persistence
    def _persist_position(self, symbol: str, last_price: float | None = None,
                          realized_delta: float = 0.0) -> None:
        pos = self.positions.get(symbol)
        if pos is None:
            return
        with SessionLocal() as db:
            row = db.execute(
                select(Position).where(Position.strategy_id == self.id, Position.mode == self.mode,
                                       Position.symbol == symbol)
            ).scalar_one_or_none()
            if row is None:
                row = Position(strategy_id=self.id, mode=self.mode, symbol=symbol,
                               exchange=self.cfg.universe.exchange, product=self.cfg.execution.product)
                db.add(row)
            row.quantity = pos["quantity"]
            row.average_price = pos["average_price"]
            row.stop_loss = pos["stop_loss"]
            row.take_profit = pos["take_profit"]
            row.trail_anchor = pos["trail_anchor"]
            if last_price is not None:
                row.last_price = last_price
            if realized_delta:
                row.realized_pnl += realized_delta
            db.commit()

    def _persist_paper(self) -> None:
        if isinstance(self.broker, PaperBroker):
            runtime.save_paper_state(self.id, self.broker)

    def _set_status(self, status: str, error: str = "") -> None:
        with SessionLocal() as db:
            row = db.get(StrategyInstance, self.id)
            if row:
                row.status = status
                row.error_message = error
                db.commit()

    def _set_error(self, message: str) -> None:
        self.halted_reason = message
        self._set_status("error", message)
        self.log_event(message, "ERROR")

    def log_event(self, message: str, level: str = "INFO") -> None:
        log.info("[%s] %s", self.name, message)
        with SessionLocal() as db:
            db.add(EventLog(strategy_id=self.id, level=level, message=message))
            db.commit()
