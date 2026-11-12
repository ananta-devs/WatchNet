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
    JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class RemoteSite(Base):
    __tablename__ = "remote_sites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), unique=True, nullable=False, index=True)
    location = Column(String(255), nullable=True)
    interface = Column(String(50), nullable=True)
    api_key_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    device_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    devices = relationship("Device", back_populates="site")
    sync_logs = relationship("SiteSyncLog", back_populates="site", cascade="all, delete-orphan")


class SiteSyncLog(Base):
    __tablename__ = "site_sync_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    site_id = Column(UUID(as_uuid=True), ForeignKey("remote_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="SUCCESS") # SUCCESS, FAILED, PARTIAL
    devices_synced = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    site = relationship("RemoteSite", back_populates="sync_logs")

