"""EMA crossover: long on fast-over-slow cross, exit (or flip short) on the reverse cross.
India defaults: EMA 9/21 on 5-minute bars for intraday MIS."""
import pandas as pd

from ...indicators import ema
from .. import Strategy, StrategyContext, register


@register
class MaCrossover(Strategy):
    key = "ma_crossover"
    name = "Moving Average Crossover"
    description = "Long when fast EMA crosses above slow EMA; exit/flip on cross below. EMA 9/21 intraday default."
    param_schema = [
        {"name": "fast", "type": "int", "default": 9, "min": 2, "max": 200,
         "description": "Fast EMA period"},
        {"name": "slow", "type": "int", "default": 21, "min": 3, "max": 400,
         "description": "Slow EMA period"},
        {"name": "allow_short_entries", "type": "bool", "default": False,
         "description": "Also flip short on bearish cross (intraday MIS only)"},
        {"name": "trend_filter_period", "type": "int", "default": 0, "min": 0, "max": 500,
         "description": "Only take longs above this EMA (0 = off)"},
    ]

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        fast = ema(df, int(self.params["fast"]))
        slow = ema(df, int(self.params["slow"]))
        if len(df) < int(self.params["slow"]) + 2:
            return

        crossed_up = fast.iloc[-2] <= slow.iloc[-2] and fast.iloc[-1] > slow.iloc[-1]
        crossed_down = fast.iloc[-2] >= slow.iloc[-2] and fast.iloc[-1] < slow.iloc[-1]

        tf = int(self.params["trend_filter_period"])
        trend_ok = True
        if tf > 0 and len(df) >= tf:
            trend_ok = df["close"].iloc[-1] > ema(df, tf).iloc[-1]

        pos = ctx.position(symbol)
        if crossed_up:
            if pos < 0:
                ctx.exit(symbol, "bullish cross: cover short")
            if pos <= 0 and trend_ok:
                ctx.enter_long(symbol, f"EMA{self.params['fast']} crossed above EMA{self.params['slow']}")
        elif crossed_down:
            if pos > 0:
                ctx.exit(symbol, "bearish cross: exit long")
            if pos >= 0 and self.params["allow_short_entries"]:
                ctx.enter_short(symbol, f"EMA{self.params['fast']} crossed below EMA{self.params['slow']}")
