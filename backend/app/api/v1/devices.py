from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.models.entities import Device, DeviceStatus, NetworkEvent, EventSeverity, UserRole
from app.schemas.domain import (
    DeviceCreate,
    DeviceResponse,
    DeviceUpdate,
    DeviceBulkUpdate,
    DeviceListResponse,
    DevicePresenceDay,
    DeviceHistoryResponse
)
from app.core.dependencies import get_current_user, require_roles
from app.services.devices.device_service import DeviceService
from app.services.devices.oui_resolver import oui_resolver, normalize_mac

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("")
async def list_devices(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    vendor: Optional[str] = None,
    ip_range: Optional[str] = None,
    site_id: Optional[uuid.UUID] = None,
    is_archived: Optional[bool] = False,
    sort_by: str = "last_seen",
    sort_desc: bool = True,
    paginate: bool = Query(False, description="If true, returns {devices, total, skip, limit}, otherwise returns list with X-Total-Count header"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Paginated device list with search, sorting, filtering by status, category, vendor, IP range, site_id, and archived state.
    Supports both direct array response (with X-Total-Count header) and wrapped pagination object.
    """
    service = DeviceService(db)
    devices, total = await service.list_devices(
        skip=skip,
        limit=limit,
        search=search,
        status=status,
        category=category,
        vendor=vendor,
        ip_range=ip_range,
        site_id=site_id,
        is_archived=is_archived,
        sort_by=sort_by,
        sort_desc=sort_desc
    )
    
    device_out = [DeviceResponse.model_validate(d).model_dump(mode="json") for d in devices]

    if paginate:
        return {
            "devices": device_out,
            "total": total,
            "skip": skip,
            "limit": limit
        }

    response.headers["X-Total-Count"] = str(total)
    return device_out


@router.post("", response_model=DeviceResponse)
async def create_or_update_device(
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR, UserRole.OPERATOR]))
):
    """
    Create or update a device record manually or via operator action.
    """
    service = DeviceService(db)
    norm_mac = normalize_mac(payload.mac)
    existing = await service.get_device_by_mac(norm_mac)

    if existing:
        updated = await service.update_device(
            device_id=existing.id,
            name=payload.name,
            category=payload.category.value if hasattr(payload.category, "value") else str(payload.category),
            icon=payload.icon,
            notes=payload.notes,
            custom_properties=payload.custom_properties,
            is_archived=payload.is_archived
        )
        return updated

    # Auto-resolve vendor if not supplied
    vendor = payload.vendor or oui_resolver.resolve_vendor(norm_mac)
    new_device = Device(
        mac=norm_mac,
        ipv4=payload.ipv4,
        ipv6=payload.ipv6,
        vendor=vendor,
        name=payload.name,
        interface=payload.interface,
        status=payload.status,
        category=payload.category,
        icon=payload.icon,
        notes=payload.notes,
        is_archived=payload.is_archived,
        locked_fields=payload.locked_fields,
        custom_properties=payload.custom_properties
    )
    db.add(new_device)
    await db.commit()
    await db.refresh(new_device)
    return new_device


@router.post("/bulk")
async def bulk_update_devices(
    payload: DeviceBulkUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR, UserRole.OPERATOR]))
):
    """
    Bulk update across multiple devices: mass category change, tagging, or mass archiving.
    """
    service = DeviceService(db)
    count = await service.bulk_update(
        device_ids=payload.device_ids,
        category=payload.category,
        add_tags=payload.add_tags,
        remove_tags=payload.remove_tags,
        is_archived=payload.is_archived,
        lock_category=payload.lock_category
    )
    return {"status": "success", "updated_count": count}


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Detailed device record including hardware specs, first_seen, last_seen, custom properties, locked fields.
    """
    service = DeviceService(db)
    device = await service.get_device_by_id(device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device_details(
    device_id: uuid.UUID,
    payload: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR, UserRole.OPERATOR]))
):
    """
    Update device details (name, category, icon, notes, locked fields, archival status).
    """
    service = DeviceService(db)
    device = await service.update_device(
        device_id=device_id,
        name=payload.name,
        category=payload.category,
        icon=payload.icon,
        notes=payload.notes,
        locked_fields=payload.locked_fields,
        custom_properties=payload.custom_properties,
        is_archived=payload.is_archived
    )
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.get("/{device_id}/history", response_model=DeviceHistoryResponse)
async def get_device_history(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Historical timeline, IP history, and session records for a device.
    """
    service = DeviceService(db)
    history = await service.get_device_history(device_id)
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return history


@router.get("/{device_id}/presence", response_model=List[DevicePresenceDay])
async def get_device_presence(
    device_id: uuid.UUID,
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    24-bit hourly presence matrix for heatmap rendering.
    """
    service = DeviceService(db)
    presence = await service.get_device_presence_matrix(device_id, days=days)
    return presence


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: uuid.UUID,
    hard_delete: bool = Query(False, description="If true, permanently deletes record from database; otherwise soft-deletes (archives)"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR]))
):
    """
    Delete device (soft delete/archive by default, or permanent cascade hard delete for admins/owners).
    """
    service = DeviceService(db)
    success = await service.delete_device(device_id, hard_delete=hard_delete)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/events")
async def ingest_collector_event(
    evt: dict,
    db: AsyncSession = Depends(get_db)
):
    from app.services.discovery.ingest_service import DeviceIngestionService
    ingest = DeviceIngestionService(db)
    results = await ingest.ingest_discovery_batch([evt], source_type="collector")
    return {"status": "ingested", "events": results}
