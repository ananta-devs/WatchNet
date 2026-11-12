import asyncio
from datetime import datetime, timezone, timedelta
import logging
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notifications import (
    InAppNotification,
    NotificationChannel,
    NotificationDeliveryLog
)
from app.models.entities import Device
from app.services.notifications.publishers import (
    PUBLISHER_ADAPTERS,
    NotificationPayload,
    BasePublisherAdapter
)

logger = logging.getLogger(__name__)

# Severity mapping for hierarchy comparison
SEVERITY_ORDER = {
    "INFO": 1,
    "WARNING": 2,
    "CRITICAL": 3
}


class NotificationRouter:
    """
    Notification Dispatcher & Router Engine.
    Handles:
      - Priority levels (INFO, WARNING, CRITICAL)
      - Deduplication and suppression windows (avoiding notification storms on flapping devices)
      - Per-device notification preferences (e.g., VIP-only notifications)
      - Multi-channel fan-out to configured publishers
      - In-app notification creation and delivery history tracking
    """

    def __init__(self, suppression_window_seconds: int = 120):
        # Key: (device_id or "global", event_type, severity) -> last sent datetime
        self._suppression_cache: Dict[str, datetime] = {}
        self.suppression_window = timedelta(seconds=suppression_window_seconds)

    def is_suppressed(self, device_id: Optional[str], event_type: str, severity: str) -> bool:
        """Check if an event is in suppression window to prevent flapping storms."""
        cache_key = f"{device_id or 'global'}:{event_type}:{severity}"
        now = datetime.now(timezone.utc)
        last_sent = self._suppression_cache.get(cache_key)
        if last_sent and (now - last_sent) < self.suppression_window:
            return True
        return False

    def mark_dispatched(self, device_id: Optional[str], event_type: str, severity: str) -> None:
        cache_key = f"{device_id or 'global'}:{event_type}:{severity}"
        self._suppression_cache[cache_key] = datetime.now(timezone.utc)

    def clear_suppression_cache(self) -> None:
        self._suppression_cache.clear()

    async def dispatch(
        self,
        session: AsyncSession,
        title: str,
        message: str,
        severity: str = "INFO",
        event_type: str = "EVENT",
        device_id: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
        bypass_suppression: bool = False
    ) -> Dict[str, Any]:
        """
        Main dispatch entry point.
        """
        severity_norm = severity.upper()
        if severity_norm not in SEVERITY_ORDER:
            severity_norm = "INFO"

        # 1. Deduplication & suppression check
        if not bypass_suppression and self.is_suppressed(device_id, event_type, severity_norm):
            logger.info(f"[NotificationRouter] Suppressed flapping alert {event_type} for device {device_id}")
            return {
                "status": "suppressed",
                "in_app_id": None,
                "channels_delivered": 0,
                "channels_failed": 0
            }

        # 2. Check per-device preferences if device_id provided
        if device_id:
            try:
                dev_uuid = uuid.UUID(str(device_id))
                device = await session.get(Device, dev_uuid)
                if device and device.custom_properties:
                    # If device specifies 'notify_disabled': true, skip
                    if device.custom_properties.get("notifications_disabled", False):
                        logger.info(f"[NotificationRouter] Notifications disabled for device {device.mac}")
                        return {"status": "device_disabled", "channels_delivered": 0}

                    # If device specifies 'min_notify_severity', verify threshold
                    req_sev = device.custom_properties.get("min_notify_severity")
                    if req_sev and SEVERITY_ORDER.get(severity_norm, 1) < SEVERITY_ORDER.get(str(req_sev).upper(), 1):
                        logger.info(f"[NotificationRouter] Severity {severity_norm} below device threshold {req_sev}")
                        return {"status": "below_device_threshold", "channels_delivered": 0}
            except Exception as e:
                logger.warning(f"[NotificationRouter] Error checking device preference: {e}")

        # 3. Create In-App Notification record
        in_app = InAppNotification(
            title=title,
            message=message,
            severity=severity_norm,
            event_type=event_type,
            device_id=uuid.UUID(str(device_id)) if device_id else None,
            is_read=False
        )
        session.add(in_app)
        await session.flush()

        # Update suppression cache
        self.mark_dispatched(device_id, event_type, severity_norm)

        # 4. Multi-channel fan-out
        stmt = select(NotificationChannel).where(NotificationChannel.is_enabled == True)
        result = await session.execute(stmt)
        channels = result.scalars().all()

        delivered_count = 0
        failed_count = 0
        payload = NotificationPayload(
            title=title,
            message=message,
            severity=severity_norm,
            event_type=event_type,
            device_id=str(device_id) if device_id else None,
            data=data or {}
        )

        for channel in channels:
            ch_min_sev = (channel.min_severity or "INFO").upper()
            if SEVERITY_ORDER.get(severity_norm, 1) < SEVERITY_ORDER.get(ch_min_sev, 1):
                continue  # Skip channel due to severity threshold

            adapter = PUBLISHER_ADAPTERS.get(channel.channel_type.lower())
            if not adapter:
                logger.warning(f"[NotificationRouter] Unknown adapter for channel {channel.name} ({channel.channel_type})")
                continue

            try:
                ok = await adapter.publish(payload, channel.config_json or {})
                log_entry = NotificationDeliveryLog(
                    channel_id=channel.id,
                    event_type=event_type,
                    status="SUCCESS" if ok else "FAILED",
                    error_message=None if ok else "Delivery returned False"
                )
                session.add(log_entry)
                if ok:
                    delivered_count += 1
                else:
                    failed_count += 1
            except Exception as ex:
                logger.error(f"[NotificationRouter] Failed delivery to {channel.name}: {ex}")
                log_entry = NotificationDeliveryLog(
                    channel_id=channel.id,
                    event_type=event_type,
                    status="FAILED",
                    error_message=str(ex)
                )
                session.add(log_entry)
                failed_count += 1

        await session.commit()

        return {
            "status": "delivered",
            "in_app_id": str(in_app.id),
            "channels_delivered": delivered_count,
            "channels_failed": failed_count
        }

    async def send_test_notification(
        self,
        session: AsyncSession,
        channel_id: str,
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send an isolated test notification to a specific delivery channel."""
        ch_uuid = uuid.UUID(str(channel_id))
        channel = await session.get(NotificationChannel, ch_uuid)
        if not channel:
            raise ValueError(f"NotificationChannel with ID {channel_id} not found.")

        adapter = PUBLISHER_ADAPTERS.get(channel.channel_type.lower())
        if not adapter:
            raise ValueError(f"No adapter registered for channel type '{channel.channel_type}'.")

        payload = NotificationPayload(
            title="WatchNet Test Alert",
            message=message or f"This is a test notification for {channel.name} ({channel.channel_type}).",
            severity="INFO",
            event_type="TEST_ALERT",
            data={"test": True}
        )

        ok = await adapter.publish(payload, channel.config_json or {})
        log_entry = NotificationDeliveryLog(
            channel_id=channel.id,
            event_type="TEST_ALERT",
            status="SUCCESS" if ok else "FAILED",
            error_message=None if ok else "Adapter test returned False"
        )
        session.add(log_entry)
        await session.commit()

        return {
            "success": ok,
            "channel_id": str(channel.id),
            "channel_name": channel.name,
            "channel_type": channel.channel_type
        }


# Singleton router instance
notification_router = NotificationRouter()
