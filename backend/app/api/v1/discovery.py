from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from app.core.database import get_db
from app.models.entities import UserRole, SystemSetting, NetworkEvent
from app.core.dependencies import get_current_user, require_roles
from app.services.discovery.ingest_service import DeviceIngestionService
from app.services.discovery.nmap_scanner import NmapScanner

router = APIRouter(prefix="/discovery", tags=["Discovery"])

class ScanTriggerRequest(BaseModel):
    cidr: Optional[str] = "192.168.1.0/24"
    modules: Optional[List[str]] = ["arp", "icmp", "ipneigh"]
    ports: Optional[str] = "22,80,443"

class ModuleToggleRequest(BaseModel):
    module: str
    enabled: bool

# In-memory execution state tracking
scan_status = {
    "is_running": False,
    "current_scan_id": None,
    "last_scan_time": None,
    "last_duration_sec": 0,
    "modules_active": ["arp", "icmp", "ipneigh"],
    "total_discovered": 0,
    "logs": []
}

def log_scan_event(message: str, level: str = "INFO"):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "message": message
    }
    scan_status["logs"].insert(0, entry)
    if len(scan_status["logs"]) > 200:
        scan_status["logs"].pop()

async def run_discovery_task(db_factory, cidr: str, modules: List[str], ports: str):
    scan_status["is_running"] = True
    start_time = datetime.now(timezone.utc)
    log_scan_event(f"Starting network sweep on {cidr} using modules: {', '.join(modules)}")

    total_devices = 0
    async with db_factory() as db:
        ingest = DeviceIngestionService(db)

        # 1. Nmap service detection if requested
        if "nmap" in modules:
            log_scan_event("Executing Nmap port and OS scan...")
            scanner = NmapScanner()
            if scanner.is_available():
                results = await scanner.scan_hosts([cidr], ports=ports)
                log_scan_event(f"Nmap scan completed: found {len(results)} hosts")
                batch = []
                for host in results:
                    if host.get("mac"):
                        batch.append({
                            "mac": host["mac"],
                            "ip": host.get("ip"),
                            "vendor": host.get("vendor"),
                            "name": host["hostnames"][0] if host.get("hostnames") else None,
                            "metadata": {
                                "services": host.get("services"),
                                "os_matches": host.get("os_matches")
                            }
                        })
                if batch:
                    events = await ingest.ingest_discovery_batch(batch, source_type="nmap")
                    total_devices += len(batch)
                    log_scan_event(f"Ingested {len(events)} events from Nmap")
            else:
                log_scan_event("Nmap executable not found on system path; skipped.", level="WARNING")

        # 2. Re-evaluating inactive sessions
        closed = await ingest.close_inactive_sessions(timeout_minutes=15)
        if closed > 0:
            log_scan_event(f"Closed {closed} timed out device sessions")

    duration = (datetime.now(timezone.utc) - start_time).total_seconds()
    scan_status["is_running"] = False
    scan_status["last_scan_time"] = datetime.now(timezone.utc).isoformat()
    scan_status["last_duration_sec"] = round(duration, 2)
    scan_status["total_discovered"] = total_devices
    log_scan_event(f"Network sweep finished in {scan_status['last_duration_sec']}s")


@router.post("/scan")
async def trigger_network_scan(
    payload: ScanTriggerRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR, UserRole.OPERATOR]))
):
    if scan_status["is_running"]:
        raise HTTPException(status_code=409, detail="A network scan is already in progress.")

    # Deferred execution with AsyncSessionMaker
    from app.core.database import AsyncSessionLocal
    background_tasks.add_task(
        run_discovery_task,
        AsyncSessionLocal,
        payload.cidr or "192.168.1.0/24",
        payload.modules or ["arp", "icmp", "ipneigh"],
        payload.ports or "22,80,443"
    )

    return {
        "status": "initiated",
        "cidr": payload.cidr,
        "modules": payload.modules,
        "message": "Network discovery sweep launched in background."
    }

@router.get("/status")
async def get_discovery_status(
    current_user = Depends(get_current_user)
):
    return {
        "is_running": scan_status["is_running"],
        "last_scan_time": scan_status["last_scan_time"],
        "last_duration_sec": scan_status["last_duration_sec"],
        "modules_active": scan_status["modules_active"],
        "total_discovered": scan_status["total_discovered"]
    }

@router.get("/logs")
async def get_discovery_logs(
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    return {
        "logs": scan_status["logs"][:limit]
    }

@router.post("/toggle-module")
async def toggle_discovery_module(
    payload: ModuleToggleRequest,
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR]))
):
    if payload.enabled:
        if payload.module not in scan_status["modules_active"]:
            scan_status["modules_active"].append(payload.module)
    else:
        if payload.module in scan_status["modules_active"]:
            scan_status["modules_active"].remove(payload.module)

    log_scan_event(f"Discovery module '{payload.module}' toggled to {payload.enabled}")
    return {"module": payload.module, "enabled": payload.enabled, "active_modules": scan_status["modules_active"]}
