"""ORM models: strategy instances, orders, trades, positions, P&L snapshots, event log, settings."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class StrategyInstance(Base):
    """A configured instance of a strategy type. The full config tree lives in `config` (JSON)."""

    __tablename__ = "strategy_instances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    strategy_type: Mapped[str] = mapped_column(String(80))            # registered strategy class key
    mode: Mapped[str] = mapped_column(String(10), default="paper")    # paper | live
    status: Mapped[str] = mapped_column(String(12), default="stopped")  # stopped|running|paused|error
    config: Mapped[dict] = mapped_column(JSON, default=dict)          # full parameter tree
    config_version: Mapped[int] = mapped_column(Integer, default=1)
    error_message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class ConfigRevision(Base):
    """Every saved edit of a strategy config, for audit/rollback."""

    __tablename__ = "config_revisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_id: Mapped[int] = mapped_column(ForeignKey("strategy_instances.id"))
    version: Mapped[int] = mapped_column(Integer)
    config: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_id: Mapped[int | None] = mapped_column(ForeignKey("strategy_instances.id"), nullable=True)
    broker_order_id: Mapped[str] = mapped_column(String(64), default="")
    mode: Mapped[str] = mapped_column(String(10), default="paper")
    exchange: Mapped[str] = mapped_column(String(8), default="NSE")
    symbol: Mapped[str] = mapped_column(String(32))
    transaction_type: Mapped[str] = mapped_column(String(4))          # BUY | SELL
    quantity: Mapped[int] = mapped_column(Integer)
    filled_quantity: Mapped[int] = mapped_column(Integer, default=0)
    order_type: Mapped[str] = mapped_column(String(8), default="MARKET")  # MARKET|LIMIT|SL|SL-M
    product: Mapped[str] = mapped_column(String(8), default="MIS")    # MIS|CNC|NRML
    price: Mapped[float] = mapped_column(Float, default=0.0)
    trigger_price: Mapped[float] = mapped_column(Float, default=0.0)
    average_price: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(16), default="OPEN")   # OPEN|COMPLETE|CANCELLED|REJECTED
    status_message: Mapped[str] = mapped_column(Text, default="")
    tag: Mapped[str] = mapped_column(String(32), default="")
    placed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Trade(Base):
    """An executed fill (paper fills and live trade postbacks)."""

    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_id: Mapped[int | None] = mapped_column(ForeignKey("strategy_instances.id"), nullable=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True)
    mode: Mapped[str] = mapped_column(String(10), default="paper")
    exchange: Mapped[str] = mapped_column(String(8), default="NSE")
    symbol: Mapped[str] = mapped_column(String(32))
    transaction_type: Mapped[str] = mapped_column(String(4))
    quantity: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)
    charges: Mapped[float] = mapped_column(Float, default=0.0)        # brokerage + taxes estimate
    executed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Position(Base):
    """Open positions, one row per (strategy, symbol, mode)."""

    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_id: Mapped[int | None] = mapped_column(ForeignKey("strategy_instances.id"), nullable=True)
    mode: Mapped[str] = mapped_column(String(10), default="paper")
    exchange: Mapped[str] = mapped_column(String(8), default="NSE")
    symbol: Mapped[str] = mapped_column(String(32))
    product: Mapped[str] = mapped_column(String(8), default="MIS")
    quantity: Mapped[int] = mapped_column(Integer, default=0)         # signed: +long, -short
    average_price: Mapped[float] = mapped_column(Float, default=0.0)
    last_price: Mapped[float] = mapped_column(Float, default=0.0)
    realized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    stop_loss: Mapped[float] = mapped_column(Float, default=0.0)
    take_profit: Mapped[float] = mapped_column(Float, default=0.0)
    trail_anchor: Mapped[float] = mapped_column(Float, default=0.0)   # best price seen, for trailing SL
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PnlSnapshot(Base):
    __tablename__ = "pnl_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_id: Mapped[int | None] = mapped_column(ForeignKey("strategy_instances.id"), nullable=True)
    mode: Mapped[str] = mapped_column(String(10), default="paper")
    equity: Mapped[float] = mapped_column(Float)                      # cash + position value
    realized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class EventLog(Base):
    __tablename__ = "event_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_id: Mapped[int | None] = mapped_column(ForeignKey("strategy_instances.id"), nullable=True)
    level: Mapped[str] = mapped_column(String(8), default="INFO")     # INFO|WARN|ERROR|TRADE
    message: Mapped[str] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AppSetting(Base):
    """Key-value store (kite access token, paper account state, etc.)."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_type: Mapped[str] = mapped_column(String(80))
    config: Mapped[dict] = mapped_column(JSON)
    from_date: Mapped[str] = mapped_column(String(10))
    to_date: Mapped[str] = mapped_column(String(10))
    stats: Mapped[dict] = mapped_column(JSON, default=dict)
    equity_curve: Mapped[list] = mapped_column(JSON, default=list)
    trades: Mapped[list] = mapped_column(JSON, default=list)
    finished: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
