"""Backtest-lite: replays historical candles through the exact same Strategy code
used live/paper, with paper-style fills (next candle's open + slippage) and the real
Zerodha cost model. Validates a config before you promote it to paper or live.

Data source: KiteFeed historical when a Kite session exists, else the deterministic
SimFeed history — so backtests always work, even with zero credentials.
"""
import math
from datetime import datetime, time as dtime

import numpy as np
import pandas as pd

from ..brokers.base import zerodha_charges
from ..engine.rules import compile_rule
from ..engine.runtime import runtime
from ..schemas import StrategyConfigSchema
from ..strategies import REGISTRY, StrategyContext


class BacktestContext(StrategyContext):
    def __init__(self, bt: "Backtester"):
        self._bt = bt
        self.state: dict = {}

    @property
    def params(self) -> dict:
        return self._bt.strategy.params

    def position(self, symbol: str) -> int:
        return self._bt.positions.get(symbol, {}).get("quantity", 0)

    def enter_long(self, symbol: str, reason: str = "") -> None:
        self._bt.queue_intent(symbol, "BUY", reason)

    def enter_short(self, symbol: str, reason: str = "") -> None:
        self._bt.queue_intent(symbol, "SELL", reason)

    def exit(self, symbol: str, reason: str = "") -> None:
        self._bt.queue_intent(symbol, "EXIT", reason)

    def log(self, message: str, level: str = "INFO") -> None:
        pass


def _parse_hhmm(s: str) -> dtime:
    h, m = s.split(":")
    return dtime(int(h), int(m))


