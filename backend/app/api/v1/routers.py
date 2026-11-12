import uuid
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.entities import User, UserRole
from app.models.routers import Router, RouterVendor
from app.services.routers.router_service import RouterService
from app.services.routers.base import RouterClientInfo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/routers", tags=["Router Management"])

class RouterRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    vendor: str = Field(RouterVendor.GENERIC.value)
    integration_level: Optional[str] = Field("read_only_api")
    host: str = Field(..., min_length=1)
    port: int = Field(80, ge=1, le=65535)
    username: Optional[str] = None
    password: Optional[str] = None
    model: Optional[str] = None
    firmware: Optional[str] = None

class RouterTelemetryCapabilities(BaseModel):
    passive_arp: bool = True
    icmp_reachability: bool = True
    dns_ptr_resolution: bool = True
    neighbor_discovery: bool = True
    dhcp_lease_ingestion: bool = False
    wifi_association_rssi: bool = False
    band_steering_metrics: bool = False
    snmp_interface_tables: bool = False
    proprietary_client_api: bool = False

class RouterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    vendor: str
    integration_level: str
    telemetry: RouterTelemetryCapabilities
    model: Optional[str]
    firmware: Optional[str]
    host: str
    port: int
    username: Optional[str]
    is_active: bool
    last_connected_at: Optional[str]
    client_count: int

def resolve_telemetry_capabilities(vendor: str, integration_level: str) -> RouterTelemetryCapabilities:
    v = vendor.lower()
    if integration_level == "unsupported":
        return RouterTelemetryCapabilities(
            passive_arp=True,
            icmp_reachability=True,
            dns_ptr_resolution=True,
            neighbor_discovery=True,
            dhcp_lease_ingestion=False,
            wifi_association_rssi=False,
            band_steering_metrics=False,
            snmp_interface_tables=False,
            proprietary_client_api=False,
        )
    elif integration_level == "passive_discovery":
        return RouterTelemetryCapabilities(
            passive_arp=True,
            icmp_reachability=True,
            dns_ptr_resolution=True,
            neighbor_discovery=True,
            dhcp_lease_ingestion=True,
            wifi_association_rssi=False,
            band_steering_metrics=False,
            snmp_interface_tables=False,
            proprietary_client_api=False,
        )
    elif "unifi" in v or "omada" in v:
        return RouterTelemetryCapabilities(
            passive_arp=True,
            icmp_reachability=True,
            dns_ptr_resolution=True,
            neighbor_discovery=True,
            dhcp_lease_ingestion=True,
            wifi_association_rssi=True,
            band_steering_metrics=True,
            snmp_interface_tables=True,
            proprietary_client_api=True,
        )
    else:
        return RouterTelemetryCapabilities(
            passive_arp=True,
            icmp_reachability=True,
            dns_ptr_resolution=True,
            neighbor_discovery=True,
            dhcp_lease_ingestion=True,
            wifi_association_rssi=True,
            band_steering_metrics=False,
            snmp_interface_tables=False,
            proprietary_client_api=True,
        )

@router.get("", response_model=List[RouterResponse])
async def list_routers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all registered network routers with integration levels and telemetry capability profiles."""
    res = await db.execute(select(Router).order_by(Router.created_at.desc()))
    routers = res.scalars().all()
    out = []
    for r in routers:
        vendor_str = r.vendor.value if hasattr(r.vendor, "value") else str(r.vendor)
        int_lvl = getattr(r, "integration_level", "read_only_api") or "read_only_api"
        out.append(
            RouterResponse(
                id=str(r.id),
                name=r.name,
                vendor=vendor_str,
                integration_level=int_lvl,
                telemetry=resolve_telemetry_capabilities(vendor_str, int_lvl),
                model=r.model,
                firmware=r.firmware,
                host=r.host,
                port=r.port,
                username=r.username,
                is_active=r.is_active,
                last_connected_at=r.last_connected_at.isoformat() if r.last_connected_at else None,
                client_count=r.client_count
            )
        )
    return out

@router.post("", response_model=RouterResponse, status_code=status.HTTP_201_CREATED)
async def register_router(
    payload: RouterRegisterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER]))
):
    """Register a new router with securely encrypted credentials and integration level."""
    int_lvl = payload.integration_level or "read_only_api"
    router_obj = await RouterService.create_router(
        db=db,
        name=payload.name,
        vendor=payload.vendor,
        host=payload.host,
        port=payload.port,
        username=payload.username,
        password=payload.password,
        model=payload.model,
        firmware=payload.firmware,
        integration_level=int_lvl
    )
    vendor_str = router_obj.vendor.value if hasattr(router_obj.vendor, "value") else str(router_obj.vendor)
    return RouterResponse(
        id=str(router_obj.id),
        name=router_obj.name,
        vendor=vendor_str,
        integration_level=int_lvl,
        telemetry=resolve_telemetry_capabilities(vendor_str, int_lvl),
        model=router_obj.model,
        firmware=router_obj.firmware,
        host=router_obj.host,
        port=router_obj.port,
        username=router_obj.username,
        is_active=router_obj.is_active,
        last_connected_at=None,
        client_count=0
    )

@router.post("/{id}/test")
async def test_router_connection(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Test reachability and authentication with the target router."""
    res = await db.execute(select(Router).where(Router.id == id))
    router_obj = res.scalar_one_or_none()
    if not router_obj:
        raise HTTPException(status_code=404, detail="Router not found")

    result = await RouterService.test_router_connection(router_obj)
    if result.get("success") and result.get("model"):
        router_obj.model = result.get("model")
        router_obj.firmware = result.get("firmware")
        await db.commit()

    return result

@router.post("/{id}/sync")
async def sync_router_clients(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER, UserRole.OPERATOR]))
):
    """Poll router for connected clients, Wi-Fi telemetry and DHCP leases."""
    res = await db.execute(select(Router).where(Router.id == id))
    router_obj = res.scalar_one_or_none()
    if not router_obj:
        raise HTTPException(status_code=404, detail="Router not found")

    clients = await RouterService.sync_router_clients(db, router_obj)
    return {
        "status": "success",
        "synced_clients_count": len(clients),
        "clients": [c.model_dump() for c in clients]
    }

@router.get("/{id}/clients", response_model=List[RouterClientInfo])
async def get_router_clients(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve connected clients with Wi-Fi signal, band, and counters."""
    res = await db.execute(select(Router).where(Router.id == id))
    router_obj = res.scalar_one_or_none()
    if not router_obj:
        raise HTTPException(status_code=404, detail="Router not found")

    adapter = RouterService.get_adapter(router_obj)
    return await adapter.get_connected_clients()

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_router(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.OWNER]))
):
    """Delete router entry."""
    res = await db.execute(select(Router).where(Router.id == id))
    router_obj = res.scalar_one_or_none()
    if not router_obj:
        raise HTTPException(status_code=404, detail="Router not found")

    await db.delete(router_obj)
    await db.commit()
    return None

