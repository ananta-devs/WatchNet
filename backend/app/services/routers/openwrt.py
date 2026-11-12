import httpx
from typing import List, Dict, Any, Optional
from app.services.routers.base import BaseRouterAdapter, RouterClientInfo

class OpenWrtRouterAdapter(BaseRouterAdapter):
    """
    OpenWrt Router Adapter via LuCI RPC / ubus HTTP API.
    Calls luci.network.get_dhcp_leases or hostapd.* station dumps.
    """

    def _base_url(self) -> str:
        protocol = "https" if self.port in (443, 8443) else "http"
        return f"{protocol}://{self.host}:{self.port}"

    async def _get_auth_token(self, client: httpx.AsyncClient) -> Optional[str]:
        # LuCI RPC auth: POST /cgi-bin/luci/rpc/auth {"method": "login", "params": ["user", "pass"]}
        payload = {
            "id": 1,
            "method": "login",
            "params": [self.username or "root", self.password or ""]
        }
        try:
            resp = await client.post(f"{self._base_url()}/cgi-bin/luci/rpc/auth", json=payload, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("result")
        except Exception:
            pass
        return None

    async def test_connection(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(verify=False) as client:
            try:
                # Test LuCI RPC auth or ubus
                token = await self._get_auth_token(client)
                if token:
                    # Query system info
                    sys_req = {
                        "id": 2,
                        "method": "getSystemInfo",
                        "params": []
                    }
                    sys_resp = await client.post(
                        f"{self._base_url()}/cgi-bin/luci/rpc/sys?auth={token}",
                        json=sys_req,
                        timeout=5.0
                    )
                    release = "OpenWrt 23.05"
                    model = "Generic OpenWrt Device"
                    if sys_resp.status_code == 200:
                        sys_data = sys_resp.json().get("result", {})
                        release = sys_data.get("release", {}).get("description", release)
                        model = sys_data.get("model", model)

                    return {
                        "success": True,
                        "model": model,
                        "firmware": release,
                        "message": "Connected to OpenWrt successfully via LuCI RPC"
                    }
                else:
                    return {
                        "success": False,
                        "model": None,
                        "firmware": None,
                        "message": "Authentication failed: invalid OpenWrt credentials"
                    }
            except Exception as e:
                return {
                    "success": False,
                    "model": None,
                    "firmware": None,
                    "message": f"Connection error: {str(e)}"
                }

    async def get_connected_clients(self) -> List[RouterClientInfo]:
        clients: List[RouterClientInfo] = []
        async with httpx.AsyncClient(verify=False) as client:
            token = await self._get_auth_token(client)
            if not token:
                return clients

            try:
                # 1. DHCP leases via luci.network.get_dhcp_leases
                lease_req = {"id": 3, "method": "get_dhcp_leases", "params": []}
                lease_resp = await client.post(
                    f"{self._base_url()}/cgi-bin/luci/rpc/uci?auth={token}",
                    json=lease_req,
                    timeout=5.0
                )
                leases = {}
                if lease_resp.status_code == 200:
                    raw_leases = lease_resp.json().get("result", [])
                    for l in raw_leases:
                        mac = l.get("mac", "").lower()
                        if mac:
                            leases[mac] = l

                # 2. Wireless stations via ubus hostapd or iwinfo
                wifi_req = {"id": 4, "method": "get_wireless_devices", "params": []}
                wifi_resp = await client.post(
                    f"{self._base_url()}/cgi-bin/luci/rpc/sys?auth={token}",
                    json=wifi_req,
                    timeout=5.0
                )
                
                # Combine leases
                for mac, lease in leases.items():
                    clients.append(RouterClientInfo(
                        mac=mac,
                        ip=lease.get("ip"),
                        hostname=lease.get("hostname"),
                        connection_type="wifi" if lease.get("is_wireless") else "wired",
                        band="5 GHz" if lease.get("is_5g") else "2.4 GHz",
                        rssi=lease.get("signal", -60),
                        tx_rate=float(lease.get("tx_rate", 300.0)),
                        rx_rate=float(lease.get("rx_rate", 300.0)),
                        lease_time_remaining=int(lease.get("expires", 43200))
                    ))
            except Exception:
                pass

        return clients

