"""Portfolio & activity: positions, orders, trades, P&L history, logs, account summary,
and the global kill switch."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..engine.manager import manager
from ..engine.runtime import runtime
from ..models import EventLog, Order, PnlSnapshot, Position, Trade
from ..schemas import OrderOut, PositionOut, TradeOut

router = APIRouter(prefix="/api", tags=["portfolio"])


@router.get("/positions", response_model=list[PositionOut])
def positions(strategy_id: int | None = None, open_only: bool = True, db: Session = Depends(get_db)):
    q = select(Position).order_by(Position.updated_at.desc())
    if strategy_id is not None:
        q = q.where(Position.strategy_id == strategy_id)
    if open_only:
        q = q.where(Position.quantity != 0)
    return db.execute(q).scalars().all()


@router.get("/orders", response_model=list[OrderOut])
def orders(strategy_id: int | None = None, limit: int = Query(100, le=1000),
           db: Session = Depends(get_db)):
    q = select(Order).order_by(Order.id.desc()).limit(limit)
    if strategy_id is not None:
        q = q.where(Order.strategy_id == strategy_id)
    return db.execute(q).scalars().all()


@router.get("/trades", response_model=list[TradeOut])
def trades(strategy_id: int | None = None, limit: int = Query(100, le=1000),
           db: Session = Depends(get_db)):
    q = select(Trade).order_by(Trade.id.desc()).limit(limit)
    if strategy_id is not None:
        q = q.where(Trade.strategy_id == strategy_id)
    return db.execute(q).scalars().all()


@router.get("/pnl")
def pnl(strategy_id: int | None = None, limit: int = Query(500, le=5000),
        db: Session = Depends(get_db)):
    q = select(PnlSnapshot).order_by(PnlSnapshot.id.desc()).limit(limit)
    if strategy_id is not None:
        q = q.where(PnlSnapshot.strategy_id == strategy_id)
    rows = db.execute(q).scalars().all()
    return [
        {"at": r.at, "strategy_id": r.strategy_id, "mode": r.mode, "equity": r.equity,
         "realized_pnl": r.realized_pnl, "unrealized_pnl": r.unrealized_pnl}
        for r in reversed(rows)
    ]


@router.get("/logs")
def logs(strategy_id: int | None = None, level: str | None = None,
         limit: int = Query(200, le=2000), db: Session = Depends(get_db)):
    q = select(EventLog).order_by(EventLog.id.desc()).limit(limit)
    if strategy_id is not None:
        q = q.where(EventLog.strategy_id == strategy_id)
    if level:
        q = q.where(EventLog.level == level)
    rows = db.execute(q).scalars().all()
    return [{"id": r.id, "at": r.at, "strategy_id": r.strategy_id,
             "level": r.level, "message": r.message} for r in rows]


@router.get("/account")
def account():
    """Account summary: live margins when connected, plus per-runner paper accounts."""
    out = {
        "feed": runtime.feed.name,
        "kite_connected": runtime.kite_connected,
        "live_trading_enabled": settings.live_trading_enabled,
        "paper_accounts": {},
        "live": None,
    }
    for sid, runner in manager.runners.items():
        if runner.mode == "paper":
            out["paper_accounts"][sid] = runner.broker.margins()
    if runtime.kite_connected:
        out["live"] = runtime.kite.margins()
    return out


@router.post("/kill-switch")
async def kill_switch():
    """Emergency: flatten all positions and stop every running strategy."""
    halted = await manager.kill_switch()
    return {"halted_strategies": halted}
