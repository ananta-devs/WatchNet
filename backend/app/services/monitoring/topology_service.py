import ipaddress
import logging
import subprocess
import sys
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.entities import Device, DeviceCategory, DeviceStatus
from app.services.monitoring.internet_monitor import detect_system_gateway

logger = logging.getLogger("watchnet.monitoring.topology")

def get_system_arp_cache() -> Dict[str, str]:
    """
    Query the operating system's ARP/neighbor cache to discover L2 MAC to L3 IP mappings.
    """
    arp_table: Dict[str, str] = {}
    try:
        if sys.platform == "win32":
            out = subprocess.check_output(["arp", "-a"], text=True, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                m = re.search(r'([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})', line)
                if m:
                    ip = m.group(1)
                    mac = m.group(2).replace("-", ":").upper()
                    arp_table[ip] = mac
        else:
            out = subprocess.check_output(["ip", "neigh"], text=True, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 5 and "lladdr" in parts:
                    ip = parts[0]
                    mac_idx = parts.index("lladdr") + 1
                    mac = parts[mac_idx].upper()
                    arp_table[ip] = mac
    except Exception as e:
        logger.debug(f"Failed to read ARP table: {e}")
    return arp_table

class TopologyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_topology(self) -> Dict[str, Any]:
        """
        Construct dynamic L2/L3 topology graph:
        - Root: Internet Cloud (Level 0)
        - Gateway node: Default Router / WAN Gateway (Level 1)
        - Intermediate Switch / AP nodes (Level 2)
        - Leaf Client device nodes grouped by subnet / category (Level 3)
        """
        stmt = select(Device).where(Device.is_archived == False)
        result = await self.db.execute(stmt)
        devices: List[Device] = list(result.scalars().all())

        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        # 1. Root WAN Node
        wan_node_id = "node-wan"
        nodes.append({
            "id": wan_node_id,
            "label": "Internet WAN",
            "type": "cloud",
            "category": "WAN",
            "status": "online",
            "ip": "Public WAN",
            "mac": None,
            "level": 0
        })

        # 2. Discover default gateway IP and ARP table
        system_gateway_ip = detect_system_gateway()
        arp_cache = get_system_arp_cache()

        # 3. Identify Gateway / Infrastructure Nodes
        gateway_device: Optional[Device] = None
        infra_devices: List[Device] = []
        client_devices: List[Device] = []

        for d in devices:
            is_gw_candidate = False
            if system_gateway_ip and d.ipv4 == system_gateway_ip:
                is_gw_candidate = True
            elif (not system_gateway_ip) and (d.category == DeviceCategory.NETWORK_INFRASTRUCTURE or (d.ipv4 and d.ipv4.endswith(".1"))):
                is_gw_candidate = True

            if is_gw_candidate and not gateway_device:
                gateway_device = d
            elif d.category == DeviceCategory.NETWORK_INFRASTRUCTURE:
                infra_devices.append(d)
            else:
                client_devices.append(d)

        # Create or fallback gateway node
        gateway_id = f"dev-{gateway_device.id}" if gateway_device else "node-gateway"
        gw_ip = gateway_device.ipv4 if gateway_device else (system_gateway_ip or "192.168.1.1")
        gw_mac = gateway_device.mac if gateway_device else arp_cache.get(gw_ip, "00:00:5E:00:01:01")

        nodes.append({
            "id": gateway_id,
            "label": gateway_device.name if gateway_device else f"Default Gateway ({gw_ip})",
            "type": "router",
            "category": "Network/Infrastructure",
            "status": gateway_device.status.value if gateway_device else "online",
            "ip": gw_ip,
            "mac": gw_mac,
            "vendor": gateway_device.vendor if gateway_device else "Gateway Device",
            "level": 1
        })

        edges.append({
            "id": f"edge-wan-gw",
            "source": wan_node_id,
            "target": gateway_id,
            "type": "wan-link",
            "label": "WAN Uplink"
        })

        # Add switches / APs (intermediate level 2)
        intermediate_ids = []
        for inf in infra_devices:
            inf_id = f"dev-{inf.id}"
            intermediate_ids.append(inf_id)
            nodes.append({
                "id": inf_id,
                "label": inf.name or inf.ipv4 or inf.mac,
                "type": "switch",
                "category": inf.category.value,
                "status": inf.status.value,
                "ip": inf.ipv4,
                "mac": inf.mac,
                "vendor": inf.vendor,
                "level": 2
            })
            # Connect infrastructure device to gateway
            edges.append({
                "id": f"edge-gw-{inf.id}",
                "source": gateway_id,
                "target": inf_id,
                "type": "ethernet-trunk",
                "label": "Trunk / AP Link"
            })

        # Add Client Devices (level 3)
        # Connect clients either to intermediate switch/AP if available, or direct to gateway
        for idx, client in enumerate(client_devices):
            cid = f"dev-{client.id}"
            parent_id = intermediate_ids[idx % len(intermediate_ids)] if intermediate_ids else gateway_id
            
            nodes.append({
                "id": cid,
                "label": client.name or client.ipv4 or client.mac,
                "type": "device",
                "category": client.category.value,
                "status": client.status.value,
                "ip": client.ipv4,
                "mac": client.mac,
                "vendor": client.vendor,
                "level": 3
            })

            edges.append({
                "id": f"edge-{parent_id}-{client.id}",
                "source": parent_id,
                "target": cid,
                "type": "lan-access",
                "label": client.interface or "LAN"
            })

        # Return structured topology payload
        return {
            "summary": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "devices_count": len(devices),
                "infra_count": len(infra_devices) + (1 if gateway_device else 0),
            },
            "nodes": nodes,
            "edges": edges
        }

