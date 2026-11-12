from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, func
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import uuid

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.entities import UserRole, Device
from app.models.monitoring import (
    InternetHealthLog,
    SpeedtestResult,
    WebsiteTarget,
    WebsiteCheckLog,
    DevicePortScan
)
from app.schemas.monitoring import (
    InternetHealthResponse,
    SpeedtestRunResponse,
    WebsiteTargetCreate,
    WebsiteTargetResponse,
    DevicePortScanResponse,
    DevicePortScanItem
)
from app.services.monitoring.internet_monitor import InternetMonitor
from app.services.monitoring.speedtest_service import SpeedtestService
from app.services.monitoring.website_monitor import WebsiteMonitor
from app.services.monitoring.port_scanner import PortScanner

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])

# 1. Internet Monitoring Endpoints
@router.get("/internet", response_model=InternetHealthResponse)
async def get_internet_status(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get current WAN status, DNS resolution times, gateway health, and 24h availability history.
    """
    monitor = InternetMonitor()
    check = await monitor.run_full_check()

    # Save telemetry snapshot
    log_entry = InternetHealthLog(
        wan_ip=check.get("wan_ip"),
        gateway_latency_ms=check.get("gateway_latency_ms"),
        dns_resolution_ms=check.get("dns_resolution_ms"),
        is_connected=check.get("is_connected", False),
        details={"resolvers": check.get("dns_resolvers")}
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)

    # Fetch last 24h history logs
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    history_stmt = select(InternetHealthLog).where(
        InternetHealthLog.timestamp >= since_24h
    ).order_by(desc(InternetHealthLog.timestamp)).limit(50)
    
    history_res = await db.execute(history_stmt)
    history_rows = history_res.scalars().all()

    history_data = [
        {
            "timestamp": row.timestamp.isoformat(),
            "wan_ip": row.wan_ip,
            "gateway_latency_ms": row.gateway_latency_ms,
            "dns_resolution_ms": row.dns_resolution_ms,
            "is_connected": row.is_connected
        }
        for row in reversed(history_rows)
    ]

    return {
        "timestamp": log_entry.timestamp,
        "wan_ip": log_entry.wan_ip,
        "gateway_latency_ms": log_entry.gateway_latency_ms,
        "dns_resolution_ms": log_entry.dns_resolution_ms,
        "is_connected": log_entry.is_connected,
        "dns_resolvers": check.get("dns_resolvers"),
        "history_24h": history_data
    }


# 2. Speedtest Endpoints
@router.post("/speedtest/run", response_model=SpeedtestRunResponse)
async def run_speedtest(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR, UserRole.OPERATOR]))
):
    """
    Trigger immediate internet speedtest and persist telemetry.
    """
    service = SpeedtestService()
    res = await service.run_speedtest()

    result_model = SpeedtestResult(
        download_mbps=res["download_mbps"],
        upload_mbps=res["upload_mbps"],
        ping_ms=res["ping_ms"],
        jitter_ms=res["jitter_ms"],
        server_name=res["server_name"],
        server_location=res["server_location"],
        client_ip=res["client_ip"]
    )
    db.add(result_model)
    await db.commit()
    await db.refresh(result_model)

    return result_model


@router.get("/speedtest/history", response_model=List[SpeedtestRunResponse])
async def get_speedtest_history(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Retrieve historical speedtest metrics for chart rendering.
    """
    stmt = select(SpeedtestResult).order_by(desc(SpeedtestResult.timestamp)).limit(limit)
    res = await db.execute(stmt)
    results = res.scalars().all()
    return list(reversed(results))


# 3. Website Monitoring Endpoints
@router.get("/websites", response_model=List[WebsiteTargetResponse])
async def list_website_targets(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List monitored websites with status, uptime percentage, and SSL expiration alerts.
    """
    stmt = select(WebsiteTarget).order_by(WebsiteTarget.created_at)
    res = await db.execute(stmt)
    targets = res.scalars().all()

    output = []
    for t in targets:
        # Calculate uptime % from last 50 logs
        logs_stmt = select(WebsiteCheckLog).where(
            WebsiteCheckLog.target_id == t.id
        ).order_by(desc(WebsiteCheckLog.timestamp)).limit(50)
        logs_res = await db.execute(logs_stmt)
        logs = logs_res.scalars().all()
        if logs:
            up_count = sum(1 for log in logs if log.is_up)
            uptime_pct = round((up_count / len(logs)) * 100.0, 1)
        else:
            uptime_pct = 100.0 if t.is_up else 0.0

        item = WebsiteTargetResponse.model_validate(t)
        item.uptime_percentage = uptime_pct
        output.append(item)

    return output


@router.post("/websites", response_model=WebsiteTargetResponse, status_code=status.HTTP_201_CREATED)
async def create_website_target(
    payload: WebsiteTargetCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR, UserRole.OPERATOR]))
):
    """
    Add a new website target to monitor and immediately execute the first probe.
    """
    # Quick probe on creation
    monitor = WebsiteMonitor()
    probe = await monitor.check_endpoint(payload.url)

    target = WebsiteTarget(
        url=payload.url,
        name=payload.name or payload.url,
        check_interval_sec=payload.check_interval_sec,
        is_active=True,
        last_status_code=probe.get("status_code"),
        last_latency_ms=probe.get("latency_ms"),
        ssl_days_remaining=probe.get("ssl_days_remaining"),
        is_up=probe.get("is_up", False)
    )
    db.add(target)
    await db.flush()

    # Add initial check log
    log = WebsiteCheckLog(
        target_id=target.id,
        status_code=probe.get("status_code"),
        latency_ms=probe.get("latency_ms"),
        is_up=probe.get("is_up", False),
        error_message=probe.get("error_message")
    )
    db.add(log)
    await db.commit()
    await db.refresh(target)

    resp = WebsiteTargetResponse.model_validate(target)
    resp.uptime_percentage = 100.0 if target.is_up else 0.0
    return resp


@router.post("/websites/{target_id}/check", response_model=WebsiteTargetResponse)
async def check_website_target(
    target_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR, UserRole.OPERATOR]))
):
    """
    Trigger immediate check of a monitored website.
    """
    stmt = select(WebsiteTarget).where(WebsiteTarget.id == target_id)
    res = await db.execute(stmt)
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Website target not found")

    monitor = WebsiteMonitor()
    probe = await monitor.check_endpoint(target.url)

    target.last_status_code = probe.get("status_code")
    target.last_latency_ms = probe.get("latency_ms")
    target.ssl_days_remaining = probe.get("ssl_days_remaining")
    target.is_up = probe.get("is_up", False)

    log = WebsiteCheckLog(
        target_id=target.id,
        status_code=probe.get("status_code"),
        latency_ms=probe.get("latency_ms"),
        is_up=probe.get("is_up", False),
        error_message=probe.get("error_message")
    )
    db.add(log)
    await db.commit()
    await db.refresh(target)

    resp = WebsiteTargetResponse.model_validate(target)
    resp.uptime_percentage = 100.0 if target.is_up else 0.0
    return resp


@router.delete("/websites/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_website_target(
    target_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR]))
):
    """
    Remove website target.
    """
    stmt = select(WebsiteTarget).where(WebsiteTarget.id == target_id)
    res = await db.execute(stmt)
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Website target not found")

    await db.delete(target)
    await db.commit()
    return None


# 4. Device Port Scanning Endpoints
@router.post("/devices/{device_id}/scan-ports", response_model=DevicePortScanResponse)
async def scan_device_ports(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_roles([UserRole.OWNER, UserRole.ADMINISTRATOR, UserRole.OPERATOR]))
):
    """
    Trigger TCP port scan on a specific LAN device.
    """
    stmt = select(Device).where(Device.id == device_id)
    res = await db.execute(stmt)
    device = res.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if not device.ipv4:
        raise HTTPException(status_code=400, detail="Device does not have a valid IPv4 address to scan")

    scanner = PortScanner()
    open_ports = await scanner.scan_target(device.ipv4)

    # Delete prior scan records for device and insert new findings
    del_stmt = select(DevicePortScan).where(DevicePortScan.device_id == device.id)
    del_res = await db.execute(del_stmt)
    for p in del_res.scalars().all():
        await db.delete(p)

    scan_models = []
    for p in open_ports:
        scan_record = DevicePortScan(
            device_id=device.id,
            port=p["port"],
            protocol=p["protocol"],
            service_name=p["service_name"],
            state=p["state"],
            banner=p["banner"]
        )
        db.add(scan_record)
        scan_models.append(scan_record)

    await db.commit()

    return {
        "device_id": device.id,
        "ports": [
            DevicePortScanItem(
                port=p.port,
                protocol=p.protocol,
                service_name=p.service_name,
                state=p.state,
                banner=p.banner,
                last_scanned=p.last_scanned
            )
            for p in scan_models
        ],
        "total_open": len(scan_models)
    }


@router.get("/devices/{device_id}/ports", response_model=DevicePortScanResponse)
async def get_device_ports(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get detected open ports and services for a device.
    """
    stmt = select(Device).where(Device.id == device_id)
    res = await db.execute(stmt)
    device = res.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    ports_stmt = select(DevicePortScan).where(DevicePortScan.device_id == device.id).order_by(DevicePortScan.port)
    ports_res = await db.execute(ports_stmt)
    ports = ports_res.scalars().all()

    return {
        "device_id": device.id,
        "ports": [
            DevicePortScanItem(
                port=p.port,
                protocol=p.protocol,
                service_name=p.service_name,
                state=p.state,
                banner=p.banner,
                last_scanned=p.last_scanned
            )
            for p in ports
        ],
        "total_open": len(ports)
    }
