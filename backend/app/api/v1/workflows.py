import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.workflows import WorkflowRule, WorkflowExecutionLog
from app.services.workflows.workflow_engine import workflow_engine

router = APIRouter(prefix="/workflows", tags=["workflows"])


# Schemas
class WorkflowRuleCreateRequest(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Alert on IoT Unknown Vendor"})
    is_enabled: bool = True
    trigger_event: str = Field(..., json_schema_extra={"example": "NEW_DEVICE_DETECTED"})
    conditions_json: List[Dict[str, Any]] = Field(default_factory=list)
    actions_json: List[Dict[str, Any]] = Field(default_factory=list)


class WorkflowRuleResponse(BaseModel):
    id: str
    name: str
    is_enabled: bool
    trigger_event: str
    conditions_json: List[Dict[str, Any]]
    actions_json: List[Dict[str, Any]]
    execution_count: int
    last_triggered_at: Optional[str]
    created_at: str
    updated_at: str


class WorkflowExecutionLogResponse(BaseModel):
    id: int
    rule_id: str
    trigger_event: str
    matched: bool
    actions_executed: List[Dict[str, Any]]
    error_message: Optional[str]
    executed_at: str


class WorkflowTestRequest(BaseModel):
    event_data: Dict[str, Any] = Field(default_factory=dict)
    device_id: Optional[str] = None


@router.get("", response_model=List[WorkflowRuleResponse])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    """List workflow rules with trigger, action summary, and execution stats."""
    stmt = select(WorkflowRule).order_by(desc(WorkflowRule.created_at))
    res = await db.execute(stmt)
    rules = res.scalars().all()

    return [
        WorkflowRuleResponse(
            id=str(r.id),
            name=r.name,
            is_enabled=r.is_enabled,
            trigger_event=r.trigger_event,
            conditions_json=r.conditions_json or [],
            actions_json=r.actions_json or [],
            execution_count=r.execution_count or 0,
            last_triggered_at=r.last_triggered_at.isoformat() if r.last_triggered_at else None,
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat()
        )
        for r in rules
    ]


@router.post("", response_model=WorkflowRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow_rule(
    rule_data: WorkflowRuleCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create a new workflow automation rule."""
    rule = WorkflowRule(
        name=rule_data.name,
        is_enabled=rule_data.is_enabled,
        trigger_event=rule_data.trigger_event,
        conditions_json=rule_data.conditions_json,
        actions_json=rule_data.actions_json
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return WorkflowRuleResponse(
        id=str(rule.id),
        name=rule.name,
        is_enabled=rule.is_enabled,
        trigger_event=rule.trigger_event,
        conditions_json=rule.conditions_json or [],
        actions_json=rule.actions_json or [],
        execution_count=rule.execution_count or 0,
        last_triggered_at=None,
        created_at=rule.created_at.isoformat(),
        updated_at=rule.updated_at.isoformat()
    )


@router.put("/{rule_id}", response_model=WorkflowRuleResponse)
async def update_workflow_rule(
    rule_id: str,
    rule_data: WorkflowRuleCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing workflow rule."""
    try:
        r_uuid = uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule UUID")

    rule = await db.get(WorkflowRule, r_uuid)
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")

    rule.name = rule_data.name
    rule.is_enabled = rule_data.is_enabled
    rule.trigger_event = rule_data.trigger_event
    rule.conditions_json = rule_data.conditions_json
    rule.actions_json = rule_data.actions_json

    await db.commit()
    await db.refresh(rule)

    return WorkflowRuleResponse(
        id=str(rule.id),
        name=rule.name,
        is_enabled=rule.is_enabled,
        trigger_event=rule.trigger_event,
        conditions_json=rule.conditions_json or [],
        actions_json=rule.actions_json or [],
        execution_count=rule.execution_count or 0,
        last_triggered_at=rule.last_triggered_at.isoformat() if rule.last_triggered_at else None,
        created_at=rule.created_at.isoformat(),
        updated_at=rule.updated_at.isoformat()
    )


@router.delete("/{rule_id}")
async def delete_workflow_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a workflow rule."""
    try:
        r_uuid = uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule UUID")

    rule = await db.get(WorkflowRule, r_uuid)
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")

    await db.delete(rule)
    await db.commit()
    return {"status": "deleted", "id": rule_id}


@router.post("/{rule_id}/toggle")
async def toggle_workflow_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    """Toggle a workflow rule enabled/disabled."""
    try:
        r_uuid = uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule UUID")

    rule = await db.get(WorkflowRule, r_uuid)
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")

    rule.is_enabled = not rule.is_enabled
    await db.commit()
    return {"id": rule_id, "is_enabled": rule.is_enabled}


@router.post("/{rule_id}/test")
async def test_workflow_rule(
    rule_id: str,
    test_req: WorkflowTestRequest,
    db: AsyncSession = Depends(get_db)
):
    """Manually test a rule against a simulated event."""
    try:
        r_uuid = uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule UUID")

    rule = await db.get(WorkflowRule, r_uuid)
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")

    # Temporarily evaluate rule conditions & execute if matched
    event_data = test_req.event_data or {}
    device = None
    if test_req.device_id:
        try:
            device = await db.get(Device, uuid.UUID(test_req.device_id))
        except Exception:
            pass

    conditions = rule.conditions_json or []
    all_match = True
    condition_evals = []
    for cond in conditions:
        matched = await workflow_engine.evaluate_condition(cond, event_data, device)
        condition_evals.append({"condition": cond, "matched": matched})
        if not matched:
            all_match = False

    action_results = []
    if all_match:
        actions = rule.actions_json or []
        for act in actions:
            try:
                res = await workflow_engine.execute_action(act, db, rule.trigger_event, event_data, device)
                action_results.append(res)
            except Exception as e:
                action_results.append({"action": act.get("action"), "status": "failed", "error": str(e)})

    return {
        "rule_id": rule_id,
        "rule_name": rule.name,
        "matched": all_match,
        "condition_evaluations": condition_evals,
        "action_results": action_results
    }


@router.get("/{rule_id}/logs", response_model=List[WorkflowExecutionLogResponse])
async def get_workflow_rule_logs(
    rule_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve rule execution history."""
    try:
        r_uuid = uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule UUID")

    stmt = select(WorkflowExecutionLog).where(
        WorkflowExecutionLog.rule_id == r_uuid
    ).order_by(desc(WorkflowExecutionLog.executed_at)).limit(limit)

    res = await db.execute(stmt)
    logs = res.scalars().all()

    return [
        WorkflowExecutionLogResponse(
            id=log.id,
            rule_id=str(log.rule_id),
            trigger_event=log.trigger_event,
            matched=log.matched,
            actions_executed=log.actions_executed or [],
            error_message=log.error_message,
            executed_at=log.executed_at.isoformat()
        )
        for log in logs
    ]
