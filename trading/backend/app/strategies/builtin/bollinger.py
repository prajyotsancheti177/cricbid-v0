"""Bollinger Band squeeze breakout: wait for band width to compress below a threshold,
then trade the direction of the band break. Restrict to liquid F&O-listed names."""
import pandas as pd

from ...indicators import bb_lower, bb_upper, bb_width
from .. import Strategy, StrategyContext, register


@register
class BollingerSqueeze(Strategy):
    key = "bollinger_squeeze"
    name = "Bollinger Squeeze Breakout"
    description = "Enter when price breaks a band after a volatility squeeze; exit at the middle band."
    param_schema = [
        {"name": "period", "type": "int", "default": 20, "min": 5, "max": 100,
         "description": "Bollinger period"},
        {"name": "mult", "type": "float", "default": 2.0, "min": 0.5, "max": 4,
         "description": "Standard deviation multiplier"},
        {"name": "squeeze_width_pct", "type": "float", "default": 3.0, "min": 0.2, "max": 20,
         "description": "Band width (as % of mid) must be below this to arm a breakout"},
        {"name": "allow_short_entries", "type": "bool", "default": False,
         "description": "Short lower-band breaks (intraday MIS only)"},
    ]

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        p = self.params
        period, mult = int(p["period"]), float(p["mult"])
        if len(df) < period + 3:
            return
        width_pct = bb_width(df, period, mult) * 100
        upper = bb_upper(df, period, mult)
        lower = bb_lower(df, period, mult)
        mid = (upper + lower) / 2
        close = df["close"]
        pos = ctx.position(symbol)

        if pos == 0:
            squeezed = width_pct.iloc[-2] < p["squeeze_width_pct"]
            if squeezed and close.iloc[-1] > upper.iloc[-1]:
                ctx.enter_long(symbol, f"squeeze breakout above upper band (width {width_pct.iloc[-2]:.2f}%)")
            elif squeezed and close.iloc[-1] < lower.iloc[-1] and p["allow_short_entries"]:
                ctx.enter_short(symbol, f"squeeze breakdown below lower band (width {width_pct.iloc[-2]:.2f}%)")
        elif pos > 0 and close.iloc[-1] < mid.iloc[-1]:
            ctx.exit(symbol, "fell back to middle band")
        elif pos < 0 and close.iloc[-1] > mid.iloc[-1]:
            ctx.exit(symbol, "rose back to middle band")