class Backtester:
    def __init__(self, strategy_type: str, config: StrategyConfigSchema,
                 from_date: str, to_date: str, starting_cash: float = 1_000_000.0):
        cls = REGISTRY.get(strategy_type)
        if cls is None:
            raise ValueError(f"unknown strategy type '{strategy_type}'")
        self.cfg = config
        self.strategy = cls(config.params)
        self.from_date, self.to_date = from_date, to_date
        self.cash = starting_cash
        self.starting_cash = starting_cash
        self.slippage_pct = (config.execution.slippage_pct
                             if config.execution.slippage_pct is not None else 0.02)
        self.positions: dict[str, dict] = {}
        self.trades: list[dict] = []
        self.equity_curve: list[dict] = []
        self.ctx = BacktestContext(self)
        self._intents: list[tuple[str, str, str]] = []
        self._entries_today = 0
        self._entry_rule = (compile_rule(config.filters.extra_entry_rule)
                            if config.filters.extra_entry_rule else None)

    # ------------------------------------------------------------------ data
    def _load_data(self) -> dict[str, pd.DataFrame]:
        feed = runtime.feed
        out = {}
        for symbol in self.cfg.universe.symbols[: self.cfg.universe.max_symbols]:
            df = feed.historical(symbol, self.from_date, self.to_date, self.cfg.data.timeframe)
            if not df.empty:
                out[symbol] = df
        if not out:
            raise ValueError("no historical data for the selected symbols/dates")
        return out

    # ------------------------------------------------------------------ run
    def run(self) -> dict:
        data = self._load_data()
        # unified clock across symbols
        all_ts = sorted(set().union(*[set(df.index) for df in data.values()]))
        lookback = self.cfg.data.lookback_candles
        t_cfg = self.cfg.filters.time
        sq_off = _parse_hhmm(t_cfg.square_off)
        start_t, end_t = _parse_hhmm(t_cfg.trade_start), _parse_hhmm(t_cfg.trade_end)
        is_intraday = self.cfg.data.timeframe != "day" and self.cfg.execution.product == "MIS"
        current_day = None

        self.strategy.on_start(self.ctx)
        for i, ts in enumerate(all_ts):
            if current_day != ts.date():
                current_day = ts.date()
                self._entries_today = 0
            # risk checks intra-candle using this candle's high/low
            self._check_stops(data, ts)
            if is_intraday and ts.time() >= sq_off:
                self._square_off_all(data, ts, "square-off")
            in_window = (not is_intraday) or (start_t <= ts.time() <= end_t)

            for symbol, df in data.items():
                if ts not in df.index:
                    continue
                window = df.loc[:ts].tail(lookback)
                if len(window) < 3:
                    continue
                self._current_window = window
                self.strategy.on_candle(self.ctx, symbol, window)
                # execute intents at the NEXT candle open (no lookahead)
                self._execute_intents(data, ts, allow_entries=in_window)
            self._mark_equity(data, ts)
        # liquidate at the end for a clean final equity
        self._square_off_all(data, all_ts[-1], "end of backtest")
        self.strategy.on_stop(self.ctx)
        return self._results()

    def queue_intent(self, symbol: str, kind: str, reason: str) -> None:
        self._intents.append((symbol, kind, reason))

    def _next_open(self, df: pd.DataFrame, ts) -> float | None:
        idx = df.index.get_indexer([ts])[0]
        if idx == -1 or idx + 1 >= len(df):
            return float(df.loc[ts, "close"]) if ts in df.index else None
        return float(df.iloc[idx + 1]["open"])

    def _execute_intents(self, data, ts, allow_entries: bool) -> None:
        intents, self._intents = self._intents, []
        for symbol, kind, reason in intents:
            df = data.get(symbol)
            if df is None:
                continue
            fill_base = self._next_open(df, ts)
            if fill_base is None or fill_base <= 0:
                continue
            if kind == "EXIT":
                self._close(symbol, fill_base, ts, reason)
                continue
            if not allow_entries:
                continue
            f = self.cfg.filters
            if self._entries_today >= f.max_trades_per_day:
                continue
            if sum(1 for p in self.positions.values() if p["quantity"] != 0) >= self.cfg.risk.max_positions:
                continue
            if not (f.min_price <= fill_base <= f.max_price):
                continue
            if self._entry_rule is not None and not self._entry_rule.evaluate(self._current_window):
                continue
            if kind == "SELL" and (not self.cfg.execution.allow_short
                                   or self.cfg.execution.product == "CNC"):
                continue
            existing = self.positions.get(symbol, {}).get("quantity", 0)
            if existing != 0:
                continue
            qty = self._size(fill_base)
            if qty <= 0:
                continue
            slip = fill_base * self.slippage_pct / 100
            fill = fill_base + slip if kind == "BUY" else fill_base - slip
            notional = fill * qty
            if notional > self.cfg.risk.max_position_value:
                qty = int(self.cfg.risk.max_position_value // fill)
            if qty <= 0:
                continue
            charges = zerodha_charges(fill, qty, kind == "BUY", self.cfg.execution.product)
            if kind == "BUY" and fill * qty + charges > self.cash:
                continue
            signed = qty if kind == "BUY" else -qty
            self.cash += (-fill * qty - charges) if kind == "BUY" else (fill * qty - charges)
            r = self.cfg.risk
            sl = tp = 0.0
            if r.stop_loss_pct > 0:
                sl = fill * (1 - r.stop_loss_pct / 100) if signed > 0 else fill * (1 + r.stop_loss_pct / 100)
            if r.take_profit_pct > 0:
                tp = fill * (1 + r.take_profit_pct / 100) if signed > 0 else fill * (1 - r.take_profit_pct / 100)
            self.positions[symbol] = {"quantity": signed, "average_price": fill,
                                      "stop_loss": sl, "take_profit": tp, "trail_anchor": fill}
            self._entries_today += 1
            self.trades.append({"at": str(ts), "symbol": symbol, "side": kind, "quantity": qty,
                                "price": round(fill, 2), "charges": charges, "reason": reason,
                                "pnl": None})

    def _size(self, price: float) -> int:
        s = self.cfg.sizing
        equity = self._equity_value()
        if s.method == "fixed_quantity":
            qty = int(s.value)
        elif s.method == "fixed_value":
            qty = int(s.value // price)
        elif s.method == "percent_capital":
            qty = int((equity * s.value / 100) // price)
        else:
            sl_pct = self.cfg.risk.stop_loss_pct
            qty = int(s.value) if sl_pct <= 0 else int((equity * s.value / 100) // (price * sl_pct / 100))
        return max(0, min(qty, s.max_quantity))

    def _check_stops(self, data, ts) -> None:
        r = self.cfg.risk
        for symbol, pos in list(self.positions.items()):
            if pos["quantity"] == 0 or ts not in data.get(symbol, pd.DataFrame()).index:
                continue
            row = data[symbol].loc[ts]
            hi, lo = float(row["high"]), float(row["low"])
            direction = 1 if pos["quantity"] > 0 else -1
            if r.trailing_stop_pct > 0:
                if direction > 0:
                    pos["trail_anchor"] = max(pos["trail_anchor"], hi)
                    trail = pos["trail_anchor"] * (1 - r.trailing_stop_pct / 100)
                    if lo <= trail:
                        self._close(symbol, trail, ts, "trailing stop")
                        continue
                else:
                    pos["trail_anchor"] = min(pos["trail_anchor"], lo)
                    trail = pos["trail_anchor"] * (1 + r.trailing_stop_pct / 100)
                    if hi >= trail:
                        self._close(symbol, trail, ts, "trailing stop")
                        continue
            sl, tp = pos["stop_loss"], pos["take_profit"]
            # worst-case ordering: stop-loss is checked before take-profit
            if sl > 0 and ((direction > 0 and lo <= sl) or (direction < 0 and hi >= sl)):
                self._close(symbol, sl, ts, "stop-loss")
                continue
            if tp > 0 and ((direction > 0 and hi >= tp) or (direction < 0 and lo <= tp)):
                self._close(symbol, tp, ts, "take-profit")

    def _close(self, symbol: str, price: float, ts, reason: str) -> None:
        pos = self.positions.get(symbol)
        if not pos or pos["quantity"] == 0:
            return
        qty = abs(pos["quantity"])
        direction = 1 if pos["quantity"] > 0 else -1
        slip = price * self.slippage_pct / 100
        fill = price - slip * direction
        charges = zerodha_charges(fill, qty, direction < 0, self.cfg.execution.product)
        pnl = (fill - pos["average_price"]) * direction * qty - charges
        self.cash += (fill * qty - charges) if direction > 0 else (-fill * qty - charges)
        pos["quantity"] = 0
        self.trades.append({"at": str(ts), "symbol": symbol,
                            "side": "SELL" if direction > 0 else "BUY", "quantity": qty,
                            "price": round(fill, 2), "charges": charges, "reason": reason,
                            "pnl": round(pnl, 2)})

    def _square_off_all(self, data, ts, reason: str) -> None:
        for symbol, pos in list(self.positions.items()):
            if pos["quantity"] != 0 and symbol in data and ts in data[symbol].index:
                self._close(symbol, float(data[symbol].loc[ts, "close"]), ts, reason)

    def _equity_value(self, data=None, ts=None) -> float:
        equity = self.cash
        for symbol, pos in self.positions.items():
            if pos["quantity"] == 0:
                continue
            price = pos["average_price"]
            if data is not None and ts is not None and symbol in data and ts in data[symbol].index:
                price = float(data[symbol].loc[ts, "close"])
            equity += price * pos["quantity"]
        return equity

    def _mark_equity(self, data, ts) -> None:
        self.equity_curve.append({"at": str(ts), "equity": round(self._equity_value(data, ts), 2)})

    # ------------------------------------------------------------------ stats
    def _results(self) -> dict:
        eq = pd.Series([e["equity"] for e in self.equity_curve])
        closed = [t for t in self.trades if t["pnl"] is not None]
        wins = [t for t in closed if t["pnl"] > 0]
        total_charges = sum(t["charges"] for t in self.trades)
        returns = eq.pct_change().dropna()
        max_dd = 0.0
        if len(eq):
            peak = eq.cummax()
            max_dd = float(((eq - peak) / peak).min()) * 100
        # rough annualization by bar count
        bars_per_year = {"day": 252}.get(self.cfg.data.timeframe, 252 * 375 // max(
            1, int(self.cfg.data.timeframe.replace("minute", "") or 1)
            if "minute" in self.cfg.data.timeframe else 1))
        sharpe = 0.0
        if len(returns) > 2 and returns.std() > 0:
            sharpe = float(returns.mean() / returns.std() * math.sqrt(min(bars_per_year, 252 * 375)))
        final_equity = float(eq.iloc[-1]) if len(eq) else self.starting_cash
        stats = {
            "starting_cash": self.starting_cash,
            "final_equity": round(final_equity, 2),
            "total_return_pct": round((final_equity / self.starting_cash - 1) * 100, 2),
            "num_trades": len(closed),
            "win_rate_pct": round(len(wins) / len(closed) * 100, 1) if closed else 0.0,
            "avg_trade_pnl": round(float(np.mean([t["pnl"] for t in closed])), 2) if closed else 0.0,
            "best_trade": round(max((t["pnl"] for t in closed), default=0.0), 2),
            "worst_trade": round(min((t["pnl"] for t in closed), default=0.0), 2),
            "max_drawdown_pct": round(max_dd, 2),
            "sharpe_estimate": round(sharpe, 2),
            "total_charges": round(total_charges, 2),
        }
        # thin the equity curve for transport
        curve = self.equity_curve
        if len(curve) > 2000:
            step = len(curve) // 2000 + 1
            curve = curve[::step]
        return {"stats": stats, "equity_curve": curve, "trades": self.trades[-500:]}
