"""Strategy CRUD + lifecycle. Going live is deliberately guarded: mode=live requires
an explicit confirm flag, an active Kite session, and the global live-trading switch."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..engine.manager import manager
from ..indicators import list_indicators
from ..models import ConfigRevision, StrategyInstance
from ..schemas import StrategyCreate, StrategyOut, StrategyUpdate
from ..strategies import REGISTRY, strategy_types

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/strategies", tags=["strategies"])


@router.get("/types")
def get_types():
    return strategy_types()


@router.get("/indicators")
def get_indicators():
    return {"indicators": list_indicators()}


@router.get("", response_model=list[StrategyOut])
def list_strategies(db: Session = Depends(get_db)):
    return db.execute(select(StrategyInstance).order_by(StrategyInstance.id)).scalars().all()


@router.post("", response_model=StrategyOut)
def create_strategy(body: StrategyCreate, db: Session = Depends(get_db)):
    if body.strategy_type not in REGISTRY:
        raise HTTPException(400, f"unknown strategy type '{body.strategy_type}'")
    if db.execute(select(StrategyInstance).where(StrategyInstance.name == body.name)).scalar_one_or_none():
        raise HTTPException(409, f"a strategy named '{body.name}' already exists")
    if body.mode == "live":
        raise HTTPException(400, "create strategies in paper mode; switch to live only after testing")
    # merge strategy-type defaults under the provided params
    cfg = body.config.model_dump()
    cfg["params"] = {**REGISTRY[body.strategy_type].default_params(), **cfg.get("params", {})}
    _validate_params(body.strategy_type, cfg["params"])
    inst = StrategyInstance(name=body.name, strategy_type=body.strategy_type,
                            mode=body.mode, config=cfg)
    db.add(inst)
    db.flush()
    db.add(ConfigRevision(strategy_id=inst.id, version=1, config=cfg))
    db.commit()
    db.refresh(inst)
    return inst


def _get(db: Session, strategy_id: int) -> StrategyInstance:
    inst = db.get(StrategyInstance, strategy_id)
    if inst is None:
        raise HTTPException(404, "strategy not found")
    return inst


def _validate_params(strategy_type: str, params: dict) -> None:
    """Instantiating validates params (e.g. custom_rules compiles its rule strings)."""
    try:
        REGISTRY[strategy_type](params)
    except Exception as e:
        raise HTTPException(400, f"invalid params: {e}")


@router.get("/{strategy_id}", response_model=StrategyOut)
def get_strategy(strategy_id: int, db: Session = Depends(get_db)):
    return _get(db, strategy_id)


@router.put("/{strategy_id}", response_model=StrategyOut)
def update_strategy(strategy_id: int, body: StrategyUpdate,
                    confirm_live: bool = Query(False), db: Session = Depends(get_db)):
    inst = _get(db, strategy_id)
    if manager.is_running(strategy_id) and (body.config is not None or body.mode is not None):
        raise HTTPException(409, "stop the strategy before changing its config or mode")
    if body.name:
        inst.name = body.name
    if body.mode is not None and body.mode != inst.mode:
        if body.mode == "live" and not confirm_live:
            raise HTTPException(400, "switching to LIVE places real orders with real money — "
                                     "retry with ?confirm_live=true to confirm")
        inst.mode = body.mode
    if body.config is not None:
        cfg = body.config.model_dump()
        _validate_params(inst.strategy_type, cfg.get("params", {}))
        inst.config = cfg
        inst.config_version += 1
        db.add(ConfigRevision(strategy_id=inst.id, version=inst.config_version, config=cfg))
    db.commit()
    db.refresh(inst)
    return inst


@router.get("/{strategy_id}/revisions")
def get_revisions(strategy_id: int, db: Session = Depends(get_db)):
    _get(db, strategy_id)
    rows = db.execute(
        select(ConfigRevision).where(ConfigRevision.strategy_id == strategy_id)
        .order_by(ConfigRevision.version.desc())
    ).scalars().all()
    return [{"version": r.version, "config": r.config, "created_at": r.created_at} for r in rows]


@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: int, db: Session = Depends(get_db)):
    inst = _get(db, strategy_id)
    if manager.is_running(strategy_id):
        await manager.stop(strategy_id, flatten=False)
    db.delete(inst)
    db.commit()
    return {"deleted": strategy_id}


@router.post("/{strategy_id}/start", response_model=StrategyOut)
async def start_strategy(strategy_id: int, confirm_live: bool = Query(False),
                         db: Session = Depends(get_db)):
    inst = _get(db, strategy_id)
    if inst.mode == "live" and not confirm_live:
        raise HTTPException(400, "this strategy is in LIVE mode and will place real orders — "
                                 "retry with ?confirm_live=true to confirm")
    try:
        await manager.start(strategy_id)
    except Exception as e:
        raise HTTPException(400, str(e))
    db.refresh(inst)
    return inst


@router.post("/{strategy_id}/pause", response_model=StrategyOut)
async def pause_strategy(strategy_id: int, db: Session = Depends(get_db)):
    inst = _get(db, strategy_id)
    try:
        await manager.pause(strategy_id)
    except Exception as e:
        raise HTTPException(400, str(e))
    db.refresh(inst)
    return inst


@router.post("/{strategy_id}/stop", response_model=StrategyOut)
async def stop_strategy(strategy_id: int, flatten: bool = Query(False), db: Session = Depends(get_db)):
    inst = _get(db, strategy_id)
    await manager.stop(strategy_id, flatten=flatten)
    db.refresh(inst)
    return inst


@router.post("/{strategy_id}/reset-paper")
def reset_paper(strategy_id: int, db: Session = Depends(get_db)):
    """Reset the strategy's virtual paper account (cash + positions). Stopped strategies only."""
    from ..engine.runtime import runtime

    _get(db, strategy_id)
    if manager.is_running(strategy_id):
        raise HTTPException(409, "stop the strategy first")
    runtime.reset_paper_state(strategy_id)
    return {"reset": strategy_id}
