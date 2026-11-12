import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.models.family import DnsActivityLog, HouseholdProfile, ProfileDevice, DnsAction
from app.models.entities import Device
from app.services.family.dns_policy_service import DnsPolicyService

logger = logging.getLogger(__name__)

# Transparent disclosures
DISCLOSURE_NOTICE = (
    "WatchNet Family Safety analyzes transparent DNS-layer query events only. "
    "It never performs HTTPS decryption, MITM SSL snooping, or content packet inspection. "
    "Bypass vectors such as DNS-over-HTTPS (DoH), encrypted VPN tunnels, and Apple iCloud "
    "Private Relay cannot be inspected at the DNS layer unless redirected at the gateway."
)

class ActivityService:
    """
    DNS query & network activity telemetry service:
    Ingests resolver query logs from AdGuard Home / Pi-hole, correlates them to devices
    and assigned household profiles, evaluates policy actions, and serves activity telemetry.
    """

    @staticmethod
    async def log_dns_query(
        db: AsyncSession,
        domain: str,
        device_ip_or_mac: str,
        query_type: str = "A",
        resolver_source: str = "AdGuardHome"
    ) -> DnsActivityLog:
        # 1. Match device by MAC or IPv4
        dev_res = await db.execute(
            select(Device).where(
                (Device.mac == device_ip_or_mac.lower()) | (Device.ipv4 == device_ip_or_mac)
            )
        )
        device = dev_res.scalar_one_or_none()

        profile_id = None
        action = DnsAction.ALLOWED.value
        category = None

        if device:
            # 2. Check if device is assigned to a household profile
            prof_dev_res = await db.execute(
                select(ProfileDevice)
                .options(
                    selectinload(ProfileDevice.profile).selectinload(HouseholdProfile.policies),
                    selectinload(ProfileDevice.profile).selectinload(HouseholdProfile.schedules)
                )
                .where(ProfileDevice.device_id == device.id)
            )
            prof_dev = prof_dev_res.scalar_one_or_none()

            if prof_dev and prof_dev.profile:
                profile = prof_dev.profile
                profile_id = profile.id
                policy = profile.policies[0] if profile.policies else None

                # Check paused status
                is_paused = profile.is_paused
                if is_paused and profile.pause_until:
                    if datetime.now(timezone.utc) > profile.pause_until:
                        is_paused = False
                        profile.is_paused = False
                        profile.pause_until = None

                # Check bedtime schedules
                in_bedtime = False
                for sched in profile.schedules:
                    if DnsPolicyService.is_schedule_active_now(sched):
                        in_bedtime = True
                        break

                eval_result = DnsPolicyService.evaluate_domain(domain, policy, is_paused=is_paused, in_bedtime=in_bedtime)
                action = eval_result["action"]
                category = eval_result["category"]

        log_entry = DnsActivityLog(
            timestamp=datetime.now(timezone.utc),
            device_id=device.id if device else None,
            profile_id=profile_id,
            domain=domain.lower(),
            query_type=query_type,
            action=action,
            category=category,
            resolver_source=resolver_source
        )
        db.add(log_entry)
        await db.commit()
        await db.refresh(log_entry)
        return log_entry

    @staticmethod
    async def get_activity_logs(
        db: AsyncSession,
        profile_id: Optional[uuid.UUID] = None,
        device_id: Optional[uuid.UUID] = None,
        action: Optional[str] = None,
        domain_query: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[DnsActivityLog]:
        query = select(DnsActivityLog).options(
            selectinload(DnsActivityLog.profile),
            selectinload(DnsActivityLog.device)
        )

        if profile_id:
            query = query.where(DnsActivityLog.profile_id == profile_id)
        if device_id:
            query = query.where(DnsActivityLog.device_id == device_id)
        if action:
            query = query.where(DnsActivityLog.action == action)
        if domain_query:
            query = query.where(DnsActivityLog.domain.ilike(f"%{domain_query}%"))

        query = query.order_by(desc(DnsActivityLog.timestamp)).offset(offset).limit(limit)
        res = await db.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def get_analytics_summary(db: AsyncSession) -> Dict[str, Any]:
        """
        Calculates category breakdown and top blocked domains for dashboards.
        """
        all_logs_res = await db.execute(select(DnsActivityLog).limit(1000))
        logs = all_logs_res.scalars().all()

        total_queries = len(logs)
        blocked_queries = sum(1 for l in logs if l.action in ("BLOCKED_POLICY", "BLOCKED_SECURITY"))
        allowed_queries = total_queries - blocked_queries

        category_counts: Dict[str, int] = {}
        blocked_domains_counts: Dict[str, int] = {}

        for l in logs:
            if l.category:
                category_counts[l.category] = category_counts.get(l.category, 0) + 1
            if l.action in ("BLOCKED_POLICY", "BLOCKED_SECURITY"):
                blocked_domains_counts[l.domain] = blocked_domains_counts.get(l.domain, 0) + 1

        top_blocked = sorted(
            [{"domain": k, "count": v} for k, v in blocked_domains_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:5]

        return {
            "total_queries": total_queries,
            "blocked_queries": blocked_queries,
            "allowed_queries": allowed_queries,
            "category_breakdown": category_counts,
            "top_blocked_domains": top_blocked,
            "disclosure": DISCLOSURE_NOTICE
        }

