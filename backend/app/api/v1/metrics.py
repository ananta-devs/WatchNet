import time
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.entities import Device, DeviceStatus, DeviceCategory, NetworkEvent
from app.models.monitoring import InternetHealthLog, SpeedtestResult

START_TIME = time.time()

router = APIRouter(tags=["Metrics"])


@router.get("/metrics")
async def get_prometheus_metrics(db: AsyncSession = Depends(get_db)):
    """
    Prometheus exporter endpoint: GET /api/v1/metrics
    Exports standard Prometheus metrics:
      - watchnet_devices_total{status="...", category="..."}
      - watchnet_events_total{type="..."}
      - watchnet_gateway_latency_ms
      - watchnet_speedtest_download_mbps
      - watchnet_speedtest_upload_mbps
      - watchnet_system_uptime_seconds
    """
    lines = []

    # 1. Device counts grouped by status and category
    dev_stmt = select(
        Device.status,
        Device.category,
        func.count(Device.id)
    ).group_by(Device.status, Device.category)
    dev_res = await db.execute(dev_stmt)
    dev_counts = dev_res.all()

    lines.append("# HELP watchnet_devices_total Total number of tracked devices by status and category")
    lines.append("# TYPE watchnet_devices_total gauge")
    if dev_counts:
        for status_val, cat_val, count in dev_counts:
            s_str = status_val.value if hasattr(status_val, "value") else str(status_val)
            c_str = cat_val.value if hasattr(cat_val, "value") else str(cat_val)
            lines.append(f'watchnet_devices_total{{status="{s_str}",category="{c_str}"}} {count}')
    else:
        # Defaults if empty
        lines.append('watchnet_devices_total{status="online",category="Unknown"} 0')
        lines.append('watchnet_devices_total{status="offline",category="Unknown"} 0')

    # 2. Network Events total grouped by type
    ev_stmt = select(
        NetworkEvent.event_type,
        func.count(NetworkEvent.id)
    ).group_by(NetworkEvent.event_type)
    ev_res = await db.execute(ev_stmt)
    ev_counts = ev_res.all()

    lines.append("# HELP watchnet_events_total Total number of logged network events by type")
    lines.append("# TYPE watchnet_events_total counter")
    if ev_counts:
        for etype, count in ev_counts:
            lines.append(f'watchnet_events_total{{type="{etype}"}} {count}')
    else:
        lines.append('watchnet_events_total{type="DISCOVERY"} 0')

    # 3. Gateway latency
    gw_stmt = select(InternetHealthLog.gateway_latency_ms).order_by(InternetHealthLog.id.desc()).limit(1)
    gw_res = await db.execute(gw_stmt)
    gw_latency = gw_res.scalars().first() or 0.0

    lines.append("# HELP watchnet_gateway_latency_ms Recent gateway ping round-trip latency in milliseconds")
    lines.append("# TYPE watchnet_gateway_latency_ms gauge")
    lines.append(f"watchnet_gateway_latency_ms {round(float(gw_latency), 2)}")

    # 4. Speedtest Download & Upload
    sp_stmt = select(SpeedtestResult.download_mbps, SpeedtestResult.upload_mbps).order_by(SpeedtestResult.id.desc()).limit(1)
    sp_res = await db.execute(sp_stmt)
    sp_row = sp_res.first()
    dl_mbps = float(sp_row[0]) if sp_row and sp_row[0] is not None else 0.0
    ul_mbps = float(sp_row[1]) if sp_row and sp_row[1] is not None else 0.0

    lines.append("# HELP watchnet_speedtest_download_mbps Most recent measured download speed in Mbps")
    lines.append("# TYPE watchnet_speedtest_download_mbps gauge")
    lines.append(f"watchnet_speedtest_download_mbps {round(dl_mbps, 2)}")

    lines.append("# HELP watchnet_speedtest_upload_mbps Most recent measured upload speed in Mbps")
    lines.append("# TYPE watchnet_speedtest_upload_mbps gauge")
    lines.append(f"watchnet_speedtest_upload_mbps {round(ul_mbps, 2)}")

    # 5. System uptime
    uptime_sec = time.time() - START_TIME
    lines.append("# HELP watchnet_system_uptime_seconds Total runtime of the WatchNet backend service in seconds")
    lines.append("# TYPE watchnet_system_uptime_seconds counter")
    lines.append(f"watchnet_system_uptime_seconds {int(uptime_sec)}")

    # Prometheus text format requires trailing newline
    content = "\n".join(lines) + "\n"
    return Response(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")

