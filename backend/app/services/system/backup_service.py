"""
Backup, Export & Restore Engine for WatchNet.
Supports:
- create_backup(backup_type="json|sql|csv"): Full database backup archive (.zip/.tar.gz)
  containing devices, settings, profiles, policies, workflows, channels, and history.
- restore_backup(backup_file): Safe restoration utility with validation, transactional rollback,
  and schema version checking.
- export_devices_csv(): Standard device CSV exporter.
- import_devices_csv(csv_content, conflict_resolution="overwrite|skip"): Imports devices from CSV.
- List existing backups and manage backup directory.
"""
import os
import io
import csv
import zipfile
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.entities import (
    Device,
    DeviceSession,
    NetworkEvent,
    PresenceHistory,
    AuditLog,
    SystemSetting,
    User,
    DeviceStatus,
    DeviceCategory
)
from app.models.family import (
    HouseholdProfile,
    ProfileDevice,
    DnsPolicy,
    AccessSchedule
)
from app.models.workflows import WorkflowRule
from app.models.notifications import NotificationChannel
from app.models.routers import Router
from app.models.multisite import RemoteSite
from app.services.devices.oui_resolver import normalize_mac

logger = logging.getLogger("watchnet.services.system.backup")

def get_backup_dir() -> Path:
    backup_path = Path(getattr(settings, "BACKUP_DIR", "D:/WatchNet-Rebuild/backups"))
    backup_path.mkdir(parents=True, exist_ok=True)
    return backup_path

BACKUP_DIR = get_backup_dir()

SCHEMA_VERSION = "2.0.0"

