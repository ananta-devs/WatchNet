import uuid
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.entities import User, UserRole
from app.models.family import ProfileRole, DnsAction
from app.services.family.profile_service import ProfileService
from app.services.family.dns_policy_service import DnsPolicyService, STANDARD_CATEGORIES
from app.services.family.activity_service import ActivityService, DISCLOSURE_NOTICE

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/family", tags=["Family Safety & DNS Intelligence"])

# --- Request / Response Models ---

class ProfileCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    role: str = Field(ProfileRole.CHILD.value)
    avatar: Optional[str] = "smile"

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    avatar: Optional[str] = None

class PauseRequest(BaseModel):
    paused: bool
    duration_minutes: Optional[int] = None # e.g. 30, 60 or None for indefinite

class AssignDeviceRequest(BaseModel):
    device_id: uuid.UUID

class PolicySaveRequest(BaseModel):
    name: str = "Standard Policy"
    categories: List[str] = []
    blocked_domains: List[str] = []
    allowed_domains: List[str] = []
    is_active: bool = True

class ScheduleSaveRequest(BaseModel):
    schedule_id: Optional[uuid.UUID] = None
    name: str = "Bedtime"
    days_of_week: List[str] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    start_time: str = "21:00"
    end_time: str = "07:00"
    is_active: bool = True

class DnsQueryIngestRequest(BaseModel):
    domain: str
    device_ip_or_mac: str
    query_type: Optional[str] = "A"
    resolver_source: Optional[str] = "AdGuardHome"

# --- Endpoints ---

@router.get("/profiles")
async def list_profiles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all household profiles with assigned devices, pause state, and policies."""
    profiles = await ProfileService.list_profiles(db)
    result = []
    for p in profiles:
        devices = []
        for d in p.devices:
            dev_info = {
                "id": str(d.device_id),
                "assigned_at": d.assigned_at.isoformat(),
                "mac": d.device.mac if d.device else None,
                "name": d.device.name if d.device else None,
                "ipv4": d.device.ipv4 if d.device else None,
                "status": d.device.status.value if d.device and hasattr(d.device.status, "value") else "unknown"
            }
            devices.append(dev_info)

        result.append({
            "id": str(p.id),
            "name": p.name,
            "role": p.role.value if hasattr(p.role, "value") else str(p.role),
            "avatar": p.avatar,
            "is_paused": p.is_paused,
            "pause_until": p.pause_until.isoformat() if p.pause_until else None,
            "created_at": p.created_at.isoformat(),
            "devices": devices,
            "policies": [
                {
                    "id": str(pol.id),
                    "name": pol.name,
                    "categories": pol.categories_json,
                    "blocked_domains": pol.blocked_domains_json,
                    "allowed_domains": pol.allowed_domains_json,
                    "is_active": pol.is_active
                }
                for pol in p.policies
            ],
            "schedules": [
                {
                    "id": str(s.id),
                    "name": s.name,
                    "days_of_week": s.days_of_week,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "is_active": s.is_active
                }
                for s in p.schedules
            ]
        })
    return result

@router.post("/profiles", status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: ProfileCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER]))
):
    """Create a new household profile."""
    prof = await ProfileService.create_profile(
        db=db,
        name=payload.name,
        role=payload.role,
        avatar=payload.avatar
    )
    return {
        "id": str(prof.id),
        "name": prof.name,
        "role": prof.role.value if hasattr(prof.role, "value") else str(prof.role),
        "avatar": prof.avatar,
        "is_paused": prof.is_paused
    }

@router.put("/profiles/{id}")
async def update_profile(
    id: uuid.UUID,
    payload: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER]))
):
    """Update profile attributes."""
    prof = await ProfileService.update_profile(
        db=db,
        profile_id=id,
        name=payload.name,
        role=payload.role,
        avatar=payload.avatar
    )
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "success", "profile": {"id": str(prof.id), "name": prof.name, "role": prof.role}}

@router.post("/profiles/{id}/pause")
async def toggle_pause_profile(
    id: uuid.UUID,
    payload: PauseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER, UserRole.OPERATOR, UserRole.GUARDIAN]))
):
    """Toggle Pause / Resume internet access for an entire profile."""
    prof = await ProfileService.toggle_pause(
        db=db,
        profile_id=id,
        paused=payload.paused,
        duration_minutes=payload.duration_minutes
    )
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {
        "status": "success",
        "profile_id": str(prof.id),
        "is_paused": prof.is_paused,
        "pause_until": prof.pause_until.isoformat() if prof.pause_until else None
    }

@router.post("/profiles/{id}/assign-device")
async def assign_device_to_profile(
    id: uuid.UUID,
    payload: AssignDeviceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER]))
):
    """Assign device to a household profile."""
    assoc = await ProfileService.assign_device(db, profile_id=id, device_id=payload.device_id)
    return {"status": "success", "profile_id": str(id), "device_id": str(payload.device_id)}

@router.delete("/profiles/{id}/devices/{device_id}")
async def remove_device_from_profile(
    id: uuid.UUID,
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER]))
):
    """Remove device assignment from profile."""
    removed = await ProfileService.unassign_device(db, profile_id=id, device_id=device_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Device assignment not found")
    return {"status": "success", "message": "Device unassigned successfully"}

@router.get("/profiles/{id}/policies")
async def get_profile_policies(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get DNS policy filtering rules for a profile."""
    policies = await DnsPolicyService.get_policies_for_profile(db, id)
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "categories": p.categories_json,
            "blocked_domains": p.blocked_domains_json,
            "allowed_domains": p.allowed_domains_json,
            "is_active": p.is_active
        }
        for p in policies
    ]

