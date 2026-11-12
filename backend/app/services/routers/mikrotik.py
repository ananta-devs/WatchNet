import httpx
from typing import List, Dict, Any, Optional
from app.services.routers.base import BaseRouterAdapter, RouterClientInfo

class MikroTikRouterAdapter(BaseRouterAdapter):
    """
    MikroTik RouterOS v7+ REST API Adapter.
    Queries `/rest/ip/dhcp-server/lease` and `/rest/interface/wireless/registration-table`
    or `/rest/system/resource`.
    """

    def _base_url(self) -> str:
        protocol = "https" if self.port in (443, 8443) else "http"
        return f"{protocol}://{self.host}:{self.port}"

    async def test_connection(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(verify=False) as client:
            try:
                auth = (self.username or "admin", self.password or "")
                resp = await client.get(f"{self._base_url()}/rest/system/resource", auth=auth, timeout=5.0)
                if resp.status_code == 200:
                    data = resp.json()
                    model = data.get("board-name", "MikroTik Router")
                    firmware = f"RouterOS v{data.get('version', '7.12')}"
                    return {
                        "success": True,
                        "model": model,
                        "firmware": firmware,
                        "message": "Connected to MikroTik RouterOS REST API successfully"
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "success": False,
                        "model": None,
                        "firmware": None,
                        "message": "MikroTik authentication failed"
                    }
                else:
                    return {
                        "success": False,
                        "model": None,
                        "firmware": None,
                        "message": f"MikroTik connection failed (HTTP {resp.status_code})"
                    }
            except Exception as e:
                return {
                    "success": False,
                    "model": None,
                    "firmware": None,
                    "message": f"MikroTik connection error: {str(e)}"
                }

    async def get_connected_clients(self) -> List[RouterClientInfo]:
        clients: List[RouterClientInfo] = []
        async with httpx.AsyncClient(verify=False) as client:
            try:
                auth = (self.username or "admin", self.password or "")
                # 1. DHCP leases
                lease_resp = await client.get(f"{self._base_url()}/rest/ip/dhcp-server/lease", auth=auth, timeout=5.0)
                leases = {}
                if lease_resp.status_code == 200:
                    for l in lease_resp.json():
                        mac = l.get("mac-address", "").lower()
                        if mac:
                            leases[mac] = l

                # 2. Wireless registration table
                wifi_resp = await client.get(f"{self._base_url()}/rest/interface/wireless/registration-table", auth=auth, timeout=5.0)
                wifi_entries = {}
                if wifi_resp.status_code == 200:
                    for w in wifi_resp.json():
                        mac = w.get("mac-address", "").lower()
                        if mac:
                            wifi_entries[mac] = w

                for mac, lease in leases.items():
                    wifi_info = wifi_entries.get(mac)
                    is_wifi = wifi_info is not None
                    signal = None
                    if wifi_info:
                        sig_str = wifi_info.get("signal-strength", "-65dBm")
                        try:
                            signal = int(sig_str.split("dBm")[0])
                        except Exception:
                            signal = -65

                    clients.append(RouterClientInfo(
                        mac=mac,
                        ip=lease.get("address"),
                        hostname=lease.get("host-name"),
                        interface=wifi_info.get("interface", "bridge") if wifi_info else "bridge",
                        connection_type="wifi" if is_wifi else "wired",
                        band="5 GHz" if is_wifi and "5ghz" in wifi_info.get("interface", "").lower() else ("2.4 GHz" if is_wifi else None),
                        rssi=signal,
                        tx_rate=float(wifi_info.get("tx-rate-set", 300)) if wifi_info else 1000.0,
                        rx_rate=float(wifi_info.get("rx-rate-set", 300)) if wifi_info else 1000.0,
                        lease_time_remaining=3600
                    ))
            except Exception:
                pass
        return clients

