from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Any, Dict
from datetime import datetime
from uuid import UUID
from app.models.entities import UserRole, DeviceStatus, DeviceCategory, EventSeverity

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class UserBase(BaseModel):
    email: str
    username: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.VIEWER
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Device Schemas
class DeviceBase(BaseModel):
    mac: str
    ipv4: Optional[str] = None
    ipv6: Optional[str] = None
    vendor: Optional[str] = None
    name: Optional[str] = None
    interface: Optional[str] = None
    status: DeviceStatus = DeviceStatus.UNKNOWN
    category: DeviceCategory = DeviceCategory.UNKNOWN
    icon: Optional[str] = None
    notes: Optional[str] = None
    is_archived: bool = False
    locked_fields: list[str] = Field(default_factory=list)
    custom_properties: Dict[str, Any] = Field(default_factory=dict)
    site_id: Optional[UUID] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    notes: Optional[str] = None
    locked_fields: Optional[list[str]] = None
    custom_properties: Optional[Dict[str, Any]] = None
    is_archived: Optional[bool] = None

class DeviceBulkUpdate(BaseModel):
    device_ids: list[UUID]
    category: Optional[str] = None
    add_tags: Optional[list[str]] = None
    remove_tags: Optional[list[str]] = None
    is_archived: Optional[bool] = None
    lock_category: bool = False

class DeviceResponse(DeviceBase):
    id: UUID
    first_seen: datetime
    last_seen: datetime

    model_config = ConfigDict(from_attributes=True)

class DeviceListResponse(BaseModel):
    devices: list[DeviceResponse]
    total: int
    skip: int
    limit: int

class DevicePresenceDay(BaseModel):
    date: str
    hourly_bitmap: int
    hours: list[bool]

class DeviceHistoryResponse(BaseModel):
    device_id: str
    mac: str
    ip_history: list[str]
    sessions: list[Dict[str, Any]]
    events: list[Dict[str, Any]]

# Health Schemas
class HealthCheckResponse(BaseModel):
    status: str
    database: str
    redis: str
    timestamp: datetime

class VersionResponse(BaseModel):
    version: str
    project: str
    environment: str
