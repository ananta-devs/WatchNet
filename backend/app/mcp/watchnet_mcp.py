import uuid
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Device, DeviceStatus, DeviceCategory, NetworkEvent
from app.models.monitoring import InternetHealthLog, SpeedtestResult

logger = logging.getLogger("watchnet.mcp")


class WatchNetMCPServer:
    """
    Model Context Protocol (MCP) Server Tool Provider for WatchNet.
    Exposes network monitoring and device intelligence tools to AI assistants:
      - get_device_inventory(query, status, category)
      - get_network_health()
      - trigger_network_scan()
      - get_device_details(device_id_or_mac)
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_device_inventory(
        self,
        query: Optional[str] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        List or search network devices with filtering.
        """
        stmt = select(Device).where(Device.is_archived == False)

        if status:
            stmt = stmt.where(Device.status == status)
        if category:
            stmt = stmt.where(Device.category == category)
        if query:
            q_like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Device.name.ilike(q_like),
                    Device.mac.ilike(q_like),
                    Device.ipv4.ilike(q_like),
                    Device.vendor.ilike(q_like)
                )
            )

        stmt = stmt.order_by(Device.last_seen.desc()).limit(limit)
        res = await self.db.execute(stmt)
        devices = res.scalars().all()

        return [
            {
                "id": str(d.id),
                "mac": d.mac,
                "ipv4": d.ipv4,
                "name": d.name or "Unknown",
                "vendor": d.vendor or "Unknown",
                "status": d.status.value if hasattr(d.status, "value") else str(d.status),
                "category": d.category.value if hasattr(d.category, "value") else str(d.category),
                "last_seen": d.last_seen.isoformat() if d.last_seen else None,
                "site_id": str(d.site_id) if d.site_id else None
            }
            for d in devices
        ]

    async def get_network_health(self) -> Dict[str, Any]:
        """
        Summarize network health, online/offline devices count, gateway latency, and speed test.
        """
        # Online / Offline device tally
        dev_stmt = select(
            Device.status,
            func.count(Device.id)
        ).where(Device.is_archived == False).group_by(Device.status)
        dev_res = await self.db.execute(dev_stmt)
        status_map = {str(k.value if hasattr(k, "value") else k): v for k, v in dev_res.all()}

        # Internet health
        gw_stmt = select(InternetHealthLog).order_by(InternetHealthLog.id.desc()).limit(1)
        gw_res = await self.db.execute(gw_stmt)
        gw_log = gw_res.scalars().first()

        # Speedtest
        sp_stmt = select(SpeedtestResult).order_by(SpeedtestResult.id.desc()).limit(1)
        sp_res = await self.db.execute(sp_stmt)
        sp = sp_res.scalars().first()

        return {
            "devices_summary": {
                "online": status_map.get("online", 0),
                "offline": status_map.get("offline", 0),
                "unknown": status_map.get("unknown", 0),
                "total": sum(status_map.values())
            },
            "internet_health": {
                "is_connected": gw_log.is_connected if gw_log else True,
                "gateway_latency_ms": gw_log.gateway_latency_ms if gw_log else None,
                "wan_ip": gw_log.wan_ip if gw_log else None,
                "last_checked": gw_log.timestamp.isoformat() if gw_log else None
            },
            "speedtest": {
                "download_mbps": sp.download_mbps if sp else None,
                "upload_mbps": sp.upload_mbps if sp else None,
                "ping_ms": sp.ping_ms if sp else None,
                "last_speedtest": sp.timestamp.isoformat() if sp else None
            }
        }

    async def trigger_network_scan(self, interface: Optional[str] = None) -> Dict[str, Any]:
        """
        Trigger an on-demand network discovery scan.
        """
        from app.services.discovery.nmap_scanner import nmap_scanner
        logger.info(f"[MCP] Triggering network scan on interface={interface or 'default'}")
        scan_job = await nmap_scanner.trigger_scan(interface=interface)
        return {
            "status": "scan_initiated",
            "job": scan_job
        }

    async def get_device_details(self, device_id_or_mac: str) -> Optional[Dict[str, Any]]:
        """
        Get full details of a specific device by UUID or MAC address.
        """
        target = device_id_or_mac.strip().lower()

        # Try matching UUID
        try:
            dev_uuid = uuid.UUID(target)
            stmt = select(Device).where(Device.id == dev_uuid)
        except ValueError:
            stmt = select(Device).where(Device.mac.ilike(target))

        res = await self.db.execute(stmt)
        dev = res.scalars().first()
        if not dev:
            return None

        # Fetch recent events for this device
        ev_stmt = select(NetworkEvent).where(NetworkEvent.device_id == dev.id).order_by(NetworkEvent.id.desc()).limit(10)
        ev_res = await self.db.execute(ev_stmt)
        events = ev_res.scalars().all()

        return {
            "id": str(dev.id),
            "mac": dev.mac,
            "ipv4": dev.ipv4,
            "ipv6": dev.ipv6,
            "name": dev.name,
            "vendor": dev.vendor,
            "interface": dev.interface,
            "status": dev.status.value if hasattr(dev.status, "value") else str(dev.status),
            "category": dev.category.value if hasattr(dev.category, "value") else str(dev.category),
            "icon": dev.icon,
            "notes": dev.notes,
            "first_seen": dev.first_seen.isoformat() if dev.first_seen else None,
            "last_seen": dev.last_seen.isoformat() if dev.last_seen else None,
            "site_id": str(dev.site_id) if dev.site_id else None,
            "recent_events": [
                {
                    "event_type": ev.event_type,
                    "severity": ev.severity.value if hasattr(ev.severity, "value") else str(ev.severity),
                    "timestamp": ev.timestamp.isoformat() if ev.timestamp else None,
                    "payload": ev.payload
                }
                for ev in events
            ]
        }


