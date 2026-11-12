import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.entities import User
from app.models.plugins import PluginRecord, PluginExecutionLog
from app.services.plugins.plugin_registry import PluginRegistry
from app.services.plugins.plugin_runner import PluginRunner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plugins", tags=["Plugins & Integrations"])
runner = PluginRunner()


class PluginConfigUpdateRequest(BaseModel):
    config: Dict[str, Any]
    schedule_interval_sec: Optional[int] = Field(None, ge=10, le=86400)


class PluginToggleRequest(BaseModel):
    is_enabled: bool


class PluginRunRequest(BaseModel):
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    timeout_sec: Optional[float] = Field(None, ge=1.0, le=300.0)


class PluginResponse(BaseModel):
    plugin_id: str
    name: str
    category: str
    description: str
    is_enabled: bool
    schedule_interval_sec: int
    last_run_at: Optional[datetime]
    last_status: str
    config_json: Dict[str, Any]
    error_message: Optional[str]
    config_schema: Dict[str, Any]


class PluginLogResponse(BaseModel):
    id: int
    plugin_id: str
    started_at: datetime
    finished_at: Optional[datetime]
    duration_ms: float
    status: str
    items_produced: int
    log_output: str
    error: Optional[str]


async def _ensure_plugin_records_async(db: AsyncSession, registry: PluginRegistry):
    """
    Ensure all registered plugins exist in the database table with default records.
    """
    result = await db.execute(select(PluginRecord))
    existing = {rec.plugin_id: rec for rec in result.scalars().all()}
    for plugin in registry.list_plugins():
        if plugin.plugin_id not in existing:
            new_rec = PluginRecord(
                plugin_id=plugin.plugin_id,
                name=plugin.name,
                category=plugin.category,
                is_enabled=False,
                schedule_interval_sec=300,
                last_status="idle",
                config_json={}
            )
            db.add(new_rec)
    await db.commit()


