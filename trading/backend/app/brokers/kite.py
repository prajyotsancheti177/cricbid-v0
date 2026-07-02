"""Live broker backed by Zerodha Kite Connect (pykiteconnect).

Auth flow: Kite access tokens expire daily. /api/auth/kite/login-url gives the login
link; after login Zerodha redirects with a request_token which /api/auth/kite/callback
exchanges for an access_token stored in app_settings.
"""
import logging
import threading
import time

from .base import Broker, BrokerPosition, OrderRequest, OrderResult

log = logging.getLogger(__name__)

try:
    from kiteconnect import KiteConnect
except ImportError:  # kiteconnect optional in dev environments
    KiteConnect = None


class KiteBroker(Broker):
    mode = "live"

    def __init__(self, api_key: str, access_token: str):
        if KiteConnect is None:
            raise RuntimeError("kiteconnect is not installed (pip install kiteconnect)")
        self.kite = KiteConnect(api_key=api_key)
        self.kite.set_access_token(access_token)
        self._lock = threading.Lock()
        self._last_order_ts = 0.0

    def _throttle(self, min_gap: float = 0.35):
        """Kite allows ~3 order calls/sec; keep a conservative gap."""
        now = time.monotonic()
        wait = self._last_order_ts + min_gap - now
        if wait > 0:
            time.sleep(wait)
        self._last_order_ts = time.monotonic()

    def place_order(self, req: OrderRequest) -> OrderResult:
        with self._lock:
            self._throttle()
            try:
                kwargs = dict(
                    variety=req.variety,
                    exchange=req.exchange,
                    tradingsymbol=req.symbol,
                    transaction_type=req.transaction_type,
                    quantity=req.quantity,
                    product=req.product,
                    order_type=req.order_type,
                    tag=(req.tag or "autotrader")[:20],
                )
                if req.order_type == "LIMIT":
                    kwargs["price"] = req.price
                if req.order_type in ("SL", "SL-M"):
                    kwargs["trigger_price"] = req.trigger_price
                    if req.order_type == "SL":
                        kwargs["price"] = req.price
                order_id = self.kite.place_order(**kwargs)
                return OrderResult(ok=True, broker_order_id=str(order_id), status="OPEN")
            except Exception as e:  # kiteconnect raises typed exceptions; report all
                log.exception("kite place_order failed")
                return OrderResult(ok=False, status="REJECTED", message=str(e))

    def cancel_order(self, broker_order_id: str, variety: str = "regular") -> bool:
        try:
            self.kite.cancel_order(variety=variety, order_id=broker_order_id)
            return True
        except Exception:
            log.exception("kite cancel_order failed")
            return False

    def order_status(self, broker_order_id: str) -> dict:
        try:
            history = self.kite.order_history(order_id=broker_order_id)
            return history[-1] if history else {}
        except Exception:
            log.exception("kite order_history failed")
            return {}

    def positions(self) -> list[BrokerPosition]:
        try:
            net = self.kite.positions().get("net", [])
        except Exception:
            log.exception("kite positions failed")
            return []
        return [
            BrokerPosition(
                symbol=p["tradingsymbol"], quantity=p["quantity"],
                average_price=p["average_price"], last_price=p.get("last_price", 0.0),
                product=p.get("product", "MIS"), pnl=p.get("pnl", 0.0), extras=p,
            )
            for p in net if p["quantity"] != 0
        ]

    def quote(self, symbol: str, exchange: str = "NSE") -> float:
        try:
            key = f"{exchange}:{symbol}"
            return float(self.kite.ltp([key])[key]["last_price"])
        except Exception:
            log.exception("kite ltp failed for %s", symbol)
            return 0.0

    def ltp_bulk(self, symbols: list[str], exchange: str = "NSE") -> dict[str, float]:
        keys = [f"{exchange}:{s}" for s in symbols]
        try:
            data = self.kite.ltp(keys)
            return {k.split(":", 1)[1]: float(v["last_price"]) for k, v in data.items()}
        except Exception:
            log.exception("kite bulk ltp failed")
            return {}

    def margins(self) -> dict:
        try:
            m = self.kite.margins()
            eq = m.get("equity", {})
            return {
                "mode": "live",
                "cash": eq.get("available", {}).get("live_balance", 0.0),
                "net": eq.get("net", 0.0),
                "raw": m,
            }
        except Exception:
            log.exception("kite margins failed")
            return {"mode": "live", "cash": 0.0, "error": "margins fetch failed"}

    def historical(self, instrument_token: int, from_dt, to_dt, interval: str) -> list[dict]:
        # Kite historical API: 1 req/s; caller must respect per-interval date range caps
        return self.kite.historical_data(instrument_token, from_dt, to_dt, interval)

    def instruments(self, exchange: str = "NSE") -> list[dict]:
        return self.kite.instruments(exchange)
