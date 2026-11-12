import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Integer,
    Enum,
    Index
)
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class RouterVendor(str, enum.Enum):
    OPENWRT = "OpenWrt"
    UNIFI = "UniFi"
    ASUSWRT = "AsusWrt"
    FRITZBOX = "FRITZ!Box"
    MIKROTIK = "MikroTik"
    OMADA = "Omada"
    GENERIC = "Generic"

class RouterIntegrationLevel(str, enum.Enum):
    FULL_API = "full_api"                 # Full read-only API integration (clients, RSSI, DHCP leases, wireless bands)
    READ_ONLY_API = "read_only_api"       # Read-only REST/SOAP API with partial telemetry
    PASSIVE_DISCOVERY = "passive_discovery" # Passive network discovery (ARP, ICMP, DNS, ip neigh)
    UNSUPPORTED = "unsupported"           # Direct API polling unsupported (e.g. proprietary encrypted stock firmware)

class Router(Base):
    __tablename__ = "routers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    vendor = Column(Enum(RouterVendor, values_callable=lambda obj: [e.value for e in obj]), default=RouterVendor.GENERIC, nullable=False)
    integration_level = Column(String(50), default="read_only_api", nullable=False)
    model = Column(String(255), nullable=True)
    firmware = Column(String(255), nullable=True)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False, default=80)
    username = Column(String(255), nullable=True)
    password_encrypted = Column(String(1024), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_connected_at = Column(DateTime(timezone=True), nullable=True)
    client_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ix_routers_vendor", "vendor"),
        Index("ix_routers_host", "host"),
    )