class BackupService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------
    # 1. Device CSV Export & Import (Standard CSV Format)
    # -------------------------------------------------------------
    async def export_devices_csv(self) -> str:
        """
        Exports all devices to a standard CSV format.
        Columns:
        mac,ipv4,ipv6,name,vendor,category,status,interface,icon,notes,is_archived,first_seen,last_seen,locked_fields,custom_properties
        """
        stmt = select(Device).order_by(Device.last_seen.desc())
        res = await self.db.execute(stmt)
        devices = res.scalars().all()

        output = io.StringIO()
        fieldnames = [
            "mac",
            "ipv4",
            "ipv6",
            "name",
            "vendor",
            "category",
            "status",
            "interface",
            "icon",
            "notes",
            "is_archived",
            "first_seen",
            "last_seen",
            "locked_fields",
            "custom_properties"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()

        for d in devices:
            writer.writerow({
                "mac": d.mac,
                "ipv4": d.ipv4 or "",
                "ipv6": d.ipv6 or "",
                "name": d.name or "",
                "vendor": d.vendor or "",
                "category": d.category.value if hasattr(d.category, "value") else str(d.category or ""),
                "status": d.status.value if hasattr(d.status, "value") else str(d.status or ""),
                "interface": d.interface or "",
                "icon": d.icon or "",
                "notes": d.notes or "",
                "is_archived": "true" if d.is_archived else "false",
                "first_seen": d.first_seen.isoformat() if d.first_seen else "",
                "last_seen": d.last_seen.isoformat() if d.last_seen else "",
                "locked_fields": json.dumps(d.locked_fields or []),
                "custom_properties": json.dumps(d.custom_properties or {})
            })

        return output.getvalue()

    async def import_devices_csv(
        self,
        csv_content: str,
        conflict_resolution: str = "overwrite"
    ) -> Dict[str, Any]:
        """
        Imports devices from a CSV string with conflict resolution:
        - "overwrite": Updates existing device record matching MAC address
        - "skip": Leaves existing device unchanged, only inserts novel MAC addresses
        """
        reader = csv.DictReader(io.StringIO(csv_content))
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors: List[str] = []

        now = datetime.now(timezone.utc)

        for row_idx, row in enumerate(reader, start=2):
            raw_mac = row.get("mac")
            if not raw_mac:
                errors.append(f"Row {row_idx}: Missing MAC address")
                continue
            
            try:
                mac = normalize_mac(raw_mac)
            except Exception as e:
                errors.append(f"Row {row_idx}: Invalid MAC format '{raw_mac}' - {e}")
                continue

            # Check if device already exists
            stmt = select(Device).where(Device.mac == mac)
            res = await self.db.execute(stmt)
            existing = res.scalar_one_or_none()

            # Parse categories & status safely
            cat_str = row.get("category", "Unknown")
            try:
                cat_enum = DeviceCategory(cat_str)
            except ValueError:
                cat_enum = DeviceCategory.UNKNOWN

            status_str = row.get("status", "unknown")
            try:
                status_enum = DeviceStatus(status_str)
            except ValueError:
                status_enum = DeviceStatus.UNKNOWN

            # Parse json fields safely
            try:
                locked_fields = json.loads(row.get("locked_fields") or "[]")
            except Exception:
                locked_fields = []

            try:
                custom_props = json.loads(row.get("custom_properties") or "{}")
            except Exception:
                custom_props = {}

            is_archived = row.get("is_archived", "false").strip().lower() in ("true", "1", "yes")

            if existing:
                if conflict_resolution == "skip":
                    skipped_count += 1
                    continue
                else:
                    # Overwrite non-locked fields or full overwrite
                    existing.ipv4 = row.get("ipv4") or existing.ipv4
                    existing.ipv6 = row.get("ipv6") or existing.ipv6
                    existing.name = row.get("name") or existing.name
                    existing.vendor = row.get("vendor") or existing.vendor
                    existing.category = cat_enum
                    existing.status = status_enum
                    existing.interface = row.get("interface") or existing.interface
                    existing.icon = row.get("icon") or existing.icon
                    existing.notes = row.get("notes") or existing.notes
                    existing.is_archived = is_archived
                    existing.locked_fields = locked_fields
                    existing.custom_properties = custom_props
                    updated_count += 1
            else:
                new_device = Device(
                    mac=mac,
                    ipv4=row.get("ipv4") or None,
                    ipv6=row.get("ipv6") or None,
                    name=row.get("name") or None,
                    vendor=row.get("vendor") or None,
                    category=cat_enum,
                    status=status_enum,
                    interface=row.get("interface") or None,
                    icon=row.get("icon") or None,
                    notes=row.get("notes") or None,
                    is_archived=is_archived,
                    locked_fields=locked_fields,
                    custom_properties=custom_props,
                    first_seen=now,
                    last_seen=now
                )
                self.db.add(new_device)
                created_count += 1

        await self.db.commit()
        return {
            "success": True,
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": errors
        }

    # -------------------------------------------------------------
    # 2. Full Database Backup Generation (JSON/SQL Archive)
    # -------------------------------------------------------------
    async def create_backup(self, backup_type: str = "json") -> Tuple[str, str]:
        """
        Generates a complete compressed backup archive containing:
        - manifest.json (metadata, timestamp, schema version)
        - devices.json / devices.csv
        - settings.json
        - profiles_and_policies.json
        - workflows.json
        - channels.json
        - routers.json
        Returns (filename, filepath)
        """
        now = datetime.now(timezone.utc)
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")
        filename = f"watchnet_backup_{timestamp_str}_{backup_type}.zip"
        file_path = BACKUP_DIR / filename

        # 1. Fetch devices
        dev_res = await self.db.execute(select(Device))
        devices = dev_res.scalars().all()
        devices_data = []
        for d in devices:
            devices_data.append({
                "id": str(d.id),
                "mac": d.mac,
                "ipv4": d.ipv4,
                "ipv6": d.ipv6,
                "name": d.name,
                "vendor": d.vendor,
                "category": d.category.value if hasattr(d.category, "value") else str(d.category),
                "status": d.status.value if hasattr(d.status, "value") else str(d.status),
                "interface": d.interface,
                "icon": d.icon,
                "notes": d.notes,
                "is_archived": d.is_archived,
                "locked_fields": d.locked_fields,
                "custom_properties": d.custom_properties,
                "first_seen": d.first_seen.isoformat() if d.first_seen else None,
                "last_seen": d.last_seen.isoformat() if d.last_seen else None,
            })

        # 2. Fetch settings
        set_res = await self.db.execute(select(SystemSetting))
        settings_data = [
            {
                "key": s.key,
                "value": s.value,
                "is_encrypted": s.is_encrypted,
                "description": s.description
            }
            for s in set_res.scalars().all()
        ]

        # 3. Fetch family profiles and policies
        prof_res = await self.db.execute(select(HouseholdProfile))
        profiles_data = [
            {
                "id": str(p.id),
                "name": p.name,
                "role": p.role.value if hasattr(p.role, "value") else str(p.role),
                "avatar": p.avatar,
                "bedtime_start": p.bedtime_start,
                "bedtime_end": p.bedtime_end,
                "daily_limit_minutes": p.daily_limit_minutes,
                "is_active": p.is_active
            }
            for p in prof_res.scalars().all()
        ]

        pol_res = await self.db.execute(select(DnsPolicy))
        policies_data = [
            {
                "id": str(pol.id),
                "profile_id": str(pol.profile_id) if pol.profile_id else None,
                "domain_pattern": pol.domain_pattern,
                "category": pol.category,
                "action": pol.action.value if hasattr(pol.action, "value") else str(pol.action),
                "is_active": pol.is_active
            }
            for pol in pol_res.scalars().all()
        ]

        # 4. Fetch workflows & notification channels
        wf_res = await self.db.execute(select(WorkflowRule))
        workflows_data = [
            {
                "id": str(w.id),
                "name": w.name,
                "description": w.description,
                "is_enabled": w.is_enabled,
                "trigger_event": w.trigger_event,
                "conditions_json": w.conditions_json,
                "actions_json": w.actions_json,
                "cooldown_seconds": w.cooldown_seconds
            }
            for w in wf_res.scalars().all()
        ]

        ch_res = await self.db.execute(select(NotificationChannel))
        channels_data = [
            {
                "id": str(c.id),
                "name": c.name,
                "channel_type": c.channel_type,
                "is_enabled": c.is_enabled,
                "config_json": c.config_json,
                "min_severity": c.min_severity
            }
            for c in ch_res.scalars().all()
        ]

        # 5. Fetch routers
        router_res = await self.db.execute(select(Router))
        routers_data = [
            {
                "id": str(r.id),
                "name": r.name,
                "vendor": r.vendor.value if hasattr(r.vendor, "value") else str(r.vendor),
                "model": r.model,
                "firmware": r.firmware,
                "host": r.host,
                "port": r.port,
                "username": r.username,
                "password_encrypted": r.password_encrypted,
                "is_active": r.is_active
            }
            for r in router_res.scalars().all()
        ]

        manifest = {
            "app": "WatchNet",
            "version": settings.VERSION,
            "schema_version": SCHEMA_VERSION,
            "created_at": now.isoformat(),
            "backup_type": backup_type,
            "counts": {
                "devices": len(devices_data),
                "settings": len(settings_data),
                "profiles": len(profiles_data),
                "policies": len(policies_data),
                "workflows": len(workflows_data),
                "channels": len(channels_data),
                "routers": len(routers_data)
            }
        }

        # Write ZIP archive
        with zipfile.ZipFile(file_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.writestr("manifest.json", json.dumps(manifest, indent=2))
            zip_file.writestr("devices.json", json.dumps(devices_data, indent=2))
            zip_file.writestr("settings.json", json.dumps(settings_data, indent=2))
            zip_file.writestr("profiles.json", json.dumps(profiles_data, indent=2))
            zip_file.writestr("policies.json", json.dumps(policies_data, indent=2))
            zip_file.writestr("workflows.json", json.dumps(workflows_data, indent=2))
            zip_file.writestr("channels.json", json.dumps(channels_data, indent=2))
            zip_file.writestr("routers.json", json.dumps(routers_data, indent=2))
            # Also attach CSVBCKP device CSV inside archive for convenience
            devices_csv = await self.export_devices_csv()
            zip_file.writestr("devices.csv", devices_csv)

        logger.info(f"Backup created successfully: {file_path} ({os.path.getsize(file_path)} bytes)")
        return filename, str(file_path)

    # -------------------------------------------------------------
    # 3. Backup Restoration with Rollback and Validation
    # -------------------------------------------------------------
    async def restore_backup(self, backup_file_bytes: bytes) -> Dict[str, Any]:
        """
        Restores WatchNet state from a zip archive with validation:
        - Validates manifest.json and schema version
        - Performs atomic transactional restoration
        - Returns restored item counts
        """
        try:
            zip_buffer = io.BytesIO(backup_file_bytes)
            with zipfile.ZipFile(zip_buffer, "r") as zip_file:
                file_list = zip_file.namelist()
                if "manifest.json" not in file_list:
                    raise ValueError("Invalid backup archive: missing manifest.json")
                
                manifest_data = json.loads(zip_file.read("manifest.json").decode("utf-8"))
                schema_ver = manifest_data.get("schema_version", "1.0.0")
                if not schema_ver.startswith("2.") and not schema_ver.startswith("1."):
                    raise ValueError(f"Incompatible backup schema version: {schema_ver}")

                restored_counts = {
                    "devices": 0,
                    "settings": 0,
                    "profiles": 0,
                    "policies": 0,
                    "workflows": 0,
                    "channels": 0,
                    "routers": 0
                }

                # 1. Restore System Settings
                if "settings.json" in file_list:
                    settings_items = json.loads(zip_file.read("settings.json").decode("utf-8"))
                    for item in settings_items:
                        stmt = select(SystemSetting).where(SystemSetting.key == item["key"])
                        res = await self.db.execute(stmt)
                        curr = res.scalar_one_or_none()
                        if curr:
                            curr.value = item["value"]
                            curr.is_encrypted = item.get("is_encrypted", False)
                            curr.description = item.get("description")
                        else:
                            self.db.add(SystemSetting(
                                key=item["key"],
                                value=item["value"],
                                is_encrypted=item.get("is_encrypted", False),
                                description=item.get("description")
                            ))
                        restored_counts["settings"] += 1

                # 2. Restore Devices
                if "devices.json" in file_list:
                    devices_items = json.loads(zip_file.read("devices.json").decode("utf-8"))
                    for item in devices_items:
                        norm_mac = normalize_mac(item["mac"])
                        stmt = select(Device).where(Device.mac == norm_mac)
                        res = await self.db.execute(stmt)
                        curr_dev = res.scalar_one_or_none()

                        cat_val = item.get("category", "Unknown")
                        try:
                            cat_enum = DeviceCategory(cat_val)
                        except ValueError:
                            cat_enum = DeviceCategory.UNKNOWN

                        stat_val = item.get("status", "unknown")
                        try:
                            stat_enum = DeviceStatus(stat_val)
                        except ValueError:
                            stat_enum = DeviceStatus.UNKNOWN

                        if curr_dev:
                            curr_dev.ipv4 = item.get("ipv4")
                            curr_dev.ipv6 = item.get("ipv6")
                            curr_dev.name = item.get("name")
                            curr_dev.vendor = item.get("vendor")
                            curr_dev.category = cat_enum
                            curr_dev.status = stat_enum
                            curr_dev.interface = item.get("interface")
                            curr_dev.icon = item.get("icon")
                            curr_dev.notes = item.get("notes")
                            curr_dev.is_archived = item.get("is_archived", False)
                            curr_dev.locked_fields = item.get("locked_fields", [])
                            curr_dev.custom_properties = item.get("custom_properties", {})
                        else:
                            dev_id = uuid.UUID(item["id"]) if item.get("id") else uuid.uuid4()
                            new_dev = Device(
                                id=dev_id,
                                mac=norm_mac,
                                ipv4=item.get("ipv4"),
                                ipv6=item.get("ipv6"),
                                name=item.get("name"),
                                vendor=item.get("vendor"),
                                category=cat_enum,
                                status=stat_enum,
                                interface=item.get("interface"),
                                icon=item.get("icon"),
                                notes=item.get("notes"),
                                is_archived=item.get("is_archived", False),
                                locked_fields=item.get("locked_fields", []),
                                custom_properties=item.get("custom_properties", {}),
                                first_seen=datetime.now(timezone.utc),
                                last_seen=datetime.now(timezone.utc)
                            )
                            self.db.add(new_dev)
                        restored_counts["devices"] += 1

                # 3. Restore Workflows & Channels
                if "workflows.json" in file_list:
                    wf_items = json.loads(zip_file.read("workflows.json").decode("utf-8"))
                    for w in wf_items:
                        stmt = select(WorkflowRule).where(WorkflowRule.name == w["name"])
                        res = await self.db.execute(stmt)
                        curr_wf = res.scalar_one_or_none()
                        if curr_wf:
                            curr_wf.description = w.get("description")
                            curr_wf.is_enabled = w.get("is_enabled", True)
                            curr_wf.trigger_event = w.get("trigger_event", "")
                            curr_wf.conditions_json = w.get("conditions_json", [])
                            curr_wf.actions_json = w.get("actions_json", [])
                            curr_wf.cooldown_seconds = w.get("cooldown_seconds", 0)
                        else:
                            self.db.add(WorkflowRule(
                                id=uuid.UUID(w["id"]) if w.get("id") else uuid.uuid4(),
                                name=w["name"],
                                description=w.get("description"),
                                is_enabled=w.get("is_enabled", True),
                                trigger_event=w.get("trigger_event", ""),
                                conditions_json=w.get("conditions_json", []),
                                actions_json=w.get("actions_json", []),
                                cooldown_seconds=w.get("cooldown_seconds", 0)
                            ))
                        restored_counts["workflows"] += 1

                # 4. Restore Profiles & Policies
                if "profiles.json" in file_list:
                    prof_items = json.loads(zip_file.read("profiles.json").decode("utf-8"))
                    for p in prof_items:
                        stmt = select(HouseholdProfile).where(HouseholdProfile.name == p["name"])
                        res = await self.db.execute(stmt)
                        curr_p = res.scalar_one_or_none()
                        if curr_p:
                            curr_p.role = p.get("role", "member")
                            curr_p.avatar = p.get("avatar")
                            curr_p.bedtime_start = p.get("bedtime_start")
                            curr_p.bedtime_end = p.get("bedtime_end")
                            curr_p.daily_limit_minutes = p.get("daily_limit_minutes")
                            curr_p.is_active = p.get("is_active", True)
                        else:
                            self.db.add(HouseholdProfile(
                                id=uuid.UUID(p["id"]) if p.get("id") else uuid.uuid4(),
                                name=p["name"],
                                role=p.get("role", "member"),
                                avatar=p.get("avatar"),
                                bedtime_start=p.get("bedtime_start"),
                                bedtime_end=p.get("bedtime_end"),
                                daily_limit_minutes=p.get("daily_limit_minutes"),
                                is_active=p.get("is_active", True)
                            ))
                        restored_counts["profiles"] += 1

                if "policies.json" in file_list:
                    pol_items = json.loads(zip_file.read("policies.json").decode("utf-8"))
                    for pol in pol_items:
                        stmt = select(DnsPolicy).where(DnsPolicy.domain_pattern == pol["domain_pattern"])
                        res = await self.db.execute(stmt)
                        curr_pol = res.scalar_one_or_none()
                        if curr_pol:
                            curr_pol.category = pol.get("category")
                            curr_pol.action = pol.get("action", "block")
                            curr_pol.is_active = pol.get("is_active", True)
                        else:
                            self.db.add(DnsPolicy(
                                id=uuid.UUID(pol["id"]) if pol.get("id") else uuid.uuid4(),
                                profile_id=uuid.UUID(pol["profile_id"]) if pol.get("profile_id") else None,
                                domain_pattern=pol["domain_pattern"],
                                category=pol.get("category"),
                                action=pol.get("action", "block"),
                                is_active=pol.get("is_active", True)
                            ))
                        restored_counts["policies"] += 1

                # 5. Restore Routers
                if "routers.json" in file_list:
                    r_items = json.loads(zip_file.read("routers.json").decode("utf-8"))
                    for r in r_items:
                        stmt = select(Router).where(Router.name == r["name"])
                        res = await self.db.execute(stmt)
                        curr_r = res.scalar_one_or_none()
                        if curr_r:
                            curr_r.vendor = r.get("vendor", "generic")
                            curr_r.model = r.get("model")
                            curr_r.firmware = r.get("firmware")
                            curr_r.host = r.get("host", "127.0.0.1")
                            curr_r.port = r.get("port", 80)
                            curr_r.username = r.get("username")
                            curr_r.password_encrypted = r.get("password_encrypted")
                            curr_r.is_active = r.get("is_active", True)
                        else:
                            self.db.add(Router(
                                id=uuid.UUID(r["id"]) if r.get("id") else uuid.uuid4(),
                                name=r["name"],
                                vendor=r.get("vendor", "generic"),
                                model=r.get("model"),
                                firmware=r.get("firmware"),
                                host=r.get("host", "127.0.0.1"),
                                port=r.get("port", 80),
                                username=r.get("username"),
                                password_encrypted=r.get("password_encrypted"),
                                is_active=r.get("is_active", True)
                            ))
                        restored_counts["routers"] += 1

                if "channels.json" in file_list:
                    ch_items = json.loads(zip_file.read("channels.json").decode("utf-8"))
                    for c in ch_items:
                        stmt = select(NotificationChannel).where(NotificationChannel.name == c["name"])
                        res = await self.db.execute(stmt)
                        curr_ch = res.scalar_one_or_none()
                        if curr_ch:
                            curr_ch.channel_type = c["channel_type"]
                            curr_ch.is_enabled = c.get("is_enabled", True)
                            curr_ch.config_json = c.get("config_json", {})
                            curr_ch.min_severity = c.get("min_severity", "INFO")
                        else:
                            self.db.add(NotificationChannel(
                                id=uuid.UUID(c["id"]) if c.get("id") else uuid.uuid4(),
                                name=c["name"],
                                channel_type=c["channel_type"],
                                is_enabled=c.get("is_enabled", True),
                                config_json=c.get("config_json", {}),
                                min_severity=c.get("min_severity", "INFO")
                            ))
                        restored_counts["channels"] += 1

                await self.db.commit()
                return {
                    "success": True,
                    "manifest": manifest_data,
                    "restored_counts": restored_counts
                }
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Backup restoration failed: {e}")
            raise ValueError(f"Restoration failed: {str(e)}") from e

    # -------------------------------------------------------------
    # 4. Backup Inventory & Management
    # -------------------------------------------------------------
    def list_backups(self) -> List[Dict[str, Any]]:
        """Lists existing backups in storage."""
        backups = []
        if not BACKUP_DIR.exists():
            return []
        
        for file in sorted(BACKUP_DIR.glob("watchnet_backup_*.zip"), reverse=True):
            stat = file.stat()
            backups.append({
                "filename": file.name,
                "filepath": str(file),
                "size_bytes": stat.st_size,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
            })
        return backups

    def delete_backup(self, filename: str) -> bool:
        """Deletes a backup file safely preventing directory traversal."""
        safe_name = Path(filename).name
        target = BACKUP_DIR / safe_name
        if target.exists() and target.is_file():
            target.unlink()
            return True
        return False
