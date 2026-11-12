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
    Float,
    BigInteger,
    Enum,
    Index,
    JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class InternetHealthLog(Base):
    __tablename__ = "internet_health_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    wan_ip = Column(String(45), nullable=True)
    gateway_latency_ms = Column(Float, nullable=True)
    dns_resolution_ms = Column(Float, nullable=True)
    is_connected = Column(Boolean, default=False, nullable=False, index=True)
    details = Column(JSON, default=dict, nullable=False)


class SpeedtestResult(Base):
    __tablename__ = "speedtest_results"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    download_mbps = Column(Float, nullable=False)
    upload_mbps = Column(Float, nullable=False)
    ping_ms = Column(Float, nullable=False)
    jitter_ms = Column(Float, default=0.0, nullable=False)
    server_name = Column(String(255), nullable=True)
    server_location = Column(String(255), nullable=True)
    client_ip = Column(String(45), nullable=True)


class WebsiteTarget(Base):
    __tablename__ = "website_targets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(String(2048), nullable=False)
    name = Column(String(255), nullable=True)
    check_interval_sec = Column(Integer, default=60, nullable=False)
    is_active = Column(Boolean, default=True, index=True, nullable=False)
    last_status_code = Column(Integer, nullable=True)
    last_latency_ms = Column(Float, nullable=True)
    ssl_days_remaining = Column(Integer, nullable=True)
    is_up = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    check_logs = relationship("WebsiteCheckLog", back_populates="target", cascade="all, delete-orphan")


class WebsiteCheckLog(Base):
    __tablename__ = "website_check_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    target_id = Column(UUID(as_uuid=True), ForeignKey("website_targets.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    status_code = Column(Integer, nullable=True)
    latency_ms = Column(Float, nullable=True)
    is_up = Column(Boolean, nullable=False)
    error_message = Column(Text, nullable=True)

    target = relationship("WebsiteTarget", back_populates="check_logs")


class DevicePortScan(Base):
    __tablename__ = "device_port_scans"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    port = Column(Integer, nullable=False)
    protocol = Column(String(10), default="tcp", nullable=False)
    service_name = Column(String(100), nullable=True)
    state = Column(String(20), default="open", nullable=False)
    banner = Column(Text, nullable=True)
    last_scanned = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)

    device = relationship("Device", back_populates="ports")

    __table_args__ = (
        Index("ix_device_port_protocol", "device_id", "port", "protocol", unique=True),
    )
