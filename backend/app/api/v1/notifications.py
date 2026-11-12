import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.notifications import (
    InAppNotification,
    NotificationChannel,
    NotificationDeliveryLog
)
from app.services.notifications.notification_router import notification_router

router = APIRouter(prefix="/notifications", tags=["notifications"])


# Schemas
class ChannelCreateRequest(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Admin Telegram"})
    channel_type: str = Field(..., json_schema_extra={"example": "telegram"})  # email, telegram, mqtt, ntfy, pushover, pushsafer, webhook, apprise
    is_enabled: bool = True
    config_json: Dict[str, Any] = Field(default_factory=dict)
    min_severity: str = Field("INFO", json_schema_extra={"example": "INFO"})


class ChannelResponse(BaseModel):
    id: str
    name: str
    channel_type: str
    is_enabled: bool
    config_json: Dict[str, Any]
    min_severity: str
    created_at: str

    model_config = {"from_attributes": True}


class InAppNotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    severity: str
    event_type: str
    is_read: bool
    device_id: Optional[str]
    created_at: str


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    items: List[InAppNotificationResponse]


class ChannelTestRequest(BaseModel):
    channel_id: str
    message: Optional[str] = None


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """List in-app notifications with unread count and pagination."""
    query = select(InAppNotification)
    if unread_only:
        query = query.where(InAppNotification.is_read == False)
    query = query.order_by(desc(InAppNotification.created_at)).offset(skip).limit(limit)

    res = await db.execute(query)
    notifications = res.scalars().all()

    # Total count
    total_q = select(func.count(InAppNotification.id))
    if unread_only:
        total_q = total_q.where(InAppNotification.is_read == False)
    total_res = await db.execute(total_q)
    total = total_res.scalar() or 0

    # Unread count
    unread_q = select(func.count(InAppNotification.id)).where(InAppNotification.is_read == False)
    unread_res = await db.execute(unread_q)
    unread_count = unread_res.scalar() or 0

    items = [
        InAppNotificationResponse(
            id=str(n.id),
            title=n.title,
            message=n.message,
            severity=n.severity,
            event_type=n.event_type,
            is_read=n.is_read,
            device_id=str(n.device_id) if n.device_id else None,
            created_at=n.created_at.isoformat()
        )
        for n in notifications
    ]

    return NotificationListResponse(
        total=total,
        unread_count=unread_count,
        items=items
    )


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Mark a single notification as read."""
    try:
        n_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification UUID")

    notification = await db.get(InAppNotification, n_uuid)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.commit()
    return {"status": "success", "id": notification_id, "is_read": True}


@router.post("/read-all")
async def mark_all_notifications_read(db: AsyncSession = Depends(get_db)):
    """Mark all notifications as read."""
    stmt = select(InAppNotification).where(InAppNotification.is_read == False)
    res = await db.execute(stmt)
    notifications = res.scalars().all()
    count = len(notifications)
    for n in notifications:
        n.is_read = True
    await db.commit()
    return {"status": "success", "marked_read_count": count}


@router.get("/channels", response_model=List[ChannelResponse])
async def list_channels(db: AsyncSession = Depends(get_db)):
    """List configured delivery channels."""
    stmt = select(NotificationChannel).order_by(desc(NotificationChannel.created_at))
    res = await db.execute(stmt)
    channels = res.scalars().all()

    return [
        ChannelResponse(
            id=str(c.id),
            name=c.name,
            channel_type=c.channel_type,
            is_enabled=c.is_enabled,
            config_json=c.config_json or {},
            min_severity=c.min_severity,
            created_at=c.created_at.isoformat()
        )
        for c in channels
    ]


@router.post("/channels", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_channel(
    channel_data: ChannelCreateRequest,
    channel_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Create a new notification delivery channel or update existing one if channel_id is provided."""
    channel = None
    if channel_id:
        try:
            c_uuid = uuid.UUID(channel_id)
            channel = await db.get(NotificationChannel, c_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid channel UUID")

    if not channel:
        channel = NotificationChannel(
            name=channel_data.name,
            channel_type=channel_data.channel_type.lower(),
            is_enabled=channel_data.is_enabled,
            config_json=channel_data.config_json,
            min_severity=channel_data.min_severity.upper()
        )
        db.add(channel)
    else:
        channel.name = channel_data.name
        channel.channel_type = channel_data.channel_type.lower()
        channel.is_enabled = channel_data.is_enabled
        channel.config_json = channel_data.config_json
        channel.min_severity = channel_data.min_severity.upper()

    await db.commit()
    await db.refresh(channel)

    return ChannelResponse(
        id=str(channel.id),
        name=channel.name,
        channel_type=channel.channel_type,
        is_enabled=channel.is_enabled,
        config_json=channel.config_json or {},
        min_severity=channel.min_severity,
        created_at=channel.created_at.isoformat()
    )


@router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a delivery channel."""
    try:
        c_uuid = uuid.UUID(channel_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid channel UUID")

    channel = await db.get(NotificationChannel, c_uuid)
    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    await db.delete(channel)
    await db.commit()
    return {"status": "deleted", "id": channel_id}


@router.post("/test")
async def test_notification_channel(
    test_req: ChannelTestRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send test notification to a specific channel."""
    try:
        res = await notification_router.send_test_notification(
            session=db,
            channel_id=test_req.channel_id,
            message=test_req.message
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
