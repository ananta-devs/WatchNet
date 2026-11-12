import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone

from app.models.routers import Router, RouterVendor
from app.models.entities import Device, DeviceStatus, NetworkEvent, EventSeverity
from app.core.security import encrypt_credential, decrypt_credential
from app.services.routers.base import BaseRouterAdapter, RouterClientInfo
from app.services.routers.openwrt import OpenWrtRouterAdapter
from app.services.routers.unifi import UniFiRouterAdapter
from app.services.routers.asuswrt import AsusWrtRouterAdapter
from app.services.routers.fritzbox import FritzBoxRouterAdapter
from app.services.routers.mikrotik import MikroTikRouterAdapter
from app.services.routers.omada import OmadaRouterAdapter

logger = logging.getLogger(__name__)

class RouterService:
    """
    Central router management service handling registration, credentials encryption,
    adapter instantiation, connection testing, and client synchronization.
    All integrations are strictly read-only by default.
    """

    @staticmethod
    def get_adapter(router: Router) -> BaseRouterAdapter:
        plain_password = decrypt_credential(router.password_encrypted) if router.password_encrypted else None
        raw_vendor = router.vendor.value if hasattr(router.vendor, "value") else str(router.vendor)
        vendor_clean = raw_vendor.strip().lower()

        if "openwrt" in vendor_clean:
            return OpenWrtRouterAdapter(router.host, router.port, router.username, plain_password)
        elif "unifi" in vendor_clean:
            return UniFiRouterAdapter(router.host, router.port, router.username, plain_password)
        elif "asus" in vendor_clean:
            return AsusWrtRouterAdapter(router.host, router.port, router.username, plain_password)
        elif "fritz" in vendor_clean:
            return FritzBoxRouterAdapter(router.host, router.port, router.username, plain_password)
        elif "mikrotik" in vendor_clean or "routeros" in vendor_clean:
            return MikroTikRouterAdapter(router.host, router.port, router.username, plain_password)
        elif "omada" in vendor_clean or "tp-link" in vendor_clean:
            return OmadaRouterAdapter(router.host, router.port, router.username, plain_password)
        else:
            # Fallback to OpenWrt generic adapter
            return OpenWrtRouterAdapter(router.host, router.port, router.username, plain_password)

    @staticmethod
    async def create_router(
        db: AsyncSession,
        name: str,
        vendor: str,
        host: str,
        port: int = 80,
        username: Optional[str] = None,
        password: Optional[str] = None,
        model: Optional[str] = None,
        firmware: Optional[str] = None,
        integration_level: str = "read_only_api"
    ) -> Router:
        encrypted_pwd = encrypt_credential(password) if password else None
        router = Router(
            name=name,
            vendor=vendor,
            integration_level=integration_level,
            host=host,
            port=port,
            username=username,
            password_encrypted=encrypted_pwd,
            model=model,
            firmware=firmware,
            is_active=True
        )
        db.add(router)
        await db.commit()
        await db.refresh(router)
        return router

    @staticmethod
    async def test_router_connection(router: Router) -> Dict[str, Any]:
        adapter = RouterService.get_adapter(router)
        result = await adapter.test_connection()
        return result

    @staticmethod
    async def sync_router_clients(db: AsyncSession, router: Router) -> List[RouterClientInfo]:
        """
        Polls the router adapter for live clients, updates router client_count and last_connected_at,
        and synchronizes with WatchNet devices database table.
        """
        adapter = RouterService.get_adapter(router)
        clients = await adapter.get_connected_clients()

        router.last_connected_at = datetime.now(timezone.utc)
        router.client_count = len(clients)

        # Update or record device information
        for client in clients:
            result = await db.execute(select(Device).where(Device.mac == client.mac.lower()))
            device = result.scalar_one_or_none()
            if device:
                device.status = DeviceStatus.ONLINE
                device.last_seen = datetime.now(timezone.utc)
                if client.ip and not ("ipv4" in device.locked_fields):
                    device.ipv4 = client.ip
                if client.hostname and not ("name" in device.locked_fields) and not device.name:
                    device.name = client.hostname
                
                # Store Wi-Fi & telemetry in custom_properties
                props = dict(device.custom_properties or {})
                props["router_id"] = str(router.id)
                props["router_name"] = router.name
                props["connection_type"] = client.connection_type
                if client.band:
                    props["band"] = client.band
                if client.rssi is not None:
                    props["rssi"] = client.rssi
                if client.tx_rate is not None:
                    props["tx_rate"] = client.tx_rate
                if client.rx_rate is not None:
                    props["rx_rate"] = client.rx_rate
                if client.lease_time_remaining is not None:
                    props["dhcp_lease_remaining"] = client.lease_time_remaining
                device.custom_properties = props
            else:
                # Discovered a client via router
                new_dev = Device(
                    mac=client.mac.lower(),
                    ipv4=client.ip,
                    name=client.hostname or f"Device-{client.mac[-5:]}",
                    interface=client.interface or "router",
                    status=DeviceStatus.ONLINE,
                    custom_properties={
                        "router_id": str(router.id),
                        "router_name": router.name,
                        "connection_type": client.connection_type,
                        "band": client.band,
                        "rssi": client.rssi,
                        "tx_rate": client.tx_rate,
                        "rx_rate": client.rx_rate,
                        "dhcp_lease_remaining": client.lease_time_remaining
                    }
                )
                db.add(new_dev)

        await db.commit()
        await db.refresh(router)
        return clients

