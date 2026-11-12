"""
Device Service - Clean-room inventory & historical intelligence engine:
- CRUD operations for devices
- Custom properties (key-value metadata tags)
- Field lock/unlock mechanism (preventing automated scans from overwriting user-customized names, categories, or icons)
- Bulk editing (mass-tagging, mass-categorization, mass-archival)
- Device archiving (soft delete / active toggle)
- Device history queries: IP change logs, MAC change history, session durations, and hourly presence timeline extraction.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import select, update, delete, and_, or_, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entities import (
    Device,
    DeviceStatus,
    DeviceCategory,
    DeviceSession,
    NetworkEvent,
    PresenceHistory,
    EventSeverity
)
from app.services.devices.oui_resolver import oui_resolver, normalize_mac
from app.services.devices.classifier import device_classifier

logger = logging.getLogger("watchnet.services.devices")


class DeviceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_device_by_id(self, device_id: uuid.UUID) -> Optional[Device]:
        stmt = select(Device).where(Device.id == device_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_device_by_mac(self, mac: str) -> Optional[Device]:
        norm_mac = normalize_mac(mac)
        stmt = select(Device).where(Device.mac == norm_mac)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_devices(
        self,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
        vendor: Optional[str] = None,
        ip_range: Optional[str] = None,
        site_id: Optional[uuid.UUID] = None,
        is_archived: Optional[bool] = False,
        sort_by: str = "last_seen",
        sort_desc: bool = True
    ) -> Tuple[List[Device], int]:
        """
        Paginated and filtered query of network inventory devices.
        """
        conditions = []

        if site_id is not None:
            conditions.append(Device.site_id == site_id)

        if is_archived is not None:
            conditions.append(Device.is_archived == is_archived)

        if status:
            conditions.append(Device.status == status.lower())

        if category:
            conditions.append(Device.category == category)

        if vendor:
            conditions.append(Device.vendor.ilike(f"%{vendor}%"))

        if ip_range:
            ip_range_str = ip_range.strip()
            matched_condition = None
            try:
                import ipaddress
                if "/" in ip_range_str:
                    net = ipaddress.ip_network(ip_range_str, strict=False)
                    if net.prefixlen == 24:
                        pfx = ".".join(str(net.network_address).split(".")[:3]) + "."
                        matched_condition = Device.ipv4.startswith(pfx)
                    elif net.prefixlen == 16:
                        pfx = ".".join(str(net.network_address).split(".")[:2]) + "."
                        matched_condition = Device.ipv4.startswith(pfx)
                    elif net.prefixlen == 8:
                        pfx = str(net.network_address).split(".")[0] + "."
                        matched_condition = Device.ipv4.startswith(pfx)
                    elif net.num_addresses <= 1024:
                        ips = [str(ip) for ip in net]
                        matched_condition = Device.ipv4.in_(ips)
                elif "-" in ip_range_str:
                    s_ip, e_ip = ip_range_str.split("-", 1)
                    start_addr = ipaddress.ip_address(s_ip.strip())
                    end_addr = ipaddress.ip_address(e_ip.strip())
                    if 0 <= int(end_addr) - int(start_addr) <= 1024:
                        ips = [str(ipaddress.ip_address(i)) for i in range(int(start_addr), int(end_addr) + 1)]
                        matched_condition = Device.ipv4.in_(ips)
            except Exception:
                pass

            if matched_condition is not None:
                conditions.append(matched_condition)
            else:
                conditions.append(Device.ipv4.startswith(ip_range_str))

        if search:
            pattern = f"%{search}%"
            conditions.append(
                or_(
                    Device.mac.ilike(pattern),
                    Device.ipv4.ilike(pattern),
                    Device.name.ilike(pattern),
                    Device.vendor.ilike(pattern),
                )
            )

        # Build order by
        order_col = getattr(Device, sort_by, Device.last_seen)
        order_expr = order_col.desc() if sort_desc else order_col.asc()

        stmt = select(Device)
        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.order_by(order_expr).offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        devices = res.scalars().all()

        count_stmt = select(func.count(Device.id))
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
        count_res = await self.db.execute(count_stmt)
        total_count = count_res.scalar_one() or 0

        return list(devices), total_count

    async def update_device(
        self,
        device_id: uuid.UUID,
        name: Optional[str] = None,
        category: Optional[str] = None,
        icon: Optional[str] = None,
        notes: Optional[str] = None,
        locked_fields: Optional[List[str]] = None,
        custom_properties: Optional[Dict[str, Any]] = None,
        is_archived: Optional[bool] = None
    ) -> Optional[Device]:
        """
        Update device fields. When a user manually sets name/category/icon,
        those fields can also be recorded in locked_fields.
        """
        device = await self.get_device_by_id(device_id)
        if not device:
            return None

        current_locked = set(device.locked_fields or [])

        if name is not None:
            device.name = name
            current_locked.add("name")

        if category is not None:
            # Validate enum
            try:
                device.category = DeviceCategory(category)
            except ValueError:
                device.category = DeviceCategory.UNKNOWN
            current_locked.add("category")

        if icon is not None:
            device.icon = icon
            current_locked.add("icon")

        if notes is not None:
            device.notes = notes

        if is_archived is not None:
            device.is_archived = is_archived

        if locked_fields is not None:
            device.locked_fields = list(set(locked_fields))
        else:
            device.locked_fields = list(current_locked)

        if custom_properties is not None:
            updated_props = dict(device.custom_properties or {})
            updated_props.update(custom_properties)
            device.custom_properties = updated_props

        await self.db.commit()
        await self.db.refresh(device)
        return device

    async def bulk_update(
        self,
        device_ids: List[uuid.UUID],
        category: Optional[str] = None,
        add_tags: Optional[List[str]] = None,
        remove_tags: Optional[List[str]] = None,
        is_archived: Optional[bool] = None,
        lock_category: bool = False
    ) -> int:
        """
        Batch operations across multiple devices: mass categorization, tagging, archival.
        """
        if not device_ids:
            return 0

        stmt = select(Device).where(Device.id.in_(device_ids))
        res = await self.db.execute(stmt)
        devices = res.scalars().all()

        updated_count = 0
        for dev in devices:
            modified = False

            if category is not None:
                try:
                    dev.category = DeviceCategory(category)
                except ValueError:
                    dev.category = DeviceCategory.UNKNOWN
                if lock_category:
                    lf = set(dev.locked_fields or [])
                    lf.add("category")
                    dev.locked_fields = list(lf)
                modified = True

            if is_archived is not None:
                dev.is_archived = is_archived
                modified = True

            if add_tags or remove_tags:
                props = dict(dev.custom_properties or {})
                existing_tags = set(props.get("tags", []))
                if add_tags:
                    existing_tags.update(add_tags)
                if remove_tags:
                    existing_tags.difference_update(remove_tags)
                props["tags"] = list(existing_tags)
                dev.custom_properties = props
                modified = True

            if modified:
                updated_count += 1

        if updated_count > 0:
            await self.db.commit()

        return updated_count

    async def delete_device(self, device_id: uuid.UUID, hard_delete: bool = False) -> bool:
        """
        Delete a device. Defaults to soft delete (archiving), or hard cascade delete if hard_delete=True.
        """
        device = await self.get_device_by_id(device_id)
        if not device:
            return False

        if hard_delete:
            await self.db.delete(device)
        else:
            device.is_archived = True

        await self.db.commit()
        return True

    async def apply_automated_telemetry(
        self,
        mac: str,
        ip: Optional[str] = None,
        hostname: Optional[str] = None,
        vendor: Optional[str] = None,
        interface: Optional[str] = None,
        os_clues: Optional[str] = None,
        dhcp_vendor: Optional[str] = None,
        open_ports: Optional[List[int]] = None,
        source: str = "scanner"
    ) -> Device:
        """
        Integrates automated scan observations while strictly adhering to field locks!
        """
        norm_mac = normalize_mac(mac)
        now = datetime.now(timezone.utc)
        device = await self.get_device_by_mac(norm_mac)

        if not vendor:
            vendor = oui_resolver.resolve_vendor(norm_mac)

        classification = device_classifier.classify(
            mac=norm_mac,
            hostname=hostname,
            vendor=vendor,
            os_clues=os_clues,
            dhcp_vendor=dhcp_vendor,
            open_ports=open_ports
        )

        if not device:
            # New device
            device = Device(
                mac=norm_mac,
                ipv4=ip,
                vendor=vendor,
                name=hostname or f"{vendor or 'Device'}-{norm_mac[-5:].replace(':', '')}",
                interface=interface,
                status=DeviceStatus.ONLINE,
                category=classification["category"],
                icon=classification["icon"],
                first_seen=now,
                last_seen=now,
                locked_fields=[],
                custom_properties={
                    "classification_confidence": classification["confidence"],
                    "classification_reasons": classification["reasons"],
                    "ip_history": [ip] if ip else [],
                    "source": source
                }
            )
            self.db.add(device)
            await self.db.flush()

            # Create initial session
            sess = DeviceSession(device_id=device.id, session_start=now, is_active=True)
            self.db.add(sess)

            # Create NEW_DEVICE_DETECTED event
            evt = NetworkEvent(
                device_id=device.id,
                event_type="NEW_DEVICE_DETECTED",
                severity=EventSeverity.WARNING,
                payload={"mac": norm_mac, "ip": ip, "vendor": vendor, "category": device.category.value},
                timestamp=now
            )
            self.db.add(evt)
            await self.db.commit()
            await self.db.refresh(device)
            return device

        # Existing device: respect locked fields!
        locked = set(device.locked_fields or [])

        # Update name only if NOT locked
        if hostname and "name" not in locked:
            device.name = hostname

        # Update category only if NOT locked
        if "category" not in locked and classification["confidence"] > 0.5:
            device.category = classification["category"]

        # Update icon only if NOT locked
        if "icon" not in locked:
            device.icon = classification["icon"]

        # Update vendor if missing
        if vendor and not device.vendor:
            device.vendor = vendor

        # Check IP change
        if ip and ip != device.ipv4:
            old_ip = device.ipv4
            device.ipv4 = ip
            # Track IP history
            props = dict(device.custom_properties or {})
            history = props.get("ip_history", [])
            if old_ip and old_ip not in history:
                history.append(old_ip)
            if ip not in history:
                history.append(ip)
            props["ip_history"] = history
            device.custom_properties = props

            evt = NetworkEvent(
                device_id=device.id,
                event_type="IP_CHANGED",
                severity=EventSeverity.INFO,
                payload={"mac": norm_mac, "old_ip": old_ip, "new_ip": ip},
                timestamp=now
            )
            self.db.add(evt)

        device.status = DeviceStatus.ONLINE
        device.last_seen = now
        if interface:
            device.interface = interface

        await self.db.commit()
        await self.db.refresh(device)
        return device

    async def get_device_history(self, device_id: uuid.UUID) -> Dict[str, Any]:
        """
        Returns IP change logs, session records, and network event timeline for the device.
        """
        device = await self.get_device_by_id(device_id)
        if not device:
            return {}

        # 1. Fetch sessions
        sess_stmt = (
            select(DeviceSession)
            .where(DeviceSession.device_id == device_id)
            .order_by(DeviceSession.session_start.desc())
        )
        sess_res = await self.db.execute(sess_stmt)
        sessions = sess_res.scalars().all()

        session_records = []
        for s in sessions:
            start_dt = s.session_start
            if start_dt and start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            end_dt = s.session_end
            if end_dt and end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)

            duration_sec = None
            if end_dt and start_dt:
                duration_sec = (end_dt - start_dt).total_seconds()
            elif s.is_active and start_dt:
                duration_sec = (datetime.now(timezone.utc) - start_dt).total_seconds()

            session_records.append({
                "id": str(s.id),
                "start": start_dt.isoformat() if start_dt else None,
                "end": end_dt.isoformat() if end_dt else None,
                "is_active": s.is_active,
                "duration_seconds": duration_sec
            })

        # 2. Fetch network events
        evt_stmt = (
            select(NetworkEvent)
            .where(NetworkEvent.device_id == device_id)
            .order_by(NetworkEvent.timestamp.desc())
            .limit(100)
        )
        evt_res = await self.db.execute(evt_stmt)
        events = evt_res.scalars().all()

        event_records = [
            {
                "id": e.id,
                "event_type": e.event_type,
                "severity": e.severity.value if hasattr(e.severity, "value") else str(e.severity),
                "payload": e.payload,
                "timestamp": e.timestamp.isoformat()
            }
            for e in events
        ]

        # 3. IP history
        ip_history = (device.custom_properties or {}).get("ip_history", [])
        if device.ipv4 and device.ipv4 not in ip_history:
            ip_history.append(device.ipv4)

        return {
            "device_id": str(device.id),
            "mac": device.mac,
            "ip_history": ip_history,
            "sessions": session_records,
            "events": event_records
        }

    async def get_device_presence_matrix(self, device_id: uuid.UUID, days: int = 7) -> List[Dict[str, Any]]:
        """
        Extracts 24-bit hourly presence matrix for heatmap rendering.
        Each day returns { date: YYYY-MM-DD, hourly_bitmap: int, hours: list[bool] (len 24) }
        """
        stmt = (
            select(PresenceHistory)
            .where(PresenceHistory.device_id == device_id)
            .order_by(PresenceHistory.date.desc())
            .limit(days)
        )
        res = await self.db.execute(stmt)
        records = res.scalars().all()

        results = []
        for r in records:
            bitmap = r.hourly_bitmap or 0
            # Convert 24-bit integer to list of 24 booleans
            hours = [bool((bitmap >> h) & 1) for h in range(24)]
            results.append({
                "date": r.date.strftime("%Y-%m-%d"),
                "hourly_bitmap": bitmap,
                "hours": hours
            })

        return results
