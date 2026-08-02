"""Global runtime: owns the Kite session, chooses the data feed, and builds brokers.

- No Kite access token -> SimFeed (synthetic but consistent prices) so paper trading
  and the whole UI work with zero credentials.
- With a Kite session -> KiteFeed for data; live strategies get the KiteBroker,
  paper strategies still get a PaperBroker (filled against REAL quotes).
"""
import json
import logging
from typing import Optional

from ..brokers.kite import KiteBroker
from ..brokers.paper import PaperBroker
from ..config import settings
from ..data.feed import Feed, KiteFeed, SimFeed
from ..db import SessionLocal
from ..models import AppSetting

log = logging.getLogger(__name__)

KITE_TOKEN_KEY = "kite_access_token"


class Runtime:
    def __init__(self):
        self._kite: Optional[KiteBroker] = None
        self._sim_feed = SimFeed()
        self._kite_feed: Optional[KiteFeed] = None

    # ------------------------------------------------------------------ kite session
    def load_kite_session(self) -> bool:
        """(Re)build the Kite broker from the stored access token. Returns success."""
        if not settings.kite_api_key:
            return False
        with SessionLocal() as db:
            row = db.get(AppSetting, KITE_TOKEN_KEY)
        token = row.value if row else ""
        if not token:
            return False
        try:
            self._kite = KiteBroker(settings.kite_api_key, token)
            self._kite.margins()  # probe: raises/errors if the token is stale
            self._kite_feed = KiteFeed(self._kite)
            log.info("kite session active")
            return True
        except Exception:
            log.exception("kite session invalid; falling back to simulation feed")
            self._kite = None
            self._kite_feed = None
            return False

    def set_kite_token(self, access_token: str) -> bool:
        with SessionLocal() as db:
            row = db.get(AppSetting, KITE_TOKEN_KEY) or AppSetting(key=KITE_TOKEN_KEY)
            row.value = access_token
            db.merge(row)
            db.commit()
        return self.load_kite_session()

    @property
    def kite(self) -> Optional[KiteBroker]:
        return self._kite

    @property
    def kite_connected(self) -> bool:
        return self._kite is not None

    # ------------------------------------------------------------------ feed / brokers
    @property
    def feed(self) -> Feed:
        return self._kite_feed if self._kite_feed is not None else self._sim_feed

    def make_paper_broker(self, strategy_id: int, slippage_pct: Optional[float] = None) -> PaperBroker:
        broker = PaperBroker(
            price_provider=lambda sym, exch="NSE": self.feed.ltp(sym, exch),
            starting_cash=settings.paper_starting_cash,
            slippage_pct=slippage_pct if slippage_pct is not None else settings.paper_slippage_pct,
        )
        snap = self._load_paper_state(strategy_id)
        if snap:
            broker.restore(snap)
        return broker

    def _paper_state_key(self, strategy_id: int) -> str:
        return f"paper_state_{strategy_id}"

    def _load_paper_state(self, strategy_id: int) -> dict:
        with SessionLocal() as db:
            row = db.get(AppSetting, self._paper_state_key(strategy_id))
        if row and row.value:
            try:
                return json.loads(row.value)
            except json.JSONDecodeError:
                pass
        return {}

    def save_paper_state(self, strategy_id: int, broker: PaperBroker) -> None:
        with SessionLocal() as db:
            key = self._paper_state_key(strategy_id)
            row = db.get(AppSetting, key) or AppSetting(key=key)
            row.value = json.dumps(broker.snapshot())
            db.merge(row)
            db.commit()

    def reset_paper_state(self, strategy_id: int) -> None:
        with SessionLocal() as db:
            row = db.get(AppSetting, self._paper_state_key(strategy_id))
            if row:
                db.delete(row)
                db.commit()


runtime = Runtime()
