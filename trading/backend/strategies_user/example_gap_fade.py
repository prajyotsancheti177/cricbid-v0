"""Example USER strategy plugin. Drop any .py file like this into strategies_user/
and it is auto-discovered at startup — it appears in the UI with a config form
generated from param_schema, and gets the full filter/sizing/risk/execution pipeline
for free.

This one fades large opening gaps on index heavyweights: if a stock gaps down more
than `gap_pct` versus yesterday's close and holds above the opening low for
`confirm_candles` bars, buy the reversion.
"""
import pandas as pd

from app.strategies import Strategy, StrategyContext, register


@register
class GapFade(Strategy):
    key = "gap_fade"
    name = "Gap Fade (user example)"
    description = "Fade large opening gaps that stabilize: buy gap-downs, short gap-ups."
    param_schema = [
        {"name": "gap_pct", "type": "float", "default": 1.5, "min": 0.3, "max": 10,
         "description": "Minimum overnight gap size (%) to consider fading"},
        {"name": "confirm_candles", "type": "int", "default": 3, "min": 1, "max": 20,
         "description": "Candles the price must hold before entering"},
        {"name": "allow_short_entries", "type": "bool", "default": False,
         "description": "Also fade gap-ups by shorting (intraday MIS only)"},
    ]

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        p = self.params
        today = df.index[-1].date()
        session = df[df.index.date == today]
        prior = df[df.index.date < today]
        if prior.empty or len(session) < int(p["confirm_candles"]):
            return

        prev_close = float(prior["close"].iloc[-1])
        today_open = float(session["open"].iloc[0])
        gap = (today_open - prev_close) / prev_close * 100

        state = ctx.state.setdefault(symbol, {})
        if state.get("day") != str(today):
            state.clear()
            state["day"] = str(today)

        if state.get("traded") or ctx.position(symbol) != 0:
            return

        n = int(p["confirm_candles"])
        if gap <= -p["gap_pct"]:
            held = (session["low"].tail(n) >= session["low"].iloc[0]).all()
            if held and len(session) >= n:
                state["traded"] = True
                ctx.enter_long(symbol, f"fading {gap:.2f}% gap-down that held its lows")
        elif gap >= p["gap_pct"] and p["allow_short_entries"]:
            held = (session["high"].tail(n) <= session["high"].iloc[0]).all()
            if held and len(session) >= n:
                state["traded"] = True
                ctx.enter_short(symbol, f"fading +{gap:.2f}% gap-up that stalled")
