"""Broker interface. Strategies never talk to Kite or the paper simulator directly —
they emit OrderRequests through this interface, so switching a strategy between
paper and live requires zero strategy changes.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class OrderRequest:
    symbol: str
    transaction_type: str            # BUY | SELL
    quantity: int
    exchange: str = "NSE"
    order_type: str = "MARKET"       # MARKET | LIMIT | SL | SL-M
    product: str = "MIS"             # MIS | CNC | NRML
    price: float = 0.0               # for LIMIT
    trigger_price: float = 0.0       # for SL / SL-M
    variety: str = "regular"
    tag: str = ""


@dataclass
class OrderResult:
    ok: bool
    broker_order_id: str = ""
    status: str = ""                 # COMPLETE | OPEN | REJECTED ...
    average_price: float = 0.0
    filled_quantity: int = 0
    message: str = ""
    charges: float = 0.0


@dataclass
class BrokerPosition:
    symbol: str
    quantity: int                    # signed
    average_price: float
    last_price: float = 0.0
    product: str = "MIS"
    pnl: float = 0.0
    extras: dict = field(default_factory=dict)


class Broker(ABC):
    mode: str = "paper"

    @abstractmethod
    def place_order(self, req: OrderRequest) -> OrderResult: ...

    @abstractmethod
    def cancel_order(self, broker_order_id: str, variety: str = "regular") -> bool: ...

    @abstractmethod
    def positions(self) -> list[BrokerPosition]: ...

    @abstractmethod
    def quote(self, symbol: str, exchange: str = "NSE") -> float:
        """Last traded price."""

    @abstractmethod
    def margins(self) -> dict:
        """Available cash / margin info."""


def zerodha_charges(price: float, quantity: int, is_buy: bool, product: str) -> float:
    """Estimated all-in cost of one executed equity order on Zerodha (INR).

    Intraday (MIS): brokerage min(0.03% of turnover, ₹20); STT 0.025% on sell side.
    Delivery (CNC): zero brokerage; STT 0.1% both sides.
    Plus exchange txn charge ~0.00297% (NSE), SEBI ₹10/crore, stamp duty on buys,
    GST 18% on brokerage + txn charges.
    """
    turnover = price * quantity
    if product == "MIS":
        brokerage = min(turnover * 0.0003, 20.0)
        stt = turnover * 0.00025 if not is_buy else 0.0
        stamp = turnover * 0.00003 if is_buy else 0.0
    else:  # CNC / NRML equity approximation
        brokerage = 0.0
        stt = turnover * 0.001
        stamp = turnover * 0.00015 if is_buy else 0.0
    exch = turnover * 0.0000297
    sebi = turnover * 0.000001
    gst = 0.18 * (brokerage + exch + sebi)
    return round(brokerage + stt + stamp + exch + sebi + gst, 2)
