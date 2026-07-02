"""VWAP strategy with two modes: trend (trade with price relative to VWAP) or
reversion (fade stretched moves back towards VWAP). Intraday only."""
import pandas as pd

from ...indicators import vwap
from .. import Strategy, StrategyContext, register


@register
class VwapStrategy(Strategy):
    key = "vwap"
    name = "VWAP Trend / Reversion"
    description = "Trend mode: long above VWAP after a pullback-reclaim. Reversion mode: fade % stretches from VWAP."
    param_schema = [
        {"name": "mode", "type": "choice", "default": "trend", "options": ["trend", "reversion"],
         "description": "Trade with the VWAP trend or fade stretches from it"},
        {"name": "stretch_pct", "type": "float", "default": 0.5, "min": 0.1, "max": 5,
         "description": "Reversion: enter when price is this % away from VWAP"},
        {"name": "confirm_candles", "type": "int", "default": 2, "min": 1, "max": 10,
         "description": "Trend: candles that must close above/below VWAP before entry"},
        {"name": "allow_short_entries", "type": "bool", "default": True,
         "description": "Take short-side setups too (intraday MIS only)"},
    ]

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        p = self.params
        session = df[df.index.date == df.index[-1].date()]
        if len(session) < int(p["confirm_candles"]) + 1:
            return
        v = vwap(session)
        close = session["close"]
        pos = ctx.position(symbol)

        if p["mode"] == "trend":
            n = int(p["confirm_candles"])
            above = (close.tail(n) > v.tail(n)).all()
            below = (close.tail(n) < v.tail(n)).all()
            if pos == 0:
                if above:
                    ctx.enter_long(symbol, f"{n} closes above VWAP")
                elif below and p["allow_short_entries"]:
                    ctx.enter_short(symbol, f"{n} closes below VWAP")
            elif pos > 0 and close.iloc[-1] < v.iloc[-1]:
                ctx.exit(symbol, "closed back below VWAP")
            elif pos < 0 and close.iloc[-1] > v.iloc[-1]:
                ctx.exit(symbol, "closed back above VWAP")
        else:  # reversion
            stretch = (close.iloc[-1] - v.iloc[-1]) / v.iloc[-1] * 100
            if pos == 0:
                if stretch < -p["stretch_pct"]:
                    ctx.enter_long(symbol, f"{stretch:.2f}% below VWAP")
                elif stretch > p["stretch_pct"] and p["allow_short_entries"]:
                    ctx.enter_short(symbol, f"{stretch:.2f}% above VWAP")
            elif (pos > 0 and stretch >= 0) or (pos < 0 and stretch <= 0):
                ctx.exit(symbol, "reverted to VWAP")
