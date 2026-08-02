"""FastAPI entrypoint.

Run:  cd trading/backend && uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, market, portfolio, strategies as strategies_api
from .config import settings
from .db import init_db
from .engine.manager import manager
from .engine.runtime import runtime
from .strategies import discover

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    discover()
    if runtime.load_kite_session():
        log.info("kite session restored — using live market data")
    else:
        log.info("no kite session — using simulated market data (paper trading still fully works)")
    await manager.startup()
    yield
    await manager.shutdown()


app = FastAPI(title="AutoTrader India", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(strategies_api.router)
app.include_router(portfolio.router)
app.include_router(market.router)


@app.get("/api/health")
def health():
    return {"ok": True, "feed": runtime.feed.name,
            "running_strategies": len(manager.runners)}
