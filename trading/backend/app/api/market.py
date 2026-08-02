"""Market data + backtesting endpoints."""
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..backtest.engine import Backtester
from ..db import get_db
from ..engine.rules import RuleError, compile_rule
from ..engine.runtime import runtime
from ..models import BacktestRun
from ..schemas import BacktestRequest

router = APIRouter(prefix="/api", tags=["market"])

NIFTY50_SAMPLE = [
    "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "SBIN", "LICI",
    "ITC", "HINDUNILVR", "LT", "BAJFINANCE", "MARUTI", "SUNPHARMA", "KOTAKBANK",
    "AXISBANK", "TITAN", "ULTRACEMCO", "ASIANPAINT", "NTPC",
]


@router.get("/symbols")
def symbols():
    """A convenient liquid-largecap starter universe (full search needs a Kite session)."""
    return {"symbols": NIFTY50_SAMPLE}


@router.get("/candles/{symbol}")
def candles(symbol: str, timeframe: str = "5minute", lookback: int = 100):
    df = runtime.feed.candles(symbol.upper(), timeframe, min(lookback, 1000))
    return {
        "symbol": symbol.upper(),
        "timeframe": timeframe,
        "candles": [
            {"at": str(ts), "open": r["open"], "high": r["high"], "low": r["low"],
             "close": r["close"], "volume": r["volume"]}
            for ts, r in df.iterrows()
        ],
    }


@router.get("/ltp/{symbol}")
def ltp(symbol: str):
    return {"symbol": symbol.upper(), "ltp": runtime.feed.ltp(symbol.upper())}


@router.post("/rules/validate")
def validate_rule(body: dict):
    """Check a declarative rule string; returns ok or the parse error."""
    try:
        rule = compile_rule(body.get("rule", ""))
    except RuleError as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "normalized": rule.text if rule else ""}


@router.post("/backtest")
async def run_backtest(body: BacktestRequest, db: Session = Depends(get_db)):
    try:
        bt = Backtester(body.strategy_type, body.config, body.from_date, body.to_date,
                        body.starting_cash)
        result = await asyncio.to_thread(bt.run)
    except ValueError as e:
        raise HTTPException(400, str(e))
    run = BacktestRun(
        strategy_type=body.strategy_type, config=body.config.model_dump(),
        from_date=body.from_date, to_date=body.to_date,
        stats=result["stats"], equity_curve=result["equity_curve"],
        trades=result["trades"], finished=True,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return {"id": run.id, **result}


@router.get("/backtest/runs")
def backtest_runs(db: Session = Depends(get_db)):
    rows = db.execute(select(BacktestRun).order_by(BacktestRun.id.desc()).limit(50)).scalars().all()
    return [{"id": r.id, "strategy_type": r.strategy_type, "from_date": r.from_date,
             "to_date": r.to_date, "stats": r.stats, "created_at": r.created_at} for r in rows]


@router.get("/backtest/runs/{run_id}")
def backtest_run(run_id: int, db: Session = Depends(get_db)):
    r = db.get(BacktestRun, run_id)
    if r is None:
        raise HTTPException(404, "backtest run not found")
    return {"id": r.id, "strategy_type": r.strategy_type, "config": r.config,
            "from_date": r.from_date, "to_date": r.to_date, "stats": r.stats,
            "equity_curve": r.equity_curve, "trades": r.trades}
