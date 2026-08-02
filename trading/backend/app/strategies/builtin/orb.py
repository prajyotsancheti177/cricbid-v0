"""Opening Range Breakout: define the range from the first N minutes after open
(default 09:15–09:30 to skip auction-unwind noise), trade the first clean breakout."""
import pandas as pd

from .. import Strategy, StrategyContext, register


@register
class OpeningRangeBreakout(Strategy):
    key = "orb"
    name = "Opening Range Breakout"
    description = "Buy a break above the opening range high (short below the low). One trade per symbol per day."
    param_schema = [
        {"name": "range_minutes", "type": "int", "default": 15, "min": 5, "max": 60,
         "description": "Opening range duration in minutes from 09:15"},
        {"name": "buffer_pct", "type": "float", "default": 0.05, "min": 0, "max": 1,
         "description": "Breakout must exceed the range by this % to filter noise"},
        {"name": "allow_short_entries", "type": "bool", "default": True,
         "description": "Also short breakdowns below the range low"},
        {"name": "min_range_pct", "type": "float", "default": 0.15, "min": 0, "max": 5,
         "description": "Skip days where the range is narrower than this % (chop guard)"},
    ]

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        p = self.params
        last_ts = df.index[-1]
        day = str(last_ts.date())
        state = ctx.state.setdefault(symbol, {})

        if state.get("day") != day:
            state.clear()
            state["day"] = day

        session = df[df.index.date == last_ts.date()]
        if session.empty:
            return
        open_ts = session.index[0]
        range_end = open_ts + pd.Timedelta(minutes=int(p["range_minutes"]))

        if "hi" not in state:
            opening = session[session.index < range_end]
            if last_ts < range_end or opening.empty:
                return  # still inside the opening range
            state["hi"] = float(opening["high"].max())
            state["lo"] = float(opening["low"].min())

        hi, lo = state["hi"], state["lo"]
        if (hi - lo) / lo * 100 < p["min_range_pct"]:
            return
        if state.get("traded"):
            return

        buffer = 1 + p["buffer_pct"] / 100
        close = df["close"].iloc[-1]
        if ctx.position(symbol) == 0:
            if close > hi * buffer:
                state["traded"] = True
                ctx.enter_long(symbol, f"broke above opening range high {hi:.2f}")
            elif close < lo / buffer and p["allow_short_entries"]:
                state["traded"] = True
                ctx.enter_short(symbol, f"broke below opening range low {lo:.2f}")
