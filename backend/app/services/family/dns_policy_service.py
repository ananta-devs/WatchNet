import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.family import DnsPolicy, AccessSchedule, HouseholdProfile

logger = logging.getLogger(__name__)

# Standard categories supported across DNS resolvers (AdGuard Home / Pi-hole)
STANDARD_CATEGORIES = {
    "Adult": ["pornhub.com", "xvideos.com", "onlyfans.com", "chaturbate.com"],
    "Gambling": ["bet365.com", "pokerstars.com", "draftkings.com", "bovada.lv"],
    "Social Media": ["tiktok.com", "instagram.com", "facebook.com", "snapchat.com", "reddit.com"],
    "Malware": ["malware-domain-sample.com", "phishing-bank-fake.org", "botnet-c2.net"],
    "Gaming": ["roblox.com", "steampowered.com", "epicgames.com", "twitch.tv", "discord.com"]
}

class DnsPolicyService:
    """
    DNS Policy & Bedtime Schedule Enforcement Adapter.
    Integrates policy sync for AdGuard Home and Pi-hole client groups,
    category-based blocking, bedtime restriction evaluation, and access passes.
    """

    @staticmethod
    async def get_policies_for_profile(db: AsyncSession, profile_id: uuid.UUID) -> List[DnsPolicy]:
        res = await db.execute(select(DnsPolicy).where(DnsPolicy.profile_id == profile_id))
        return list(res.scalars().all())

    @staticmethod
    async def save_policy(
        db: AsyncSession,
        profile_id: uuid.UUID,
        name: str,
        categories: List[str],
        blocked_domains: List[str],
        allowed_domains: List[str],
        is_active: bool = True
    ) -> DnsPolicy:
        res = await db.execute(select(DnsPolicy).where(DnsPolicy.profile_id == profile_id))
        policy = res.scalar_one_or_none()
        if policy:
            policy.name = name
            policy.categories_json = categories
            policy.blocked_domains_json = [d.lower().strip() for d in blocked_domains if d.strip()]
            policy.allowed_domains_json = [d.lower().strip() for d in allowed_domains if d.strip()]
            policy.is_active = is_active
            policy.updated_at = datetime.now(timezone.utc)
        else:
            policy = DnsPolicy(
                profile_id=profile_id,
                name=name,
                categories_json=categories,
                blocked_domains_json=[d.lower().strip() for d in blocked_domains if d.strip()],
                allowed_domains_json=[d.lower().strip() for d in allowed_domains if d.strip()],
                is_active=is_active
            )
            db.add(policy)

        await db.commit()
        await db.refresh(policy)
        return policy

    @staticmethod
    async def get_schedules_for_profile(db: AsyncSession, profile_id: uuid.UUID) -> List[AccessSchedule]:
        res = await db.execute(select(AccessSchedule).where(AccessSchedule.profile_id == profile_id))
        return list(res.scalars().all())

    @staticmethod
    async def create_or_update_schedule(
        db: AsyncSession,
        profile_id: uuid.UUID,
        name: str,
        days_of_week: List[str], # e.g. ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        start_time: str,         # e.g. "21:00"
        end_time: str,           # e.g. "07:00"
        is_active: bool = True,
        schedule_id: Optional[uuid.UUID] = None
    ) -> AccessSchedule:
        if schedule_id:
            res = await db.execute(select(AccessSchedule).where(AccessSchedule.id == schedule_id))
            sched = res.scalar_one_or_none()
            if sched:
                sched.name = name
                sched.days_of_week = [d.lower() for d in days_of_week]
                sched.start_time = start_time
                sched.end_time = end_time
                sched.is_active = is_active
                await db.commit()
                await db.refresh(sched)
                return sched

        sched = AccessSchedule(
            profile_id=profile_id,
            name=name,
            days_of_week=[d.lower() for d in days_of_week],
            start_time=start_time,
            end_time=end_time,
            is_active=is_active
        )
        db.add(sched)
        await db.commit()
        await db.refresh(sched)
        return sched

    @staticmethod
    def is_schedule_active_now(schedule: AccessSchedule, current_dt: Optional[datetime] = None) -> bool:
        """
        Evaluates whether a schedule restriction (e.g. Bedtime) is currently active.
        Handles overnight spans such as 21:00 to 07:00, evaluating both:
        - The current day starting in the evening (current day >= start_time)
        - The previous day's evening bedtime spanning into the current morning (previous day <= end_time)
        """
        if not schedule.is_active:
            return False

        now = current_dt or datetime.now(timezone.utc)
        weekday_map = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        current_day_idx = now.weekday()
        current_day = weekday_map[current_day_idx]
        prev_day = weekday_map[(current_day_idx - 1) % 7]

        active_days = set(d.lower() for d in schedule.days_of_week)

        try:
            start_h, start_m = map(int, schedule.start_time.split(":"))
            end_h, end_m = map(int, schedule.end_time.split(":"))
            start_val = start_h * 60 + start_m
            end_val = end_h * 60 + end_m
            current_val = now.hour * 60 + now.minute

            if start_val <= end_val:
                # Same day range (e.g. 14:00 to 18:00)
                if current_day in active_days:
                    return start_val <= current_val <= end_val
                return False
            else:
                # Overnight range (e.g. 21:00 to 07:00)
                # Evening phase: started today
                if current_day in active_days and current_val >= start_val:
                    return True
                # Morning phase: started yesterday evening and spans into today until end_val
                if prev_day in active_days and current_val <= end_val:
                    return True
                return False
        except Exception:
            return False

    @staticmethod
    def evaluate_domain(
        domain: str,
        policy: Optional[DnsPolicy],
        is_paused: bool = False,
        in_bedtime: bool = False
    ) -> Dict[str, Any]:
        """
        Evaluates domain resolution according to policy hierarchy:
        1. Is Internet paused for profile? -> BLOCKED_POLICY
        2. Is currently inside active bedtime window? -> BLOCKED_POLICY
        3. Is domain in allowed_domains? -> ALLOWED (whitelist priority)
        4. Is domain in blocked_domains? -> BLOCKED_POLICY
        5. Does domain match category rules? -> BLOCKED_POLICY / BLOCKED_SECURITY
        6. Default -> ALLOWED
        """
        clean_domain = domain.lower().strip()

        if is_paused:
            return {
                "action": "BLOCKED_POLICY",
                "category": "Internet Paused",
                "reason": "Profile internet is paused"
            }

        if in_bedtime:
            return {
                "action": "BLOCKED_POLICY",
                "category": "Bedtime Schedule",
                "reason": "Access restricted during bedtime schedule window"
            }

        if not policy or not policy.is_active:
            return {"action": "ALLOWED", "category": None, "reason": "No policy applied"}

        # Whitelist
        for allow in policy.allowed_domains_json:
            if clean_domain == allow or clean_domain.endswith(f".{allow}"):
                return {"action": "ALLOWED", "category": "Whitelisted", "reason": f"Allowed by rule {allow}"}

        # Blacklist
        for block in policy.blocked_domains_json:
            if clean_domain == block or clean_domain.endswith(f".{block}"):
                return {"action": "BLOCKED_POLICY", "category": "Custom Blocklist", "reason": f"Blocked by rule {block}"}

        # Categories
        for cat in policy.categories_json:
            sample_domains = STANDARD_CATEGORIES.get(cat, [])
            for s in sample_domains:
                if clean_domain == s or clean_domain.endswith(f".{s}"):
                    act = "BLOCKED_SECURITY" if cat == "Malware" else "BLOCKED_POLICY"
                    return {"action": act, "category": cat, "reason": f"Category match: {cat}"}

        return {"action": "ALLOWED", "category": None, "reason": "Default allow"}

