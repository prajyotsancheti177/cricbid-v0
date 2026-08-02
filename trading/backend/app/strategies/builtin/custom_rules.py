"""Fully declarative strategy: entries and exits are rule expressions you write in the
config — no code needed. See app/engine/rules.py for the expression language.

Example params:
    long_entry:  "ema(9) crosses_above ema(21) and rsi(14) < 65"
    long_exit:   "ema(9) crosses_below ema(21)"
    short_entry: "close < vwap() and rsi(14) > 70"
    short_exit:  "close > vwap()"
"""
import pandas as pd

from ...engine.rules import Rule, RuleError, compile_rule
from .. import Strategy, StrategyContext, register


@register
class CustomRules(Strategy):
    key = "custom_rules"
    name = "Custom Rule Strategy"
    description = ("Write your own entry/exit conditions as expressions over indicators, "
                   "e.g. \"ema(9) crosses_above ema(21) and rsi(14) < 60\".")
    param_schema = [
        {"name": "long_entry", "type": "str", "default": "ema(9) crosses_above ema(21)",
         "description": "Rule to open a long position"},
        {"name": "long_exit", "type": "str", "default": "ema(9) crosses_below ema(21)",
         "description": "Rule to close a long position"},
        {"name": "short_entry", "type": "str", "default": "",
         "description": "Rule to open a short (blank = never; shorts are intraday MIS only)"},
        {"name": "short_exit", "type": "str", "default": "",
         "description": "Rule to close a short"},
    ]

    def __init__(self, params: dict | None = None):
        super().__init__(params)
        self._rules: dict[str, Rule | None] = {}
        for k in ("long_entry", "long_exit", "short_entry", "short_exit"):
            try:
                self._rules[k] = compile_rule(self.params.get(k, ""))
            except RuleError as e:
                raise ValueError(f"{k}: {e}") from e

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        pos = ctx.position(symbol)
        r = self._rules
        try:
            if pos > 0 and r["long_exit"] and r["long_exit"].evaluate(df):
                ctx.exit(symbol, f"rule: {r['long_exit'].text}")
            elif pos < 0 and r["short_exit"] and r["short_exit"].evaluate(df):
                ctx.exit(symbol, f"rule: {r['short_exit'].text}")
            elif pos == 0:
                if r["long_entry"] and r["long_entry"].evaluate(df):
                    ctx.enter_long(symbol, f"rule: {r['long_entry'].text}")
                elif r["short_entry"] and r["short_entry"].evaluate(df):
                    ctx.enter_short(symbol, f"rule: {r['short_entry'].text}")
        except RuleError as e:
            ctx.log(f"rule error on {symbol}: {e}", level="ERROR")
