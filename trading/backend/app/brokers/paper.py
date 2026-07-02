"""Paper broker: simulates fills against real (or simulated) quotes with configurable
slippage and Zerodha's real cost model, tracking virtual cash and positions in memory.
The engine persists resulting orders/trades/positions to the DB, so paper state
survives restarts via the persistence layer.
"""
import itertools
import threading
from typing import Callable

from .base import Broker, BrokerPosition, OrderRequest, OrderResult, zerodha_charges

_ids = itertools.count(1)


class PaperBroker(Broker):
    mode = "paper"

    def __init__(self, price_provider: Callable[[str, str], float],
                 starting_cash: float = 1_000_000.0, slippage_pct: float = 0.02):
        self._price = price_provider
        self.cash = starting_cash
        self.starting_cash = starting_cash
        self.slippage_pct = slippage_pct
        self._positions: dict[tuple[str, str], BrokerPosition] = {}  # (symbol, product)
        self._lock = threading.Lock()
        self.realized_pnl = 0.0
        self.total_charges = 0.0

    # ------------------------------------------------------------------ orders
    def place_order(self, req: OrderRequest) -> OrderResult:
        ltp = self._price(req.symbol, req.exchange)
        if ltp <= 0:
            return OrderResult(ok=False, status="REJECTED", message=f"no quote for {req.symbol}")

        slip = ltp * self.slippage_pct / 100.0
        if req.order_type == "LIMIT" and req.price > 0:
            # fill only if the limit is marketable against the current quote
            if req.transaction_type == "BUY" and req.price < ltp:
                return OrderResult(ok=False, status="REJECTED",
                                   message="limit not marketable (paper broker fills immediately or rejects)")
            if req.transaction_type == "SELL" and req.price > ltp:
                return OrderResult(ok=False, status="REJECTED",
                                   message="limit not marketable (paper broker fills immediately or rejects)")
            fill_price = req.price
        else:
            fill_price = ltp + slip if req.transaction_type == "BUY" else ltp - slip
        fill_price = round(fill_price, 2)

        charges = zerodha_charges(fill_price, req.quantity, req.transaction_type == "BUY", req.product)
        notional = fill_price * req.quantity

        with self._lock:
            key = (req.symbol, req.product)
            pos = self._positions.get(key)
            signed = req.quantity if req.transaction_type == "BUY" else -req.quantity

            # cash check only when increasing exposure (closing always allowed)
            increasing = pos is None or pos.quantity == 0 or (pos.quantity > 0) == (signed > 0)
            if increasing and req.transaction_type == "BUY" and notional + charges > self.cash:
                return OrderResult(ok=False, status="REJECTED",
                                   message=f"insufficient paper cash ({self.cash:.0f} < {notional:.0f})")

            if pos is None:
                pos = BrokerPosition(symbol=req.symbol, quantity=0, average_price=0.0, product=req.product)
                self._positions[key] = pos

            old_qty, old_avg = pos.quantity, pos.average_price
            new_qty = old_qty + signed
            if old_qty != 0 and (old_qty > 0) != (new_qty > 0) and new_qty != 0:
                # crossing through zero: realize on the closed part, re-open remainder at fill
                direction = 1 if old_qty > 0 else -1
                self.realized_pnl += (fill_price - old_avg) * direction * abs(old_qty)
                pos.average_price = fill_price
            elif old_qty != 0 and abs(new_qty) < abs(old_qty):
                # partial/full close: realize P&L, avg unchanged
                closed = abs(old_qty) - abs(new_qty)
                direction = 1 if old_qty > 0 else -1
                self.realized_pnl += (fill_price - old_avg) * direction * closed
            elif new_qty != 0:
                # adding to (or opening) a position: weighted average
                pos.average_price = (abs(old_qty) * old_avg + abs(signed) * fill_price) / abs(new_qty)

            pos.quantity = new_qty
            pos.last_price = ltp
            if new_qty == 0:
                pos.average_price = 0.0

            # cash: buys consume, sells release; charges always consume
            self.cash += -notional - charges if req.transaction_type == "BUY" else notional - charges
            self.realized_pnl -= 0  # charges tracked separately for transparency
            self.total_charges += charges

        return OrderResult(
            ok=True,
            broker_order_id=f"PAPER-{next(_ids)}",
            status="COMPLETE",
            average_price=fill_price,
            filled_quantity=req.quantity,
            charges=charges,
        )

    def cancel_order(self, broker_order_id: str, variety: str = "regular") -> bool:
        return True  # paper orders fill or reject synchronously; nothing to cancel

    # ------------------------------------------------------------------ account
    def positions(self) -> list[BrokerPosition]:
        with self._lock:
            out = []
            for pos in self._positions.values():
                if pos.quantity == 0:
                    continue
                ltp = self._price(pos.symbol, "NSE") or pos.last_price
                pos.last_price = ltp
                pos.pnl = (ltp - pos.average_price) * pos.quantity
                out.append(pos)
            return out

    def quote(self, symbol: str, exchange: str = "NSE") -> float:
        return self._price(symbol, exchange)

    def margins(self) -> dict:
        unrealized = sum(p.pnl for p in self.positions())
        return {
            "mode": "paper",
            "cash": round(self.cash, 2),
            "starting_cash": self.starting_cash,
            "realized_pnl": round(self.realized_pnl, 2),
            "unrealized_pnl": round(unrealized, 2),
            "total_charges": round(self.total_charges, 2),
            "equity": round(self.cash + sum(p.last_price * p.quantity for p in self.positions()), 2),
        }

    # ------------------------------------------------------------------ persistence hooks
    def snapshot(self) -> dict:
        with self._lock:
            return {
                "cash": self.cash,
                "starting_cash": self.starting_cash,
                "realized_pnl": self.realized_pnl,
                "total_charges": self.total_charges,
                "positions": [
                    {"symbol": p.symbol, "product": p.product, "quantity": p.quantity,
                     "average_price": p.average_price}
                    for p in self._positions.values() if p.quantity != 0
                ],
            }

    def restore(self, snap: dict) -> None:
        with self._lock:
            self.cash = snap.get("cash", self.cash)
            self.starting_cash = snap.get("starting_cash", self.starting_cash)
            self.realized_pnl = snap.get("realized_pnl", 0.0)
            self.total_charges = snap.get("total_charges", 0.0)
            self._positions = {
                (p["symbol"], p["product"]): BrokerPosition(
                    symbol=p["symbol"], quantity=p["quantity"],
                    average_price=p["average_price"], product=p["product"])
                for p in snap.get("positions", [])
            }