@router.put("/profiles/{id}/policies")
async def save_profile_policies(
    id: uuid.UUID,
    payload: PolicySaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER]))
):
    """Save or update DNS policy categories, blocklists, and allowlists."""
    pol = await DnsPolicyService.save_policy(
        db=db,
        profile_id=id,
        name=payload.name,
        categories=payload.categories,
        blocked_domains=payload.blocked_domains,
        allowed_domains=payload.allowed_domains,
        is_active=payload.is_active
    )
    return {
        "status": "success",
        "policy": {
            "id": str(pol.id),
            "name": pol.name,
            "categories": pol.categories_json,
            "blocked_domains": pol.blocked_domains_json,
            "allowed_domains": pol.allowed_domains_json
        }
    }

@router.get("/profiles/{id}/schedules")
async def get_profile_schedules(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get bedtime and study access schedules."""
    schedules = await DnsPolicyService.get_schedules_for_profile(db, id)
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "days_of_week": s.days_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "is_active": s.is_active
        }
        for s in schedules
    ]

@router.post("/profiles/{id}/schedules")
async def create_or_update_schedule(
    id: uuid.UUID,
    payload: ScheduleSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER]))
):
    """Save bedtime access schedule."""
    sched = await DnsPolicyService.create_or_update_schedule(
        db=db,
        profile_id=id,
        name=payload.name,
        days_of_week=payload.days_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_active=payload.is_active,
        schedule_id=payload.schedule_id
    )
    return {
        "status": "success",
        "schedule": {
            "id": str(sched.id),
            "name": sched.name,
            "days_of_week": sched.days_of_week,
            "start_time": sched.start_time,
            "end_time": sched.end_time,
            "is_active": sched.is_active
        }
    }

@router.get("/categories")
async def get_standard_categories(
    current_user: User = Depends(get_current_user)
):
    """Retrieve standard domain categories available for filtering."""
    return list(STANDARD_CATEGORIES.keys())

@router.get("/activity")
async def get_dns_activity(
    profile_id: Optional[uuid.UUID] = None,
    device_id: Optional[uuid.UUID] = None,
    action: Optional[str] = None,
    domain: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Filterable DNS query activity logs."""
    logs = await ActivityService.get_activity_logs(
        db=db,
        profile_id=profile_id,
        device_id=device_id,
        action=action,
        domain_query=domain,
        limit=limit,
        offset=offset
    )
    return [
        {
            "id": l.id,
            "timestamp": l.timestamp.isoformat(),
            "domain": l.domain,
            "query_type": l.query_type,
            "action": l.action.value if hasattr(l.action, "value") else str(l.action),
            "category": l.category,
            "resolver_source": l.resolver_source,
            "device": {"id": str(l.device.id), "name": l.device.name, "mac": l.device.mac} if l.device else None,
            "profile": {"id": str(l.profile.id), "name": l.profile.name, "role": l.profile.role.value if hasattr(l.profile.role, "value") else str(l.profile.role)} if l.profile else None
        }
        for l in logs
    ]

@router.get("/analytics")
async def get_dns_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """DNS analytics summary and transparent privacy disclosure notice."""
    return await ActivityService.get_analytics_summary(db)

@router.post("/activity/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_dns_query(
    payload: DnsQueryIngestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER, UserRole.OPERATOR]))
):
    """Ingest a DNS query from resolver (AdGuard Home / Pi-hole)."""
    log_entry = await ActivityService.log_dns_query(
        db=db,
        domain=payload.domain,
        device_ip_or_mac=payload.device_ip_or_mac,
        query_type=payload.query_type or "A",
        resolver_source=payload.resolver_source or "AdGuardHome"
    )
    return {
        "status": "success",
        "id": log_entry.id,
        "action": log_entry.action,
        "category": log_entry.category
    }

