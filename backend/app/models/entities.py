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
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class UserRole(str, enum.Enum):
    OWNER = "Owner"
    ADMINISTRATOR = "Administrator"
    OPERATOR = "Operator"
    GUARDIAN = "Guardian"
    VIEWER = "Viewer"

class DeviceStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"

class DeviceCategory(str, enum.Enum):
    MOBILE = "Mobile"
    DESKTOP_LAPTOP = "Desktop/Laptop"
    IOT_SMART_HOME = "IoT/Smart Home"
    NETWORK_INFRASTRUCTURE = "Network/Infrastructure"
    SERVER = "Server"
    GAMING_MEDIA = "Gaming/Media"
    UNKNOWN = "Unknown"

class EventSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(Enum(UserRole, values_callable=lambda obj: [e.value for e in obj]), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    audit_logs = relationship("AuditLog", back_populates="actor", cascade="all, delete-orphan")


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mac = Column(String(17), unique=True, index=True, nullable=False)
    ipv4 = Column(String(45), index=True, nullable=True)
    ipv6 = Column(String(45), nullable=True)
    vendor = Column(String(255), nullable=True)
    name = Column(String(255), nullable=True)
    interface = Column(String(50), nullable=True)
    status = Column(Enum(DeviceStatus, values_callable=lambda obj: [e.value for e in obj]), default=DeviceStatus.UNKNOWN, nullable=False)
    category = Column(Enum(DeviceCategory, values_callable=lambda obj: [e.value for e in obj]), default=DeviceCategory.UNKNOWN, nullable=False)
    icon = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, index=True, nullable=False)
    locked_fields = Column(JSON, default=list, nullable=False)
    first_seen = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_seen = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    custom_properties = Column(JSON, default=dict, nullable=False)
    site_id = Column(UUID(as_uuid=True), ForeignKey("remote_sites.id", ondelete="SET NULL"), nullable=True, index=True)

    site = relationship("RemoteSite", back_populates="devices")
    sessions = relationship("DeviceSession", back_populates="device", cascade="all, delete-orphan")
    presence_history = relationship("PresenceHistory", back_populates="device", cascade="all, delete-orphan")
    events = relationship("NetworkEvent", back_populates="device")
    ports = relationship("DevicePortScan", back_populates="device", cascade="all, delete-orphan")


class DeviceSession(Base):
    __tablename__ = "device_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), index=True, nullable=False)
    session_start = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    session_end = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, index=True, nullable=False)

    device = relationship("Device", back_populates="sessions")


class NetworkEvent(Base):
    __tablename__ = "network_events"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    severity = Column(Enum(EventSeverity, values_callable=lambda obj: [e.value for e in obj]), default=EventSeverity.INFO, nullable=False)
    payload = Column(JSON, default=dict, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)

    device = relationship("Device", back_populates="events")


class PresenceHistory(Base):
    __tablename__ = "presence_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    # 24-bit compact hourly presence bitmap stored as integer (bit 0 = hour 00:00, bit 23 = hour 23:00)
    hourly_bitmap = Column(Integer, default=0, nullable=False)

    device = relationship("Device", back_populates="presence_history")

    __table_args__ = (
        Index("ix_presence_device_date", "device_id", "date", unique=True),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource = Column(String(255), nullable=False)
    ip_address = Column(String(45), nullable=True)
    details = Column(JSON, default=dict, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)

    actor = relationship("User", back_populates="audit_logs")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(150), primary_key=True)
    value = Column(Text, nullable=False)
    is_encrypted = Column(Boolean, default=False, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
