import hashlib
import secrets
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.multisite import RemoteSite, SiteSyncLog
from app.models.entities import Device, DeviceStatus, DeviceCategory
from app.services.discovery.ingest_service import DeviceIngestionService

logger = logging.getLogger("watchnet.multisite.sync")


def hash_api_key(api_key: str) -> str:
    """Hash an API key using SHA-256 for secure DB storage."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


class MultiSiteSyncService:
    """
    Central hub synchronization service for remote Go collectors and edge nodes.
    Features:
      - Remote node registration with cryptographically secure API key generation
      - API key verification & authentication
      - Batch discovery ingestion with site tagging and device count tracking
      - Node status and sync audit logging
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_site(self, name: str, location: Optional[str] = None, interface: Optional[str] = None) -> Tuple[RemoteSite, str]:
        """
        Registers a new remote site node and returns (RemoteSite, raw_api_key).
        Raw API key is returned ONLY once during registration.
        """
        clean_name = name.strip()
        # Check existing
        stmt = select(RemoteSite).where(RemoteSite.name == clean_name)
        res = await self.db.execute(stmt)
        existing = res.scalars().first()
        if existing:
            raise ValueError(f"Site with name '{clean_name}' already exists.")

        raw_api_key = f"wn_site_{secrets.token_urlsafe(32)}"
        hashed_key = hash_api_key(raw_api_key)

        site = RemoteSite(
            name=clean_name,
            location=location.strip() if location else None,
            interface=interface.strip() if interface else None,
            api_key_hash=hashed_key,
            is_active=True,
            device_count=0,
            last_seen=None
        )
        self.db.add(site)
        await self.db.commit()
        await self.db.refresh(site)

        logger.info(f"[MultiSite] Registered new remote site: {site.name} (id={site.id})")
        return site, raw_api_key

    async def authenticate_site(self, api_key: str) -> Optional[RemoteSite]:
        """Authenticate a remote site by its API key."""
        if not api_key:
            return None
        hashed = hash_api_key(api_key.strip())
        stmt = select(RemoteSite).where(RemoteSite.api_key_hash == hashed, RemoteSite.is_active == True)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def ingest_site_batch(self, site: RemoteSite, batch: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Ingest batch discovery payload from a remote site collector.
        Associates all discovered devices with the site's site_id and updates sync logs.
        """
        now = datetime.now(timezone.utc)
        site.last_seen = now

        # Tag all items in batch with site_id
        for item in batch:
            item["site_id"] = str(site.id)

        # Ingest using standard ingestion service
        ingest_service = DeviceIngestionService(self.db)
        try:
            events = await ingest_service.ingest_discovery_batch(batch, source_type=f"remote_site:{site.name}")

            # Update site device_id associations and recount devices
            # Tag devices discovered in this batch with site_id
            macs = [item.get("mac", "").lower().strip() for item in batch if item.get("mac")]
            if macs:
                dev_stmt = select(Device).where(Device.mac.in_(macs))
                dev_res = await self.db.execute(dev_stmt)
                devices = dev_res.scalars().all()
                for d in devices:
                    d.site_id = site.id

            # Update site device count
            count_stmt = select(func.count(Device.id)).where(Device.site_id == site.id, Device.is_archived == False)
            count_res = await self.db.execute(count_stmt)
            site.device_count = count_res.scalar() or len(macs)

            # Record success sync log
            sync_log = SiteSyncLog(
                site_id=site.id,
                status="SUCCESS",
                devices_synced=len(batch),
                error_message=None,
                timestamp=now
            )
            self.db.add(sync_log)
            await self.db.commit()
            await self.db.refresh(site)

            return {
                "status": "success",
                "site_id": str(site.id),
                "site_name": site.name,
                "synced_count": len(batch),
                "events_generated": len(events)
            }
        except Exception as e:
            await self.db.rollback()
            logger.error(f"[MultiSite] Sync failed for site {site.name}: {e}")
            sync_log = SiteSyncLog(
                site_id=site.id,
                status="FAILED",
                devices_synced=0,
                error_message=str(e),
                timestamp=now
            )
            self.db.add(sync_log)
            await self.db.commit()
            raise e

    async def list_nodes(self) -> List[Dict[str, Any]]:
        """
        List all registered remote sites with connection status, last seen, and device tally.
        """
        stmt = select(RemoteSite).order_by(RemoteSite.created_at.asc())
        res = await self.db.execute(stmt)
        sites = res.scalars().all()

        now = datetime.now(timezone.utc)
        result = []
        for s in sites:
            # Connection status: Online if last seen within 5 minutes
            is_online = False
            if s.last_seen:
                # Handle timezone if naive
                seen_dt = s.last_seen if s.last_seen.tzinfo else s.last_seen.replace(tzinfo=timezone.utc)
                diff = (now - seen_dt).total_seconds()
                is_online = diff < 300

            result.append({
                "id": str(s.id),
                "name": s.name,
                "location": s.location,
                "interface": s.interface,
                "is_active": s.is_active,
                "status": "ONLINE" if is_online else ("OFFLINE" if s.last_seen else "NEVER_CONNECTED"),
                "device_count": s.device_count,
                "last_seen": s.last_seen.isoformat() if s.last_seen else None,
                "created_at": s.created_at.isoformat() if s.created_at else None
            })
        return result

