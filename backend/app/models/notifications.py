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


class InAppNotification(Base):
    __tablename__ = "in_app_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(50), nullable=False, default="INFO")  # INFO, WARNING, CRITICAL
    event_type = Column(String(100), nullable=False, default="CUSTOM")
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    device = relationship("Device", foreign_keys=[device_id])


class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False)
    channel_type = Column(String(50), nullable=False, index=True)  # email, telegram, mqtt, ntfy, pushover, pushsafer, webhook, apprise
    is_enabled = Column(Boolean, default=True, nullable=False, index=True)
    config_json = Column(JSON, default=dict, nullable=False)
    min_severity = Column(String(50), default="INFO", nullable=False)  # INFO, WARNING, CRITICAL
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    delivery_logs = relationship("NotificationDeliveryLog", back_populates="channel", cascade="all, delete-orphan")


class NotificationDeliveryLog(Base):
    __tablename__ = "notification_delivery_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("notification_channels.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="SUCCESS")  # SUCCESS, FAILED
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    channel = relationship("NotificationChannel", back_populates="delivery_logs")
