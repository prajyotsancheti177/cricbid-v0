"""Market data feeds.

- KiteFeed: real candles/quotes via Kite Connect (requires daily login).
- SimFeed: deterministic synthetic random-walk data so the whole app (paper trading,
  backtests, frontend) works with zero credentials. Each symbol gets a stable seed,
  so prices are consistent across restarts and between candle history and quotes.

The engine picks KiteFeed automatically once a Kite session exists, else SimFeed.
"""
import hashlib
import math
import threading
import time
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

INTERVAL_MINUTES = {
    "minute": 1, "3minute": 3, "5minute": 5, "10minute": 10,
    "15minute": 15, "30minute": 30, "60minute": 60, "day": 375,
}


class Feed:
    """Interface: candles(symbol, timeframe, lookback) and ltp(symbol)."""

    name = "base"

    def candles(self, symbol: str, timeframe: str, lookback: int, exchange: str = "NSE") -> pd.DataFrame:
        raise NotImplementedError

    def ltp(self, symbol: str, exchange: str = "NSE") -> float:
        raise NotImplementedError


# --------------------------------------------------------------------------- simulated
def _seed_for(symbol: str) -> int:
    return int(hashlib.sha256(symbol.encode()).hexdigest()[:8], 16)


def _base_price(symbol: str) -> float:
    return 100 + (_seed_for(symbol) % 3900)  # 100..4000, stable per symbol


