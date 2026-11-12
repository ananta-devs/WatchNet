from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class RouterClientInfo(BaseModel):
    mac: str
    ip: Optional[str] = None
    hostname: Optional[str] = None
    interface: Optional[str] = "wlan0"
    connection_type: str = "wifi"  # "wifi" or "wired"
    band: Optional[str] = None     # "2.4 GHz", "5 GHz", "6 GHz"
    rssi: Optional[int] = None     # dBm, e.g. -55
    tx_rate: Optional[float] = None # Mbps
    rx_rate: Optional[float] = None # Mbps
    lease_time_remaining: Optional[int] = None # seconds

class BaseRouterAdapter(ABC):
    """
    Abstract Base Router Adapter.
    All adapters are read-only by default to prevent destructive configuration overwrites.
    """

    def __init__(self, host: str, port: int, username: Optional[str] = None, password: Optional[str] = None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password

    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """
        Verify credentials and reachability.
        Returns a dict: {"success": bool, "model": Optional[str], "firmware": Optional[str], "message": str}
        """
        pass

    @abstractmethod
    async def get_connected_clients(self) -> List[RouterClientInfo]:
        """
        Extract live connected clients (Wi-Fi associations and DHCP leases)
        with signal strength (RSSI), frequency band, TX/RX metrics, and lease duration.
        """
        pass

