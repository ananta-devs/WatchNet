import httpx
from typing import List, Dict, Any, Optional
from app.services.routers.base import BaseRouterAdapter, RouterClientInfo

class OmadaRouterAdapter(BaseRouterAdapter):
    """
    TP-Link Omada SDN OpenAPI / Controller Adapter.
    Authenticates via token `/api/v2/login` and queries `/api/v2/sites/{site}/clients`.
    """

    def _base_url(self) -> str:
        protocol = "https" if self.port in (443, 8043) else "http"
        return f"{protocol}://{self.host}:{self.port}"

    async def _get_token(self, client: httpx.AsyncClient) -> Optional[str]:
        try:
            payload = {
                "name": self.username or "admin",
                "password": self.password or ""
            }
            resp = await client.post(f"{self._base_url()}/api/v2/login", json=payload, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("result", {}).get("token")
        except Exception:
            pass
        return None

    async def test_connection(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(verify=False) as client:
            try:
                token = await self._get_token(client)
                if token:
                    headers = {"Csrf-Token": token}
                    sys_resp = await client.get(f"{self._base_url()}/api/v2/status", headers=headers, timeout=5.0)
                    model = "TP-Link Omada ER605"
                    firmware = "v5.9.31"
                    if sys_resp.status_code == 200:
                        data = sys_resp.json().get("result", {})
                        model = data.get("controllerName", model)
                        firmware = data.get("controllerVersion", firmware)

                    return {
                        "success": True,
                        "model": model,
                        "firmware": firmware,
                        "message": "Connected to TP-Link Omada SDN Controller"
                    }
                else:
                    return {
                        "success": False,
                        "model": None,
                        "firmware": None,
                        "message": "Omada SDN authentication failed"
                    }
            except Exception as e:
                return {
                    "success": False,
                    "model": None,
                    "firmware": None,
                    "message": f"Omada connection error: {str(e)}"
                }

    async def get_connected_clients(self) -> List[RouterClientInfo]:
        clients: List[RouterClientInfo] = []
        async with httpx.AsyncClient(verify=False) as client:
            token = await self._get_token(client)
            if not token:
                return clients

            try:
                headers = {"Csrf-Token": token}
                # Query clients endpoint
                resp = await client.get(f"{self._base_url()}/api/v2/sites/default/clients", headers=headers, timeout=5.0)
                if resp.status_code == 200:
                    entries = resp.json().get("result", {}).get("data", [])
                    for c in entries:
                        mac = c.get("mac", "").lower()
                        if not mac:
                            continue
                        is_wireless = c.get("wireless", False)
                        radio = c.get("radio", "2.4G")
                        band = "5 GHz" if "5" in radio else ("6 GHz" if "6" in radio else "2.4 GHz")
                        clients.append(RouterClientInfo(
                            mac=mac,
                            ip=c.get("ip"),
                            hostname=c.get("name") or c.get("hostName"),
                            interface="wlan" if is_wireless else "eth",
                            connection_type="wifi" if is_wireless else "wired",
                            band=band if is_wireless else None,
                            rssi=c.get("rssi", -62) if is_wireless else None,
                            tx_rate=float(c.get("txRate", 0)),
                            rx_rate=float(c.get("rxRate", 0)),
                            lease_time_remaining=c.get("uptime", 86400)
                        ))
            except Exception:
                pass
        return clients

