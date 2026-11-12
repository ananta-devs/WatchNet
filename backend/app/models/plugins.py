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
    Index,
    JSON
)
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class PluginRecord(Base):
    __tablename__ = "plugins"

    plugin_id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, index=True)
    is_enabled = Column(Boolean, default=False, nullable=False, index=True)
    schedule_interval_sec = Column(Integer, default=300, nullable=False)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    last_status = Column(String(50), default="idle", nullable=False)
    config_json = Column(JSON, default=dict, nullable=False)
    error_message = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )


class PluginExecutionLog(Base):
    __tablename__ = "plugin_execution_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    plugin_id = Column(String(100), ForeignKey("plugins.plugin_id", ondelete="CASCADE"), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Float, default=0.0, nullable=False)
    status = Column(String(50), default="running", nullable=False)  # running, success, failed, timeout
    items_produced = Column(Integer, default=0, nullable=False)
    log_output = Column(Text, default="", nullable=False)
    error = Column(Text, nullable=True)
