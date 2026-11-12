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


class WorkflowRule(Base):
    __tablename__ = "workflow_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False, index=True)
    trigger_event = Column(String(100), nullable=False, index=True)
    # List of conditions e.g. [{"type": "vendor_equals", "value": "Apple"}]
    conditions_json = Column(JSON, default=list, nullable=False)
    # List of actions e.g. [{"action": "send_notification", "channel_id": "...", "message": "..."}]
    actions_json = Column(JSON, default=list, nullable=False)
    execution_count = Column(Integer, default=0, nullable=False)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    execution_logs = relationship("WorkflowExecutionLog", back_populates="rule", cascade="all, delete-orphan")


class WorkflowExecutionLog(Base):
    __tablename__ = "workflow_execution_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("workflow_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_event = Column(String(100), nullable=False)
    matched = Column(Boolean, default=True, nullable=False)
    actions_executed = Column(JSON, default=list, nullable=False)
    error_message = Column(Text, nullable=True)
    executed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    rule = relationship("WorkflowRule", back_populates="execution_logs")
