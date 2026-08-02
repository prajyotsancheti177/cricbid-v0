"""Supertrend (10, 3) trend following — India's most popular retail system.
Long while price is above the supertrend line; optional ADX-style churn filter via EMA distance."""
import pandas as pd

from ...indicators import ema, supertrend_dir
from .. import Strategy, StrategyContext, register


@register
class SupertrendFollow(Strategy):
    key = "supertrend"
    name = "Supertrend Following"
    description = "Long when price flips above the Supertrend line, exit/flip when it flips below."
    param_schema = [
        {"name": "period", "type": "int", "default": 10, "min": 3, "max": 50,
         "description": "ATR period"},
        {"name": "multiplier", "type": "float", "default": 3.0, "min": 0.5, "max": 10,
         "description": "ATR multiplier"},
        {"name": "allow_short_entries", "type": "bool", "default": False,
         "description": "Flip short on bearish flips (intraday MIS only)"},
        {"name": "ema_filter_period", "type": "int", "default": 200, "min": 0, "max": 500,
         "description": "Only take longs above this EMA to avoid range churn (0 = off)"},
    ]

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        p = self.params
        if len(df) < int(p["period"]) + 3:
            return
        d = supertrend_dir(df, int(p["period"]), float(p["multiplier"]))
        flipped_up = d.iloc[-2] < 0 < d.iloc[-1]
        flipped_down = d.iloc[-2] > 0 > d.iloc[-1]

        trend_ok = True
        tf = int(p["ema_filter_period"])
        if tf > 0 and len(df) >= tf:
            trend_ok = df["close"].iloc[-1] > ema(df, tf).iloc[-1]

        pos = ctx.position(symbol)
        if flipped_up:
            if pos < 0:
                ctx.exit(symbol, "supertrend flipped up: cover")
            if pos <= 0 and trend_ok:
                ctx.enter_long(symbol, "supertrend flipped up")
        elif flipped_down:
            if pos > 0:
                ctx.exit(symbol, "supertrend flipped down: exit")
            if pos >= 0 and p["allow_short_entries"]:
                ctx.enter_short(symbol, "supertrend flipped down")
