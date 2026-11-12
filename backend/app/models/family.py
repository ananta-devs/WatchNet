import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Integer,
    BigInteger,
    Enum,
    Index,
    JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class ProfileRole(str, enum.Enum):
    ADULT = "Adult"
    CHILD = "Child"
    TEEN = "Teen"
    GUEST = "Guest"

class DnsAction(str, enum.Enum):
    ALLOWED = "ALLOWED"
    BLOCKED_POLICY = "BLOCKED_POLICY"
    BLOCKED_SECURITY = "BLOCKED_SECURITY"

class HouseholdProfile(Base):
    __tablename__ = "household_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    role = Column(Enum(ProfileRole, values_callable=lambda obj: [e.value for e in obj]), default=ProfileRole.CHILD, nullable=False)
    avatar = Column(String(255), nullable=True)
    is_paused = Column(Boolean, default=False, nullable=False)
    pause_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    devices = relationship("ProfileDevice", back_populates="profile", cascade="all, delete-orphan")
    policies = relationship("DnsPolicy", back_populates="profile", cascade="all, delete-orphan")
    schedules = relationship("AccessSchedule", back_populates="profile", cascade="all, delete-orphan")
    activity_logs = relationship("DnsActivityLog", back_populates="profile", cascade="all, delete-orphan")


class ProfileDevice(Base):
    __tablename__ = "profile_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("household_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    profile = relationship("HouseholdProfile", back_populates="devices")
    device = relationship("Device")

    __table_args__ = (
        Index("ix_profile_device_unique", "profile_id", "device_id", unique=True),
    )


class DnsPolicy(Base):
    __tablename__ = "dns_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("household_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    categories_json = Column(JSON, default=list, nullable=False)  # e.g. ["Adult", "Gambling", "Social Media"]
    blocked_domains_json = Column(JSON, default=list, nullable=False) # custom blacklist
    allowed_domains_json = Column(JSON, default=list, nullable=False) # custom whitelist
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    profile = relationship("HouseholdProfile", back_populates="policies")


class AccessSchedule(Base):
    __tablename__ = "access_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("household_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False) # e.g. "Bedtime", "School Hours"
    days_of_week = Column(JSON, default=list, nullable=False) # e.g. ["mon", "tue", "wed", "thu", "fri"]
    start_time = Column(String(5), nullable=False) # "21:00"
    end_time = Column(String(5), nullable=False)   # "07:00"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    profile = relationship("HouseholdProfile", back_populates="schedules")


class DnsActivityLog(Base):
    __tablename__ = "dns_activity_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True, index=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("household_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    domain = Column(String(512), index=True, nullable=False)
    query_type = Column(String(16), default="A", nullable=False)
    action = Column(Enum(DnsAction, values_callable=lambda obj: [e.value for e in obj]), default=DnsAction.ALLOWED, index=True, nullable=False)
    category = Column(String(100), nullable=True) # e.g. "Social Media", "Adult", "Malware"
    resolver_source = Column(String(100), default="AdGuardHome", nullable=False)

    profile = relationship("HouseholdProfile", back_populates="activity_logs")
    device = relationship("Device")

