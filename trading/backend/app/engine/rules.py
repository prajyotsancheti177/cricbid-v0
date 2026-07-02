"""Declarative rule language for entries/exits/filters.

Example rules (evaluated on the latest closed candle of one symbol):

    ema(9) crosses_above ema(21) and rsi(14) < 60
    close > vwap() and volume > sma(20, 'volume') * 1.5
    supertrend_dir(10, 3) == 1

Indicator names resolve through the indicator registry. Bare names close/open/high/
low/volume refer to the candle series. `crosses_above` / `crosses_below` are infix
operators rewritten to function calls before parsing. Evaluation uses a whitelisted
Python AST — no attribute access, no imports, no builtins.

Indicator results are wrapped in `Val`, which keeps the latest and previous values:
comparisons/booleans act on the latest value, while crossover operators also use the
previous one, so `ema(9) * 1.01 crosses_above ema(21)` behaves as expected.
"""
import ast
import re

import pandas as pd

from ..indicators import REGISTRY

_INFIX = re.compile(r"(.+?)\s+(crosses_above|crosses_below)\s+(.+)")

_ALLOWED_NODES = (
    ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.UnaryOp, ast.Not, ast.USub,
    ast.BinOp, ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow,
    ast.Compare, ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.Call, ast.Name, ast.Load, ast.Constant, ast.keyword,
)


class RuleError(ValueError):
    pass


class Val:
    """Scalar view of an indicator series: latest value plus the previous one."""

    __slots__ = ("last", "prev")

    def __init__(self, last: float, prev: float | None = None):
        self.last = float(last)
        self.prev = self.last if prev is None else float(prev)

    @classmethod
    def of(cls, x) -> "Val":
        if isinstance(x, Val):
            return x
        if isinstance(x, pd.Series):
            last = float(x.iloc[-1])
            prev = float(x.iloc[-2]) if len(x) > 1 else last
            return cls(last, prev)
        return cls(float(x))

    def _combine(self, other, op) -> "Val":
        o = Val.of(other)
        return Val(op(self.last, o.last), op(self.prev, o.prev))

    def __add__(self, o): return self._combine(o, lambda a, b: a + b)
    def __radd__(self, o): return Val.of(o)._combine(self, lambda a, b: a + b)
    def __sub__(self, o): return self._combine(o, lambda a, b: a - b)
    def __rsub__(self, o): return Val.of(o)._combine(self, lambda a, b: a - b)
    def __mul__(self, o): return self._combine(o, lambda a, b: a * b)
    def __rmul__(self, o): return Val.of(o)._combine(self, lambda a, b: a * b)
    def __truediv__(self, o): return self._combine(o, lambda a, b: a / b)
    def __rtruediv__(self, o): return Val.of(o)._combine(self, lambda a, b: a / b)
    def __mod__(self, o): return self._combine(o, lambda a, b: a % b)
    def __pow__(self, o): return self._combine(o, lambda a, b: a ** b)
    def __neg__(self): return Val(-self.last, -self.prev)
    def __abs__(self): return Val(abs(self.last), abs(self.prev))

    def __gt__(self, o): return self.last > Val.of(o).last
    def __ge__(self, o): return self.last >= Val.of(o).last
    def __lt__(self, o): return self.last < Val.of(o).last
    def __le__(self, o): return self.last <= Val.of(o).last
    def __eq__(self, o): return self.last == Val.of(o).last
    def __ne__(self, o): return self.last != Val.of(o).last
    def __bool__(self): return self.last != 0.0
    def __hash__(self): return hash((self.last, self.prev))


def crosses_above(a, b) -> bool:
    a, b = Val.of(a), Val.of(b)
    return a.prev <= b.prev and a.last > b.last


def crosses_below(a, b) -> bool:
    a, b = Val.of(a), Val.of(b)
    return a.prev >= b.prev and a.last < b.last


def _rewrite_infix(rule: str) -> str:
    """Rewrite `A crosses_above B` -> `crosses_above(A, B)` within and/or clauses."""

    def rewrite_clause(clause: str) -> str:
        m = _INFIX.fullmatch(clause.strip())
        if m:
            return f"{m.group(2)}({m.group(1).strip()}, {m.group(3).strip()})"
        return clause

    parts = re.split(r"(\band\b|\bor\b)", rule)
    return " ".join(rewrite_clause(p) if p.strip() not in ("and", "or") else p for p in parts)


def _validate(tree: ast.AST) -> None:
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise RuleError(f"disallowed syntax in rule: {type(node).__name__}")
        if isinstance(node, ast.Call) and not isinstance(node.func, ast.Name):
            raise RuleError("only plain function calls are allowed in rules")


class _Env(dict):
    def __missing__(self, key):
        raise RuleError(f"unknown name '{key}' in rule")


class Rule:
    """Compiled rule, reusable across candles."""

    def __init__(self, text: str):
        self.text = text.strip()
        if not self.text:
            raise RuleError("empty rule")
        rewritten = _rewrite_infix(self.text)
        try:
            self._tree = ast.parse(rewritten, mode="eval")
        except SyntaxError as e:
            raise RuleError(f"cannot parse rule '{text}': {e}") from e
        _validate(self._tree)
        self._code = compile(self._tree, "<rule>", "eval")

    def evaluate(self, df: pd.DataFrame) -> bool:
        """Evaluate against the latest closed candle of `df` (OHLCV, DatetimeIndex)."""
        if len(df) < 2:
            return False

        def make_ind(name: str):
            fn = REGISTRY[name]

            def call(*args, **kwargs):
                return Val.of(fn(df, *args, **kwargs))

            return call

        env = _Env({
            "crosses_above": crosses_above,
            "crosses_below": crosses_below,
            "abs": abs, "min": min, "max": max,
        })
        for name in REGISTRY:
            env[name] = make_ind(name)
        for col in ("open", "high", "low", "close", "volume"):
            env[col] = Val.of(df[col])

        result = eval(self._code, {"__builtins__": {}}, env)  # noqa: S307 - AST whitelisted above
        return bool(result)


def compile_rule(text: str) -> Rule | None:
    text = (text or "").strip()
    return Rule(text) if text else None
