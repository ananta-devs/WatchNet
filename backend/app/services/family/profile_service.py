import uuid
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.models.family import HouseholdProfile, ProfileDevice, ProfileRole
from app.models.entities import Device

logger = logging.getLogger(__name__)

class ProfileService:
    """
    Household profile management service:
    Handles profiles (Adult, Child, Teen, Guest), device assignments, and internet pause toggles.
    """

    @staticmethod
    async def list_profiles(db: AsyncSession) -> List[HouseholdProfile]:
        result = await db.execute(
            select(HouseholdProfile)
            .options(
                selectinload(HouseholdProfile.devices).selectinload(ProfileDevice.device),
                selectinload(HouseholdProfile.policies),
                selectinload(HouseholdProfile.schedules)
            )
            .order_by(HouseholdProfile.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_profile(db: AsyncSession, profile_id: uuid.UUID) -> Optional[HouseholdProfile]:
        result = await db.execute(
            select(HouseholdProfile)
            .options(
                selectinload(HouseholdProfile.devices).selectinload(ProfileDevice.device),
                selectinload(HouseholdProfile.policies),
                selectinload(HouseholdProfile.schedules)
            )
            .where(HouseholdProfile.id == profile_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_profile(
        db: AsyncSession,
        name: str,
        role: str = ProfileRole.CHILD.value,
        avatar: Optional[str] = None
    ) -> HouseholdProfile:
        profile = HouseholdProfile(
            name=name,
            role=role,
            avatar=avatar or "smile"
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        return profile

    @staticmethod
    async def update_profile(
        db: AsyncSession,
        profile_id: uuid.UUID,
        name: Optional[str] = None,
        role: Optional[str] = None,
        avatar: Optional[str] = None
    ) -> Optional[HouseholdProfile]:
        profile = await ProfileService.get_profile(db, profile_id)
        if not profile:
            return None
        if name is not None:
            profile.name = name
        if role is not None:
            profile.role = role
        if avatar is not None:
            profile.avatar = avatar
        await db.commit()
        await db.refresh(profile)
        return profile

    @staticmethod
    async def toggle_pause(
        db: AsyncSession,
        profile_id: uuid.UUID,
        paused: bool,
        duration_minutes: Optional[int] = None
    ) -> Optional[HouseholdProfile]:
        profile = await ProfileService.get_profile(db, profile_id)
        if not profile:
            return None

        profile.is_paused = paused
        if paused and duration_minutes:
            profile.pause_until = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
        else:
            profile.pause_until = None

        await db.commit()
        await db.refresh(profile)
        return profile

    @staticmethod
    async def assign_device(
        db: AsyncSession,
        profile_id: uuid.UUID,
        device_id: uuid.UUID
    ) -> ProfileDevice:
        # Check if already assigned
        existing = await db.execute(
            select(ProfileDevice).where(
                ProfileDevice.profile_id == profile_id,
                ProfileDevice.device_id == device_id
            )
        )
        found = existing.scalar_one_or_none()
        if found:
            return found

        assoc = ProfileDevice(
            profile_id=profile_id,
            device_id=device_id
        )
        db.add(assoc)
        await db.commit()
        await db.refresh(assoc)
        return assoc

    @staticmethod
    async def unassign_device(
        db: AsyncSession,
        profile_id: uuid.UUID,
        device_id: uuid.UUID
    ) -> bool:
        result = await db.execute(
            delete(ProfileDevice).where(
                ProfileDevice.profile_id == profile_id,
                ProfileDevice.device_id == device_id
            )
        )
        await db.commit()
        return result.rowcount > 0

