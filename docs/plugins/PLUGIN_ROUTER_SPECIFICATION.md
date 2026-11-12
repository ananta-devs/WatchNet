# Plugin SDK & Router Adapter Specification

**Document Version:** 1.0.0  

---

## 1. Clean-Room Plugin SDK

In contrast to upstream NetAlertX where plugins executed unconstrained scripts and directly mutated SQLite tables, WatchNet introduces a formal, sandboxed Plugin SDK.

### 1.1 Base Plugin Interface
Every plugin inherits from `BasePlugin` and implements standard lifecycle methods:

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from pydantic import BaseModel

class PluginMetadata(BaseModel):
    code_name: str
    display_name: str
    version: str
    plugin_type: str # 'collector', 'router', 'publisher', 'maintenance'
    schedule_cron: str
    requires_privileged_network: bool = False

class BasePlugin(ABC):
    def __init__(self, metadata: PluginMetadata, config: Dict[str, Any]):
        self.metadata = metadata
        self.config = config

    @abstractmethod
    async def validate_config(self) -> bool:
        """Validates configuration parameters prior to execution."""
        pass

    @abstractmethod
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Main execution lifecycle hook returning structured telemetry."""
        pass

    @abstractmethod
    async def cleanup(self) -> None:
        """Teardown and connection release."""
        pass
```

---

## 2. Router Integration Adapter Specification

### 2.1 Read-Only Invariant
To prevent unintended network disruptions, all router integrations adhere to the **Read-Only Invariant**:
- Integrations must strictly query ARP tables, DHCP bindings, and wireless association lists.
- Write operations (such as port blocking, rebooting, or interface toggles) are disabled by default and require explicit two-factor administrator authorization.

### 2.2 Standard Router Adapter Interface
```python
class BaseRouterAdapter(ABC):
    @abstractmethod
    async def connect(self) -> bool:
        pass

    @abstractmethod
    async def get_connected_clients(self) -> List[Dict[str, Any]]:
        """Returns normalized client records:
        [
            {
                "mac": "AA:BB:CC:DD:EE:FF",
                "ip": "192.168.1.50",
                "hostname": "workstation-1",
                "interface": "eth1",
                "wifi_band": "5GHz",
                "signal_dbm": -55
            }
        ]
        """
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        pass
```

Supported Router Adapters:
1. **UniFi Controller:** HTTPS REST client against `/api/s/{site}/stat/sta`.
2. **TP-Link Omada:** OpenAPI token client against `/api/v2/sites/{site}/clients`.
3. **OpenWrt / LuCI:** ubus JSON-RPC client querying `hostapd.*` and `luci-rpc.getDHCPLeases`.
4. **MikroTik RouterOS:** RouterAPI client querying `/ip/arp` and `/ip/dhcp-server/lease`.
5. **AVM FRITZ!Box:** TR-064 SOAP client querying `urn:dslforum-org:service:Hosts:1`.
6. **AsusWRT:** Read-only SSH client reading `/proc/net/arp` and `nvram get dhcp_leases`.
