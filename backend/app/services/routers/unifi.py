import httpx
from typing import List, Dict, Any, Optional
from app.services.routers.base import BaseRouterAdapter, RouterClientInfo

class UniFiRouterAdapter(BaseRouterAdapter):
    """
    UniFi OS Console / Network Controller Adapter.
    Authenticates via session cookies (`/api/auth/login`) and queries `/stat/sta` station telemetry.
    """

    def _base_url(self) -> str:
        protocol = "https" if self.port in (443, 8443) else "http"
        return f"{protocol}://{self.host}:{self.port}"

    async def _login(self, client: httpx.AsyncClient) -> bool:
        # UniFi OS login endpoint: POST /api/auth/login
        try:
            payload = {"username": self.username or "ubnt", "password": self.password or ""}
            # First try UniFi OS endpoint
            resp = await client.post(f"{self._base_url()}/api/auth/login", json=payload, timeout=5.0)
            if resp.status_code == 200:
                return True
            # Fallback legacy controller endpoint
            legacy_resp = await client.post(f"{self._base_url()}/api/login", json=payload, timeout=5.0)
            if legacy_resp.status_code == 200:
                return True
        except Exception:
            pass
        return False

    async def test_connection(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(verify=False) as client:
            try:
                ok = await self._login(client)
                if ok:
                    # Query system version
                    sys_resp = await client.get(f"{self._base_url()}/api/stat/sysinfo", timeout=5.0)
                    version = "UniFi OS 3.x"
                    model = "UniFi Dream Machine Pro"
                    if sys_resp.status_code == 200:
                        data = sys_resp.json().get("data", [{}])[0]
                        version = data.get("version", version)
                        model = data.get("model", model)

                    return {
                        "success": True,
                        "model": model,
                        "firmware": version,
                        "message": "Connected to UniFi Controller successfully"
                    }
                else:
                    return {
                        "success": False,
                        "model": None,
                        "firmware": None,
                        "message": "UniFi authentication failed"
                    }
            except Exception as e:
                return {
                    "success": False,
                    "model": None,
                    "firmware": None,
                    "message": f"UniFi connection error: {str(e)}"
                }

    async def get_connected_clients(self) -> List[RouterClientInfo]:
        clients: List[RouterClientInfo] = []
        async with httpx.AsyncClient(verify=False) as client:
            ok = await self._login(client)
            if not ok:
                return clients

            try:
                # Query active stations: GET /proxy/network/api/s/default/stat/sta or legacy /api/s/default/stat/sta
                resp = await client.get(f"{self._base_url()}/proxy/network/api/s/default/stat/sta", timeout=5.0)
                if resp.status_code != 200:
                    resp = await client.get(f"{self._base_url()}/api/s/default/stat/sta", timeout=5.0)

                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    for sta in data:
                        mac = sta.get("mac", "").lower()
                        if not mac:
                            continue
                        is_wired = sta.get("is_wired", False)
                        radio_proto = sta.get("radio_proto", "na")
                        channel = sta.get("channel", 1)
                        band = "wired"
                        if not is_wired:
                            if channel > 30 and channel < 170:
                                band = "5 GHz"
                            elif channel >= 170:
                                band = "6 GHz"
                            else:
                                band = "2.4 GHz"

                        clients.append(RouterClientInfo(
                            mac=mac,
                            ip=sta.get("ip"),
                            hostname=sta.get("hostname") or sta.get("name"),
                            interface="eth0" if is_wired else "wlan",
                            connection_type="wired" if is_wired else "wifi",
                            band=band if not is_wired else None,
                            rssi=sta.get("rssi") or sta.get("signal"),
                            tx_rate=float(sta.get("tx_rate", 0)),
                            rx_rate=float(sta.get("rx_rate", 0)),
                            lease_time_remaining=sta.get("uptime")
                        ))
            except Exception:
                pass
        return clients

