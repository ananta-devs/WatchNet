import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.models.plugins import PluginRecord
from app.services.plugins.plugin_registry import PluginRegistry
from app.services.plugins.plugin_runner import PluginRunner

logger = logging.getLogger(__name__)


class PluginScheduler:
    """
    Scheduled runner executing enabled plugins at their configured intervals.
    """
    def __init__(
        self,
        runner: Optional[PluginRunner] = None,
        tick_seconds: int = 10,
        session_factory: Optional[Callable[[], AsyncSession]] = None
    ):
        self.runner = runner or PluginRunner()
        self.tick_seconds = tick_seconds
        self.session_factory = session_factory or AsyncSessionLocal
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_executed: Dict[str, float] = {}

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._scheduler_loop())
        logger.info("PluginScheduler background loop started")

    async def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("PluginScheduler background loop stopped")

    async def _scheduler_loop(self) -> None:
        while self._running:
            try:
                await self.tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in PluginScheduler loop: %s", e)
            await asyncio.sleep(self.tick_seconds)

    async def tick(self) -> None:
        """
        Evaluate all enabled plugins and dispatch any whose interval has elapsed.
        """
        now = datetime.now(timezone.utc).timestamp()
        enabled_plugins = []

        try:
            async with self.session_factory() as db:
                result = await db.execute(select(PluginRecord).where(PluginRecord.is_enabled == True))
                records = result.scalars().all()
                for rec in records:
                    enabled_plugins.append((rec.plugin_id, rec.schedule_interval_sec, rec.last_run_at))
        except Exception as e:
            logger.debug("Scheduler could not query enabled plugins: %s", e)
            return

        for plugin_id, interval, last_run_at in enabled_plugins:
            last_run_ts = self._last_executed.get(plugin_id)
            if last_run_ts is None and last_run_at is not None:
                last_run_ts = last_run_at.replace(tzinfo=timezone.utc).timestamp() if last_run_at.tzinfo is None else last_run_at.timestamp()

            if last_run_ts is None or (now - last_run_ts) >= interval:
                self._last_executed[plugin_id] = now
                # Fire execution in background task so tick does not block
                asyncio.create_task(self._safe_execute(plugin_id))

    async def _safe_execute(self, plugin_id: str) -> None:
        try:
            await self.runner.execute_plugin(plugin_id, triggered_by="scheduler")
        except Exception as e:
            logger.error("Error running scheduled plugin %s: %s", plugin_id, e)
