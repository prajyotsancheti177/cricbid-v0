"""Strategy framework.

A strategy type is a subclass of `Strategy` registered under a unique `key`.
Strategies only *emit intents* (ctx.enter_long / ctx.enter_short / ctx.exit);
sizing, risk checks, stop-losses and order execution are applied by the engine
from the instance config — so every strategy is automatically customizable at
the universe/timeframe/filter/sizing/risk/execution levels without any code.

`param_schema` describes the strategy-specific knobs; the frontend renders a
config form from it. Users add their own strategies by dropping a .py file in
trading/backend/strategies_user/ defining a Strategy subclass — it is
auto-discovered at startup and appears in the UI like any built-in.
"""
import importlib
import importlib.util
import logging
import pkgutil
import sys
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

REGISTRY: dict[str, type["Strategy"]] = {}


class StrategyContext:
    """What a strategy sees at runtime. Implemented by the engine (live/paper) and the backtester."""

    params: dict

    def position(self, symbol: str) -> int:
        """Signed open quantity for this strategy instance in `symbol` (0 = flat)."""
        raise NotImplementedError

    def enter_long(self, symbol: str, reason: str = "") -> None: ...
    def enter_short(self, symbol: str, reason: str = "") -> None: ...
    def exit(self, symbol: str, reason: str = "") -> None: ...
    def log(self, message: str, level: str = "INFO") -> None: ...

    # free-form per-instance scratch state that survives across candles
    state: dict


class Strategy:
    key: str = ""
    name: str = ""
    description: str = ""
    # each entry: {"name","type"("int"|"float"|"str"|"bool"|"choice"),"default",
    #              "min","max","options","description"}
    param_schema: list[dict] = []

    @classmethod
    def default_params(cls) -> dict:
        return {p["name"]: p["default"] for p in cls.param_schema}

    def __init__(self, params: dict | None = None):
        self.params = {**self.default_params(), **(params or {})}

    # lifecycle -----------------------------------------------------------
    def on_start(self, ctx: StrategyContext) -> None: ...

    def on_candle(self, ctx: StrategyContext, symbol: str, df: pd.DataFrame) -> None:
        """Called on every closed candle of the configured timeframe, per symbol,
        with `df` = the last `lookback_candles` OHLCV bars (latest bar last)."""

    def on_stop(self, ctx: StrategyContext) -> None: ...


def register(cls: type[Strategy]) -> type[Strategy]:
    if not cls.key:
        raise ValueError(f"{cls.__name__} needs a non-empty `key`")
    if cls.key in REGISTRY and REGISTRY[cls.key] is not cls:
        log.warning("strategy key %s re-registered by %s", cls.key, cls.__name__)
    REGISTRY[cls.key] = cls
    return cls


def discover() -> None:
    """Import built-in strategies and any user plugins in strategies_user/."""
    from . import builtin

    for mod in pkgutil.iter_modules(builtin.__path__):
        importlib.import_module(f"{builtin.__name__}.{mod.name}")

    user_dir = Path(__file__).resolve().parent.parent.parent / "strategies_user"
    if user_dir.is_dir():
        for py in sorted(user_dir.glob("*.py")):
            mod_name = f"strategies_user.{py.stem}"
            try:
                spec = importlib.util.spec_from_file_location(mod_name, py)
                module = importlib.util.module_from_spec(spec)
                sys.modules[mod_name] = module
                spec.loader.exec_module(module)
                log.info("loaded user strategy module %s", py.name)
            except Exception:
                log.exception("failed to load user strategy %s", py)


def strategy_types() -> list[dict]:
    return [
        {
            "key": cls.key,
            "name": cls.name or cls.key,
            "description": cls.description,
            "param_schema": cls.param_schema,
            "default_params": cls.default_params(),
        }
        for cls in sorted(REGISTRY.values(), key=lambda c: c.key)
    ]
