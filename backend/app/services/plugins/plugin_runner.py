import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.plugins import PluginRecord, PluginExecutionLog
from app.services.plugins.base_plugin import BasePlugin, ExecutionContext, PluginResult
from app.services.plugins.plugin_registry import PluginRegistry

logger = logging.getLogger(__name__)


class PluginRunner:
    """
    Asynchronous runner managing plugin execution with concurrency limits,
    configurable timeouts, error isolation, retries, and execution log recording.
    """
    def __init__(
        self,
        max_concurrency: int = 5,
        default_timeout_sec: float = 60.0,
        session_factory: Optional[Callable[[], AsyncSession]] = None
    ):
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.default_timeout_sec = default_timeout_sec
        self.session_factory = session_factory

    def _get_session_factory(self):
        if self.session_factory:
            return self.session_factory
        from app.core.database import AsyncSessionLocal
        return AsyncSessionLocal

    async def execute_plugin(
        self,
        plugin_id: str,
        parameters: Optional[Dict[str, Any]] = None,
        triggered_by: str = "manual",
        timeout_sec: Optional[float] = None,
        retries: int = 1,
        db_session: Optional[AsyncSession] = None
    ) -> PluginResult:
        registry = PluginRegistry.get_instance()
        plugin = registry.get_plugin(plugin_id)
        if not plugin:
            return PluginResult(
                success=False,
                status="failed",
                error=f"Plugin '{plugin_id}' not found in registry"
            )

        effective_timeout = timeout_sec or self.default_timeout_sec

        # Fetch config from DB if present
        config: Dict[str, Any] = {}
        try:
            if db_session:
                result = await db_session.execute(select(PluginRecord).where(PluginRecord.plugin_id == plugin_id))
                record = result.scalar_one_or_none()
                if record and record.config_json:
                    config = dict(record.config_json)
                    if not record.is_enabled and triggered_by == "scheduler":
                        return PluginResult(
                            success=False,
                            status="skipped",
                            log_output=f"Plugin '{plugin_id}' is disabled."
                        )
            else:
                factory = self._get_session_factory()
                async with factory() as db:
                    result = await db.execute(select(PluginRecord).where(PluginRecord.plugin_id == plugin_id))
                    record = result.scalar_one_or_none()
                    if record and record.config_json:
                        config = dict(record.config_json)
                        if not record.is_enabled and triggered_by == "scheduler":
                            return PluginResult(
                                success=False,
                                status="skipped",
                                log_output=f"Plugin '{plugin_id}' is disabled."
                            )
        except Exception as err:
            logger.debug("Could not read plugin record from DB (ignoring for runner): %s", err)

        start_time = time.time()
        start_dt = datetime.now(timezone.utc)
        result = PluginResult(success=False, status="running")
        logs = []

        async with self.semaphore:
            attempt = 0
            while attempt < max(1, retries):
                attempt += 1
                try:
                    plugin.initialize(config)
                    context = ExecutionContext(
                        plugin_id=plugin_id,
                        config=config,
                        parameters=parameters or {},
                        triggered_by=triggered_by
                    )

                    result = await asyncio.wait_for(
                        plugin.execute(context),
                        timeout=effective_timeout
                    )
                    if result.success:
                        break
                    else:
                        logs.append(f"Attempt {attempt} returned failure: {result.error}")
                except asyncio.TimeoutError:
                    err = f"Plugin '{plugin_id}' execution timed out after {effective_timeout}s"
                    logger.warning(err)
                    logs.append(err)
                    result = PluginResult(
                        success=False,
                        status="timeout",
                        error=err,
                        log_output="\n".join(logs)
                    )
                except Exception as exc:
                    err = f"Plugin execution error: {type(exc).__name__}: {str(exc)}"
                    logger.exception("Error executing plugin %s", plugin_id)
                    logs.append(err)
                    result = PluginResult(
                        success=False,
                        status="failed",
                        error=err,
                        log_output="\n".join(logs)
                    )
                finally:
                    try:
                        await plugin.teardown()
                    except Exception as td_err:
                        logger.warning("Error during teardown of plugin %s: %s", plugin_id, td_err)

                if attempt < retries:
                    await asyncio.sleep(1.0)

        end_time = time.time()
        duration_ms = round((end_time - start_time) * 1000, 2)
        end_dt = datetime.now(timezone.utc)

        final_log_output = (result.log_output or "")
        if logs:
            final_log_output = "\n".join(logs + ([final_log_output] if final_log_output else []))

        # Record in DB
        try:
            if db_session:
                res = await db_session.execute(select(PluginRecord).where(PluginRecord.plugin_id == plugin_id))
                record = res.scalar_one_or_none()
                if record:
                    record.last_run_at = end_dt
                    record.last_status = result.status if result.success else ("timeout" if result.status == "timeout" else "error")
                    record.error_message = result.error if not result.success else None

                exec_log = PluginExecutionLog(
                    plugin_id=plugin_id,
                    started_at=start_dt,
                    finished_at=end_dt,
                    duration_ms=duration_ms,
                    status=result.status if result.success else ("timeout" if result.status == "timeout" else "failed"),
                    items_produced=result.items_produced,
                    log_output=final_log_output,
                    error=result.error
                )
                db_session.add(exec_log)
                await db_session.commit()
            else:
                factory = self._get_session_factory()
                async with factory() as db:
                    res = await db.execute(select(PluginRecord).where(PluginRecord.plugin_id == plugin_id))
                    record = res.scalar_one_or_none()
                    if record:
                        record.last_run_at = end_dt
                        record.last_status = result.status if result.success else ("timeout" if result.status == "timeout" else "error")
                        record.error_message = result.error if not result.success else None

                    exec_log = PluginExecutionLog(
                        plugin_id=plugin_id,
                        started_at=start_dt,
                        finished_at=end_dt,
                        duration_ms=duration_ms,
                        status=result.status if result.success else ("timeout" if result.status == "timeout" else "failed"),
                        items_produced=result.items_produced,
                        log_output=final_log_output,
                        error=result.error
                    )
                    db.add(exec_log)
                    await db.commit()
        except Exception as db_err:
            logger.debug("Database log persistence skipped or failed: %s", db_err)

        return result
