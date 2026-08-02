"""MACD + trend filter combo. Standalone MACD crosses lose to Indian costs;
this variant only takes crosses in the direction of the 200-EMA trend."""
import pandas as pd

from ...indicators import ema, macd, macd_signal
from .. import Strategy, StrategyContext, register


@register
class MacdTrend(Strategy):
    key = "macd_trend"
    name = "MACD Trend Confirmation"
    description = "MACD/signal crosses taken only in the direction of a long EMA trend filter."
    param_schema = [
        {"name": "fast", "type": "int", "default": 12, "min": 2, "max": 100, "description": "MACD fast EMA"},
        {"name": "slow", "type": "int", "default": 26, "min": 5, "max": 200, "description": "MACD slow EMA"},
        {"name": "signal", "type": "int", "default": 9, "min": 2, "max": 50, "description": "Signal EMA"},
        {"name": "trend_period", "type": "int", "default": 200, "min": 10, "max": 500,
         "description": "EMA trend filter period"},
        {"name": "allow_short_entries", "type": "bool", "default": False,
         "description": "Short bearish crosses in downtrends (intraday MIS only)"},
    ]

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        p = self.params
        need = max(int(p["slow"]) + int(p["signal"]), int(p["trend_period"])) + 2
        if len(df) < need:
            return
        m = macd(df, int(p["fast"]), int(p["slow"]))
        s = macd_signal(df, int(p["fast"]), int(p["slow"]), int(p["signal"]))
        uptrend = df["close"].iloc[-1] > ema(df, int(p["trend_period"])).iloc[-1]

        crossed_up = m.iloc[-2] <= s.iloc[-2] and m.iloc[-1] > s.iloc[-1]
        crossed_down = m.iloc[-2] >= s.iloc[-2] and m.iloc[-1] < s.iloc[-1]
        pos = ctx.position(symbol)

        if crossed_up:
            if pos < 0:
                ctx.exit(symbol, "MACD crossed up: cover")
            if pos <= 0 and uptrend:
                ctx.enter_long(symbol, "MACD crossed above signal in uptrend")
        elif crossed_down:
            if pos > 0:
                ctx.exit(symbol, "MACD crossed down: exit")
            if pos >= 0 and not uptrend and p["allow_short_entries"]:
                ctx.enter_short(symbol, "MACD crossed below signal in downtrend")
