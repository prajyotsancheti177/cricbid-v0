"""Indicator library: pure functions over OHLCV DataFrames, exposed through a registry
so declarative rule strings (e.g. "ema(21)") and custom user indicators resolve by name.

Every indicator takes the candle DataFrame (columns: open, high, low, close, volume,
DatetimeIndex) first, then its own parameters, and returns a pandas Series aligned to it.
Register your own with @indicator("myname") from a user strategy file.
"""
from typing import Callable

import numpy as np
import pandas as pd

REGISTRY: dict[str, Callable] = {}


def indicator(name: str):
    def wrap(fn: Callable) -> Callable:
        REGISTRY[name] = fn
        return fn

    return wrap


@indicator("close")
def close(df: pd.DataFrame) -> pd.Series:
    return df["close"]


@indicator("open")
def open_(df: pd.DataFrame) -> pd.Series:
    return df["open"]


@indicator("high")
def high(df: pd.DataFrame) -> pd.Series:
    return df["high"]


@indicator("low")
def low(df: pd.DataFrame) -> pd.Series:
    return df["low"]


@indicator("volume")
def volume(df: pd.DataFrame) -> pd.Series:
    return df["volume"]


@indicator("sma")
def sma(df: pd.DataFrame, period: int = 20, source: str = "close") -> pd.Series:
    return df[source].rolling(period).mean()


@indicator("ema")
def ema(df: pd.DataFrame, period: int = 20, source: str = "close") -> pd.Series:
    return df[source].ewm(span=period, adjust=False).mean()


@indicator("rsi")
def rsi(df: pd.DataFrame, period: int = 14, source: str = "close") -> pd.Series:
    delta = df[source].diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
    rs = gain / loss.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50.0)


@indicator("atr")
def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


@indicator("macd")
def macd(df: pd.DataFrame, fast: int = 12, slow: int = 26) -> pd.Series:
    return ema(df, fast) - ema(df, slow)


@indicator("macd_signal")
def macd_signal(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.Series:
    return macd(df, fast, slow).ewm(span=signal, adjust=False).mean()


@indicator("bb_upper")
def bb_upper(df: pd.DataFrame, period: int = 20, mult: float = 2.0) -> pd.Series:
    mid = sma(df, period)
    return mid + mult * df["close"].rolling(period).std()


@indicator("bb_lower")
def bb_lower(df: pd.DataFrame, period: int = 20, mult: float = 2.0) -> pd.Series:
    mid = sma(df, period)
    return mid - mult * df["close"].rolling(period).std()


@indicator("bb_width")
def bb_width(df: pd.DataFrame, period: int = 20, mult: float = 2.0) -> pd.Series:
    mid = sma(df, period)
    return (bb_upper(df, period, mult) - bb_lower(df, period, mult)) / mid


@indicator("vwap")
def vwap(df: pd.DataFrame) -> pd.Series:
    """Session VWAP: resets each trading day."""
    tp = (df["high"] + df["low"] + df["close"]) / 3
    day = df.index.date
    pv = (tp * df["volume"]).groupby(day).cumsum()
    vv = df["volume"].groupby(day).cumsum().replace(0, np.nan)
    return (pv / vv).fillna(tp)


@indicator("supertrend")
def supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> pd.Series:
    """Supertrend line. Price above it = uptrend, below = downtrend."""
    hl2 = (df["high"] + df["low"]) / 2
    a = atr(df, period)
    upper = (hl2 + multiplier * a).to_numpy()
    lower = (hl2 - multiplier * a).to_numpy()
    close_arr = df["close"].to_numpy()
    n = len(df)
    st = np.full(n, np.nan)
    trend_up = True
    fub, flb = upper[0], lower[0]  # final upper/lower bands
    for i in range(1, n):
        fub = upper[i] if (upper[i] < fub or close_arr[i - 1] > fub) else fub
        flb = lower[i] if (lower[i] > flb or close_arr[i - 1] < flb) else flb
        if trend_up and close_arr[i] < flb:
            trend_up = False
        elif not trend_up and close_arr[i] > fub:
            trend_up = True
        st[i] = flb if trend_up else fub
    return pd.Series(st, index=df.index)


@indicator("supertrend_dir")
def supertrend_dir(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> pd.Series:
    """+1 when close is above the supertrend line, -1 below."""
    st = supertrend(df, period, multiplier)
    return pd.Series(np.where(df["close"] > st, 1.0, -1.0), index=df.index)


@indicator("stoch_k")
def stoch_k(df: pd.DataFrame, period: int = 14, smooth: int = 3) -> pd.Series:
    ll = df["low"].rolling(period).min()
    hh = df["high"].rolling(period).max()
    k = 100 * (df["close"] - ll) / (hh - ll).replace(0, np.nan)
    return k.rolling(smooth).mean()


@indicator("roc")
def roc(df: pd.DataFrame, period: int = 10, source: str = "close") -> pd.Series:
    return df[source].pct_change(period) * 100


@indicator("hhv")
def hhv(df: pd.DataFrame, period: int = 20, source: str = "high") -> pd.Series:
    return df[source].rolling(period).max()


@indicator("llv")
def llv(df: pd.DataFrame, period: int = 20, source: str = "low") -> pd.Series:
    return df[source].rolling(period).min()


def list_indicators() -> list[str]:
    return sorted(REGISTRY.keys())