# Standard JSON-RPC stdio entrypoint for Claude Desktop / Cursor / AI agents
if __name__ == "__main__":
    import sys
    import json
    import asyncio
    from app.core.database import AsyncSessionLocal

    async def run_stdio_mcp():
        async with AsyncSessionLocal() as session:
            server = WatchNetMCPServer(session)
            # Read single request or loop over stdin lines
            for line in sys.stdin:
                line = line.strip().lstrip("\ufeff")
                if not line:
                    continue
                try:
                    req = json.loads(line)
                    method = req.get("method")
                    req_id = req.get("id")
                    params = req.get("params", {})

                    if method == "tools/list":
                        resp = {
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "result": {
                                "tools": [
                                    {
                                        "name": "get_device_inventory",
                                        "description": "List and filter network devices",
                                        "inputSchema": {
                                            "type": "object",
                                            "properties": {
                                                "query": {"type": "string"},
                                                "status": {"type": "string"},
                                                "category": {"type": "string"},
                                                "limit": {"type": "integer", "default": 50}
                                            }
                                        }
                                    },
                                    {
                                        "name": "get_network_health",
                                        "description": "Get network devices summary, internet gateway health, and speedtest metrics",
                                        "inputSchema": {"type": "object"}
                                    },
                                    {
                                        "name": "trigger_network_scan",
                                        "description": "Trigger network scan discovery on an interface",
                                        "inputSchema": {
                                            "type": "object",
                                            "properties": {
                                                "interface": {"type": "string"}
                                            }
                                        }
                                    },
                                    {
                                        "name": "get_device_details",
                                        "description": "Get deep details and recent events for a device by MAC or UUID",
                                        "inputSchema": {
                                            "type": "object",
                                            "properties": {
                                                "device_id_or_mac": {"type": "string"}
                                            },
                                            "required": ["device_id_or_mac"]
                                        }
                                    }
                                ]
                            }
                        }
                    elif method == "tools/call":
                        tool_name = params.get("name")
                        args = params.get("arguments", {})
                        if tool_name == "get_device_inventory":
                            data = await server.get_device_inventory(
                                query=args.get("query"),
                                status=args.get("status"),
                                category=args.get("category"),
                                limit=args.get("limit", 50)
                            )
                        elif tool_name == "get_network_health":
                            data = await server.get_network_health()
                        elif tool_name == "trigger_network_scan":
                            data = await server.trigger_network_scan(interface=args.get("interface"))
                        elif tool_name == "get_device_details":
                            data = await server.get_device_details(args.get("device_id_or_mac", ""))
                        else:
                            data = {"error": f"Unknown tool: {tool_name}"}

                        resp = {
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "result": {
                                "content": [
                                    {"type": "text", "text": json.dumps(data, indent=2)}
                                ]
                            }
                        }
                    else:
                        resp = {
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "result": {}
                        }
                    sys.stdout.write(json.dumps(resp) + "\n")
                    sys.stdout.flush()
                except Exception as e:
                    err_resp = {
                        "jsonrpc": "2.0",
                        "id": req.get("id") if "req" in locals() and isinstance(req, dict) else None,
                        "error": {"code": -32603, "message": str(e)}
                    }
                    sys.stdout.write(json.dumps(err_resp) + "\n")
                    sys.stdout.flush()

    try:
        asyncio.run(run_stdio_mcp())
    except (KeyboardInterrupt, BrokenPipeError):
        pass


