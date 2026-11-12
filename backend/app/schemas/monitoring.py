from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class InternetHealthResponse(BaseModel):
    timestamp: datetime
    wan_ip: Optional[str] = None
    gateway_latency_ms: Optional[float] = None
    dns_resolution_ms: Optional[float] = None
    is_connected: bool
    dns_resolvers: Optional[Dict[str, Optional[float]]] = None
    history_24h: Optional[List[Dict[str, Any]]] = None

class SpeedtestRunResponse(BaseModel):
    id: Optional[int] = None
    timestamp: datetime
    download_mbps: float
    upload_mbps: float
    ping_ms: float
    jitter_ms: float
    server_name: Optional[str] = None
    server_location: Optional[str] = None
    client_ip: Optional[str] = None

class WebsiteTargetCreate(BaseModel):
    url: str
    name: Optional[str] = None
    check_interval_sec: int = Field(default=60, ge=10, le=86400)

class WebsiteTargetResponse(BaseModel):
    id: UUID
    url: str
    name: Optional[str] = None
    check_interval_sec: int
    is_active: bool
    last_status_code: Optional[int] = None
    last_latency_ms: Optional[float] = None
    ssl_days_remaining: Optional[int] = None
    is_up: bool
    uptime_percentage: Optional[float] = 100.0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DevicePortScanItem(BaseModel):
    port: int
    protocol: str = "tcp"
    service_name: Optional[str] = None
    state: str = "open"
    banner: Optional[str] = None
    last_scanned: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class DevicePortScanResponse(BaseModel):
    device_id: UUID
    ports: List[DevicePortScanItem]
    total_open: int

class TopologyNode(BaseModel):
    id: str
    label: str
    type: str
    category: Optional[str] = None
    status: Optional[str] = "online"
    ip: Optional[str] = None
    mac: Optional[str] = None
    vendor: Optional[str] = None
    level: int

class TopologyEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Optional[str] = None
    label: Optional[str] = None

class TopologyResponse(BaseModel):
    summary: Dict[str, Any]
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