class SimFeed(Feed):
    """Geometric random walk with intraday session structure (9:15–15:30 IST).
    Deterministic per (symbol, minute) so candles and quotes agree."""

    name = "sim"

    def __init__(self, daily_vol: float = 0.015):
        self.daily_vol = daily_vol
        self._cache: dict[str, pd.DataFrame] = {}
        self._lock = threading.Lock()

    def _minute_series(self, symbol: str, minutes: int) -> pd.DataFrame:
        """Generate the last `minutes` of 1-min candles ending at the current minute."""
        end = pd.Timestamp.now().floor("min")
        idx = pd.date_range(end=end, periods=minutes, freq="1min")
        rng = np.random.default_rng(_seed_for(symbol))
        # generate a long stable path and window the tail so history doesn't shift
        total = minutes + 10_000
        step_vol = self.daily_vol / math.sqrt(375)
        rets = rng.normal(0, step_vol, total)
        # deterministic offset from epoch minute keeps the walk advancing in real time
        epoch_min = int(end.timestamp() // 60)
        start_off = epoch_min % 10_000
        path = _base_price(symbol) * np.exp(np.cumsum(rets))[start_off:start_off + minutes]
        if len(path) < minutes:  # wrap-around safety
            path = np.pad(path, (minutes - len(path), 0), mode="edge")
        close = pd.Series(path, index=idx)
        spread = close * step_vol
        df = pd.DataFrame({
            "open": close.shift(1).fillna(close.iloc[0]),
            "high": close + spread.abs(),
            "low": close - spread.abs(),
            "close": close,
            "volume": (rng.integers(5_000, 200_000, minutes)).astype(float),
        })
        df["high"] = df[["open", "close", "high"]].max(axis=1)
        df["low"] = df[["open", "close", "low"]].min(axis=1)
        return df.round(2)

    def candles(self, symbol: str, timeframe: str, lookback: int, exchange: str = "NSE") -> pd.DataFrame:
        step = INTERVAL_MINUTES.get(timeframe, 5)
        minutes = lookback * step + step
        df = self._minute_series(symbol, minutes)
        if step == 1:
            return df.tail(lookback)
        agg = df.resample(f"{step}min").agg(
            {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
        ).dropna()
        return agg.tail(lookback)

    def ltp(self, symbol: str, exchange: str = "NSE") -> float:
        return float(self._minute_series(symbol, 2)["close"].iloc[-1])

    def historical(self, symbol: str, from_date: str, to_date: str, timeframe: str) -> pd.DataFrame:
        """Deterministic history for backtests: one session per weekday, minute bars resampled."""
        start = pd.Timestamp(from_date)
        end = pd.Timestamp(to_date)
        days = pd.bdate_range(start, end)
        rng = np.random.default_rng(_seed_for(symbol) ^ 0xBACC)
        step_vol = self.daily_vol / math.sqrt(375)
        frames = []
        price = _base_price(symbol)
        for day in days:
            idx = pd.date_range(day + timedelta(hours=9, minutes=15), periods=375, freq="1min")
            rets = rng.normal(0.00001, step_vol, 375)
            closes = price * np.exp(np.cumsum(rets))
            price = float(closes[-1])
            close = pd.Series(closes, index=idx)
            spread = close * step_vol
            df = pd.DataFrame({
                "open": close.shift(1).fillna(close.iloc[0]),
                "high": (close + spread.abs()),
                "low": (close - spread.abs()),
                "close": close,
                "volume": rng.integers(5_000, 200_000, 375).astype(float),
            })
            frames.append(df)
        out = pd.concat(frames)
        out["high"] = out[["open", "close", "high"]].max(axis=1)
        out["low"] = out[["open", "close", "low"]].min(axis=1)
        step = INTERVAL_MINUTES.get(timeframe, 5)
        if step > 1 and timeframe != "day":
            out = out.resample(f"{step}min").agg(
                {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
            ).dropna()
        elif timeframe == "day":
            out = out.resample("1D").agg(
                {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
            ).dropna()
        return out.round(2)


# --------------------------------------------------------------------------- kite
class KiteFeed(Feed):
    name = "kite"

    def __init__(self, kite_broker):
        self.broker = kite_broker
        self._tokens: dict[str, int] = {}
        self._token_lock = threading.Lock()
        self._last_hist_call = 0.0

    def _instrument_token(self, symbol: str, exchange: str = "NSE") -> int:
        with self._token_lock:
            if not self._tokens:
                for inst in self.broker.instruments(exchange):
                    self._tokens[inst["tradingsymbol"]] = inst["instrument_token"]
            token = self._tokens.get(symbol)
        if token is None:
            raise ValueError(f"unknown instrument {exchange}:{symbol}")
        return token

    def _hist_throttle(self):
        # historical API: 3 req/s allowed; stay conservative at ~2/s
        now = time.monotonic()
        wait = self._last_hist_call + 0.5 - now
        if wait > 0:
            time.sleep(wait)
        self._last_hist_call = time.monotonic()

    def candles(self, symbol: str, timeframe: str, lookback: int, exchange: str = "NSE") -> pd.DataFrame:
        token = self._instrument_token(symbol, exchange)
        step = INTERVAL_MINUTES.get(timeframe, 5)
        # fetch enough calendar days to cover `lookback` bars (375 trading min/day)
        days = max(2, int(lookback * step / 375 * 2) + 3)
        self._hist_throttle()
        raw = self.broker.historical(
            token, datetime.now() - timedelta(days=days), datetime.now(), timeframe
        )
        if not raw:
            return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
        df = pd.DataFrame(raw).set_index("date")[["open", "high", "low", "close", "volume"]]
        df.index = pd.DatetimeIndex(df.index).tz_localize(None)
        return df.tail(lookback)

    def ltp(self, symbol: str, exchange: str = "NSE") -> float:
        return self.broker.quote(symbol, exchange)

    def historical(self, symbol: str, from_date: str, to_date: str, timeframe: str) -> pd.DataFrame:
        token = self._instrument_token(symbol)
        frames = []
        # respect per-interval max span (e.g. 5minute: 100 days/request)
        span_days = {"minute": 55, "3minute": 90, "5minute": 90, "10minute": 90, "15minute": 180,
                     "30minute": 180, "60minute": 360, "day": 1900}.get(timeframe, 90)
        start = pd.Timestamp(from_date)
        end = pd.Timestamp(to_date)
        cur = start
        while cur <= end:
            chunk_end = min(cur + timedelta(days=span_days), end)
            self._hist_throttle()
            raw = self.broker.historical(token, cur.to_pydatetime(), chunk_end.to_pydatetime(), timeframe)
            if raw:
                frames.append(pd.DataFrame(raw))
            cur = chunk_end + timedelta(days=1)
        if not frames:
            return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
        df = pd.concat(frames).set_index("date")[["open", "high", "low", "close", "volume"]]
        df.index = pd.DatetimeIndex(df.index).tz_localize(None)
        return df[~df.index.duplicated(keep="first")]