@router.get("", response_model=List[PluginResponse])
async def list_plugins(
    category: Optional[str] = Query(None, description="Filter by category"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all registered plugins with enable state, schedule, and last execution status.
    """
    registry = PluginRegistry.get_instance()
    await _ensure_plugin_records_async(db, registry)

    query = select(PluginRecord)
    if category:
        query = query.where(PluginRecord.category == category)
    result = await db.execute(query)
    records = result.scalars().all()

    res = []
    for rec in records:
        plugin = registry.get_plugin(rec.plugin_id)
        schema_dict = {}
        desc = ""
        if plugin:
            desc = plugin.description
            if plugin.config_schema:
                try:
                    schema_dict = plugin.config_schema.model_json_schema()
                except Exception:
                    schema_dict = {}

        res.append(PluginResponse(
            plugin_id=rec.plugin_id,
            name=rec.name,
            category=rec.category,
            description=desc,
            is_enabled=rec.is_enabled,
            schedule_interval_sec=rec.schedule_interval_sec,
            last_run_at=rec.last_run_at,
            last_status=rec.last_status,
            config_json=rec.config_json or {},
            error_message=rec.error_message,
            config_schema=schema_dict
        ))
    return res


@router.get("/{plugin_id}", response_model=PluginResponse)
async def get_plugin_details(
    plugin_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get plugin details, configuration schema, and current state.
    """
    registry = PluginRegistry.get_instance()
    plugin = registry.get_plugin(plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail=f"Plugin '{plugin_id}' not found")

    await _ensure_plugin_records_async(db, registry)
    result = await db.execute(select(PluginRecord).where(PluginRecord.plugin_id == plugin_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Plugin record not found")

    schema_dict = {}
    if plugin.config_schema:
        try:
            schema_dict = plugin.config_schema.model_json_schema()
        except Exception:
            schema_dict = {}

    return PluginResponse(
        plugin_id=rec.plugin_id,
        name=rec.name,
        category=rec.category,
        description=plugin.description,
        is_enabled=rec.is_enabled,
        schedule_interval_sec=rec.schedule_interval_sec,
        last_run_at=rec.last_run_at,
        last_status=rec.last_status,
        config_json=rec.config_json or {},
        error_message=rec.error_message,
        config_schema=schema_dict
    )


@router.put("/{plugin_id}/config", response_model=PluginResponse)
async def update_plugin_config(
    plugin_id: str,
    payload: PluginConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save plugin configuration and optional schedule interval.
    """
    registry = PluginRegistry.get_instance()
    plugin = registry.get_plugin(plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail=f"Plugin '{plugin_id}' not found")

    # Validate against plugin schema
    try:
        plugin.validate_config(payload.config)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Configuration validation failed: {str(e)}")

    result = await db.execute(select(PluginRecord).where(PluginRecord.plugin_id == plugin_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Plugin record not found")

    rec.config_json = payload.config
    if payload.schedule_interval_sec is not None:
        rec.schedule_interval_sec = payload.schedule_interval_sec
    await db.commit()
    await db.refresh(rec)

    schema_dict = plugin.config_schema.model_json_schema() if plugin.config_schema else {}
    return PluginResponse(
        plugin_id=rec.plugin_id,
        name=rec.name,
        category=rec.category,
        description=plugin.description,
        is_enabled=rec.is_enabled,
        schedule_interval_sec=rec.schedule_interval_sec,
        last_run_at=rec.last_run_at,
        last_status=rec.last_status,
        config_json=rec.config_json or {},
        error_message=rec.error_message,
        config_schema=schema_dict
    )


@router.post("/{plugin_id}/toggle", response_model=PluginResponse)
async def toggle_plugin(
    plugin_id: str,
    payload: PluginToggleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Enable or disable a plugin.
    """
    registry = PluginRegistry.get_instance()
    plugin = registry.get_plugin(plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail=f"Plugin '{plugin_id}' not found")

    result = await db.execute(select(PluginRecord).where(PluginRecord.plugin_id == plugin_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Plugin record not found")

    rec.is_enabled = payload.is_enabled
    await db.commit()
    await db.refresh(rec)

    schema_dict = plugin.config_schema.model_json_schema() if plugin.config_schema else {}
    return PluginResponse(
        plugin_id=rec.plugin_id,
        name=rec.name,
        category=rec.category,
        description=plugin.description,
        is_enabled=rec.is_enabled,
        schedule_interval_sec=rec.schedule_interval_sec,
        last_run_at=rec.last_run_at,
        last_status=rec.last_status,
        config_json=rec.config_json or {},
        error_message=rec.error_message,
        config_schema=schema_dict
    )


@router.post("/{plugin_id}/run")
async def run_plugin_manually(
    plugin_id: str,
    payload: PluginRunRequest = PluginRunRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    On-demand manual trigger of a plugin.
    """
    registry = PluginRegistry.get_instance()
    plugin = registry.get_plugin(plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail=f"Plugin '{plugin_id}' not found")

    result = await runner.execute_plugin(
        plugin_id=plugin_id,
        parameters=payload.parameters,
        triggered_by="manual",
        timeout_sec=payload.timeout_sec,
        db_session=db
    )

    return {
        "success": result.success,
        "status": result.status,
        "items_produced": result.items_produced,
        "log_output": result.log_output,
        "error": result.error,
        "data": result.data
    }


@router.get("/{plugin_id}/logs", response_model=List[PluginLogResponse])
async def get_plugin_logs(
    plugin_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get historical execution logs for a plugin.
    """
    result = await db.execute(
        select(PluginExecutionLog)
        .where(PluginExecutionLog.plugin_id == plugin_id)
        .order_by(desc(PluginExecutionLog.started_at))
        .limit(limit)
    )
    logs = result.scalars().all()

    return [
        PluginLogResponse(
            id=log.id,
            plugin_id=log.plugin_id,
            started_at=log.started_at,
            finished_at=log.finished_at,
            duration_ms=log.duration_ms,
            status=log.status,
            items_produced=log.items_produced,
            log_output=log.log_output,
            error=log.error
        )
        for log in logs
    ]
