"""Engine manager: owns all StrategyRunners, maps API actions to runner lifecycle,
and resumes previously-running strategies on startup (paper resumes automatically;
live requires an active Kite session and the live-trading master switch)."""
import asyncio
import logging

from sqlalchemy import select

from ..db import SessionLocal
from ..models import StrategyInstance
from .runner import StrategyRunner

log = logging.getLogger(__name__)


class EngineManager:
    def __init__(self):
        self.runners: dict[int, StrategyRunner] = {}
        self._lock = asyncio.Lock()

    async def startup(self) -> None:
        with SessionLocal() as db:
            rows = db.execute(
                select(StrategyInstance).where(StrategyInstance.status == "running")
            ).scalars().all()
        for row in rows:
            try:
                await self.start(row.id)
                log.info("resumed strategy %s", row.name)
            except Exception as e:
                log.warning("could not resume %s: %s", row.name, e)
                with SessionLocal() as db:
                    inst = db.get(StrategyInstance, row.id)
                    inst.status = "error"
                    inst.error_message = f"resume failed: {e}"
                    db.commit()

    async def shutdown(self) -> None:
        for sid in list(self.runners):
            try:
                await self._stop_runner(sid, persist_status=False)
            except Exception:
                log.exception("error stopping runner %s", sid)

    async def start(self, strategy_id: int) -> None:
        async with self._lock:
            if strategy_id in self.runners:
                runner = self.runners[strategy_id]
                if runner.paused:  # resume from pause
                    runner.paused = False
                    runner.halted_reason = ""
                    runner._set_status("running")
                return
            with SessionLocal() as db:
                inst = db.get(StrategyInstance, strategy_id)
                if inst is None:
                    raise ValueError("strategy not found")
            runner = StrategyRunner(inst)  # raises for bad config / live prerequisites
            self.runners[strategy_id] = runner
            runner.start()
            runner._set_status("running")

    async def pause(self, strategy_id: int) -> None:
        runner = self.runners.get(strategy_id)
        if runner is None:
            raise ValueError("strategy is not running")
        runner.paused = True
        runner._set_status("paused")
        runner.log_event("paused (open positions still risk-managed)")

    async def stop(self, strategy_id: int, flatten: bool = False) -> None:
        await self._stop_runner(strategy_id, flatten=flatten)

    async def _stop_runner(self, strategy_id: int, flatten: bool = False,
                           persist_status: bool = True) -> None:
        runner = self.runners.pop(strategy_id, None)
        if runner is None:
            if persist_status:
                with SessionLocal() as db:
                    inst = db.get(StrategyInstance, strategy_id)
                    if inst and inst.status != "stopped":
                        inst.status = "stopped"
                        db.commit()
            return
        if flatten:
            await asyncio.to_thread(runner.flatten_all, "manual stop with flatten")
        await runner.stop()
        if persist_status:
            runner._set_status("stopped")
        runner.log_event("stopped" + (" (positions flattened)" if flatten else ""))

    async def kill_switch(self) -> int:
        """Flatten and stop everything. Returns number of strategies halted."""
        count = 0
        for sid in list(self.runners):
            await self._stop_runner(sid, flatten=True)
            count += 1
        return count

    def is_running(self, strategy_id: int) -> bool:
        return strategy_id in self.runners


manager = EngineManager()
