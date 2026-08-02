"""RSI mean reversion: buy oversold, sell overbought, exit at the midline.
Works best on liquid large caps; avoid circuit-prone smallcaps."""
import pandas as pd

from ...indicators import ema, rsi
from .. import Strategy, StrategyContext, register


@register
class RsiReversion(Strategy):
    key = "rsi_reversion"
    name = "RSI Mean Reversion"
    description = "Buy when RSI drops below the oversold level, exit when it recovers past the exit level."
    param_schema = [
        {"name": "period", "type": "int", "default": 14, "min": 2, "max": 100,
         "description": "RSI period (use 2 for the aggressive RSI-2 variant)"},
        {"name": "oversold", "type": "float", "default": 30.0, "min": 1, "max": 50,
         "description": "Enter long below this RSI"},
        {"name": "overbought", "type": "float", "default": 70.0, "min": 50, "max": 99,
         "description": "Enter short above this RSI (if shorts enabled)"},
        {"name": "exit_level", "type": "float", "default": 50.0, "min": 20, "max": 80,
         "description": "Exit when RSI crosses back through this level"},
        {"name": "allow_short_entries", "type": "bool", "default": False,
         "description": "Short overbought conditions (intraday MIS only)"},
        {"name": "trend_filter_period", "type": "int", "default": 200, "min": 0, "max": 500,
         "description": "Only buy dips above this EMA (0 = off)"},
    ]

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        p = self.params
        if len(df) < max(int(p["period"]), int(p["trend_filter_period"])) + 2:
            return
        r = rsi(df, int(p["period"]))
        now, prev = r.iloc[-1], r.iloc[-2]
        pos = ctx.position(symbol)

        trend_ok = True
        tf = int(p["trend_filter_period"])
        if tf > 0:
            trend_ok = df["close"].iloc[-1] > ema(df, tf).iloc[-1]

        if pos > 0 and prev < p["exit_level"] <= now:
            ctx.exit(symbol, f"RSI recovered through {p['exit_level']}")
        elif pos < 0 and prev > p["exit_level"] >= now:
            ctx.exit(symbol, f"RSI fell back through {p['exit_level']}")
        elif pos == 0:
            if now < p["oversold"] and trend_ok:
                ctx.enter_long(symbol, f"RSI {now:.1f} < {p['oversold']}")
            elif now > p["overbought"] and p["allow_short_entries"]:
                ctx.enter_short(symbol, f"RSI {now:.1f} > {p['overbought']}")
