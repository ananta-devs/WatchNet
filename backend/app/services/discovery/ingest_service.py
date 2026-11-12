import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.entities import (
    Device,
    DeviceSession,
    NetworkEvent,
    PresenceHistory,
    DeviceStatus,
    DeviceCategory,
    EventSeverity
)
from app.services.devices.oui_resolver import oui_resolver
from app.services.devices.classifier import device_classifier

logger = logging.getLogger("watchnet.discovery.ingest")

class DeviceIngestionService:
    """
    Device Ingestion and Network Event Correlation Engine.
    Correlates discovery batches, generates lifecyle events:
    - NEW_DEVICE_DETECTED
    - DEVICE_CONNECTED
    - IP_CHANGED
    - Session tracking (start active session, close existing session)
    - 24-bit Presence history hourly bitmap updates
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def ingest_discovery_batch(self, batch: List[Dict[str, Any]], source_type: str = "collector") -> List[Dict[str, Any]]:
        """
        Ingests a list of device observations.
        Each entry expected to have:
        - mac: required MAC address
        - ip: optional IPv4/IPv6
        - vendor: optional vendor
        - hostname: optional hostname / device name
        - interface: optional network interface
        - metadata: optional dict
        """
        processed_events = []
        now = datetime.now(timezone.utc)

        for item in batch:
            raw_mac = item.get("mac") or item.get("device_mac")
            if not raw_mac:
                continue

            mac = raw_mac.lower().strip()
            ip = item.get("ip") or item.get("ipv4")
            vendor = item.get("vendor")
            name = item.get("name") or item.get("hostname")
            interface = item.get("interface")
            meta = item.get("metadata") or item.get("payload") or {}

            # Query existing device
            result = await self.db.execute(select(Device).where(Device.mac == mac))
            device = result.scalars().first()

            if not device:
                # 1. NEW_DEVICE_DETECTED
                resolved_vendor = vendor or oui_resolver.resolve_vendor(mac)
                classification = device_classifier.classify(
                    mac=mac,
                    hostname=name,
                    vendor=resolved_vendor,
                    os_clues=meta.get("os"),
                    dhcp_vendor=meta.get("dhcp_vendor")
                )
                device = Device(
                    mac=mac,
                    ipv4=ip,
                    vendor=resolved_vendor,
                    name=name or f"{resolved_vendor or 'Device'}-{mac[-5:].replace(':', '')}",
                    interface=interface,
                    status=DeviceStatus.ONLINE,
                    category=classification["category"],
                    icon=classification["icon"],
                    first_seen=now,
                    last_seen=now,
                    locked_fields=[],
                    custom_properties={"source": source_type, "ip_history": [ip] if ip else [], **meta}
                )
                self.db.add(device)
                await self.db.flush()

                # Generate NEW_DEVICE_DETECTED event
                new_dev_evt = NetworkEvent(
                    device_id=device.id,
                    event_type="NEW_DEVICE_DETECTED",
                    severity=EventSeverity.WARNING,
                    payload={"mac": mac, "ip": ip, "vendor": vendor, "name": name, "source": source_type},
                    timestamp=now
                )
                self.db.add(new_dev_evt)
                processed_events.append({"event": "NEW_DEVICE_DETECTED", "mac": mac, "device_id": str(device.id)})

                # Start initial session
                session = DeviceSession(
                    device_id=device.id,
                    session_start=now,
                    is_active=True
                )
                self.db.add(session)

            else:
                # Existing device: Check state changes
                old_ip = device.ipv4
                old_status = device.status

                # IP Changed Detection
                if ip and old_ip and ip != old_ip:
                    ip_change_evt = NetworkEvent(
                        device_id=device.id,
                        event_type="IP_CHANGED",
                        severity=EventSeverity.INFO,
                        payload={"mac": mac, "old_ip": old_ip, "new_ip": ip},
                        timestamp=now
                    )
                    self.db.add(ip_change_evt)
                    processed_events.append({"event": "IP_CHANGED", "mac": mac, "old_ip": old_ip, "new_ip": ip})

                    # Maintain IP history in custom_properties
                    ip_history = device.custom_properties.get("ip_history", [])
                    if old_ip not in ip_history:
                        ip_history.append(old_ip)
                    device.custom_properties = {**device.custom_properties, "ip_history": ip_history}

                # Connection Event Detection
                if old_status == DeviceStatus.OFFLINE:
                    reconnect_evt = NetworkEvent(
                        device_id=device.id,
                        event_type="DEVICE_CONNECTED",
                        severity=EventSeverity.INFO,
                        payload={"mac": mac, "ip": ip, "reconnected_at": now.isoformat()},
                        timestamp=now
                    )
                    self.db.add(reconnect_evt)
                    processed_events.append({"event": "DEVICE_CONNECTED", "mac": mac})

                    # Start new active session
                    new_session = DeviceSession(
                        device_id=device.id,
                        session_start=now,
                        is_active=True
                    )
                    self.db.add(new_session)

                # Ensure active session exists
                sess_res = await self.db.execute(
                    select(DeviceSession).where(
                        DeviceSession.device_id == device.id,
                        DeviceSession.is_active == True
                    )
                )
                active_session = sess_res.scalars().first()
                if not active_session:
                    active_session = DeviceSession(
                        device_id=device.id,
                        session_start=now,
                        is_active=True
                    )
                    self.db.add(active_session)

                # Update Device Attributes respecting locked fields
                locked = set(device.locked_fields or [])
                if ip:
                    device.ipv4 = ip
                if vendor and not device.vendor:
                    device.vendor = vendor
                if name and "name" not in locked:
                    device.name = name
                if interface:
                    device.interface = interface
                device.status = DeviceStatus.ONLINE
                device.last_seen = now

            # Update Presence History (24-bit Hourly Bitmap)
            await self._update_presence_bitmap(device.id, now)

        await self.db.commit()
        return processed_events

    async def _update_presence_bitmap(self, device_id, timestamp: datetime):
        """
        Updates the 24-bit compact hourly presence bitmap for the device for the given day.
        Bit 0 = 00:00, Bit 23 = 23:00.
        """
        day_date = datetime(timestamp.year, timestamp.month, timestamp.day, tzinfo=timezone.utc)
        hour = timestamp.hour # 0 to 23

        result = await self.db.execute(
            select(PresenceHistory).where(
                PresenceHistory.device_id == device_id,
                PresenceHistory.date == day_date
            )
        )
        presence = result.scalars().first()

        bit_mask = 1 << hour

        if not presence:
            presence = PresenceHistory(
                device_id=device_id,
                date=day_date,
                hourly_bitmap=bit_mask
            )
            self.db.add(presence)
        else:
            presence.hourly_bitmap = presence.hourly_bitmap | bit_mask

    async def close_inactive_sessions(self, timeout_minutes: int = 15) -> int:
        """
        Closes active sessions for devices that haven't been seen within the timeout window.
        Marks device status as OFFLINE and emits DEVICE_DISCONNECTED.
        """
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(DeviceSession).where(DeviceSession.is_active == True)
        )
        active_sessions = result.scalars().all()
        closed_count = 0

        for session in active_sessions:
            dev_res = await self.db.execute(select(Device).where(Device.id == session.device_id))
            device = dev_res.scalars().first()
            if not device:
                continue

            delta_sec = (now - device.last_seen).total_seconds()
            if delta_sec > (timeout_minutes * 60):
                # Mark session closed
                session.is_active = False
                session.session_end = now
                device.status = DeviceStatus.OFFLINE

                disconnect_evt = NetworkEvent(
                    device_id=device.id,
                    event_type="DEVICE_DISCONNECTED",
                    severity=EventSeverity.INFO,
                    payload={"mac": device.mac, "last_seen": device.last_seen.isoformat(), "timeout_min": timeout_minutes},
                    timestamp=now
                )
                self.db.add(disconnect_evt)
                closed_count += 1

        if closed_count > 0:
            await self.db.commit()

        return closed_count
