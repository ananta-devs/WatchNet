import pytest
import pytest_asyncio
from datetime import datetime, timezone
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.entities import Device, DeviceSession, NetworkEvent, PresenceHistory, DeviceStatus
from app.services.discovery.ingest_service import DeviceIngestionService
from app.services.discovery.nmap_scanner import NmapScanner

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

@pytest_asyncio.fixture(scope="function")
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestingSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_batch_discovery_and_event_generation(db_session):
    ingest = DeviceIngestionService(db_session)

    # 1. New Device Ingestion
    batch1 = [
        {
            "mac": "aa:bb:cc:dd:ee:01",
            "ip": "192.168.1.101",
            "vendor": "Apple",
            "name": "MacBook-Pro",
            "interface": "eth0"
        }
    ]
    events1 = await ingest.ingest_discovery_batch(batch1, source_type="collector")
    assert len(events1) == 1
    assert events1[0]["event"] == "NEW_DEVICE_DETECTED"
    assert events1[0]["mac"] == "aa:bb:cc:dd:ee:01"

    # Verify device in DB
    res = await db_session.execute(select(Device).where(Device.mac == "aa:bb:cc:dd:ee:01"))
    dev = res.scalars().first()
    assert dev is not None
    assert dev.ipv4 == "192.168.1.101"
    assert dev.status == DeviceStatus.ONLINE

    # Verify active session started
    sess_res = await db_session.execute(
        select(DeviceSession).where(DeviceSession.device_id == dev.id, DeviceSession.is_active == True)
    )
    sess = sess_res.scalars().first()
    assert sess is not None
    assert sess.is_active is True

    # Verify 24-bit hourly presence bitmap updated
    pres_res = await db_session.execute(
        select(PresenceHistory).where(PresenceHistory.device_id == dev.id)
    )
    pres = pres_res.scalars().first()
    assert pres is not None
    now_hour = datetime.now(timezone.utc).hour
    assert (pres.hourly_bitmap & (1 << now_hour)) != 0

    # 2. IP Changed Detection
    batch2 = [
        {
            "mac": "aa:bb:cc:dd:ee:01",
            "ip": "192.168.1.199",
            "vendor": "Apple",
            "name": "MacBook-Pro"
        }
    ]
    events2 = await ingest.ingest_discovery_batch(batch2, source_type="collector")
    assert any(e["event"] == "IP_CHANGED" for e in events2)

    # Verify IP changed in DB and history kept
    await db_session.refresh(dev)
    assert dev.ipv4 == "192.168.1.199"
    assert "192.168.1.101" in dev.custom_properties.get("ip_history", [])

    # 3. Disconnect / Reconnect Cycle
    # Simulate device going offline
    dev.status = DeviceStatus.OFFLINE
    await db_session.commit()

    batch3 = [
        {
            "mac": "aa:bb:cc:dd:ee:01",
            "ip": "192.168.1.199"
        }
    ]
    events3 = await ingest.ingest_discovery_batch(batch3, source_type="collector")
    assert any(e["event"] == "DEVICE_CONNECTED" for e in events3)
    await db_session.refresh(dev)
    assert dev.status == DeviceStatus.ONLINE

@pytest.mark.asyncio
async def test_session_closure_and_timeout(db_session):
    ingest = DeviceIngestionService(db_session)

    # Ingest a device
    batch = [
        {
            "mac": "00:11:22:33:44:55",
            "ip": "192.168.1.200",
            "name": "IoT-Sensor"
        }
    ]
    await ingest.ingest_discovery_batch(batch)

    # Verify active session
    res = await db_session.execute(select(Device).where(Device.mac == "00:11:22:33:44:55"))
    dev = res.scalars().first()
    assert dev is not None

    # Artificially age the device's last_seen
    from datetime import timedelta
    dev.last_seen = datetime.now(timezone.utc) - timedelta(minutes=30)
    await db_session.commit()

    # Trigger session timeout closure (threshold 15 mins)
    closed = await ingest.close_inactive_sessions(timeout_minutes=15)
    assert closed == 1

    await db_session.refresh(dev)
    assert dev.status == DeviceStatus.OFFLINE

    # Verify session closed
    sess_res = await db_session.execute(
        select(DeviceSession).where(DeviceSession.device_id == dev.id)
    )
    sess = sess_res.scalars().first()
    assert sess.is_active is False
    assert sess.session_end is not None

def test_nmap_xml_parser():
    sample_xml = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nmaprun>
<nmaprun scanner="nmap" args="nmap -sV -O 192.168.1.1">
  <host>
    <status state="up" reason="arp-response"/>
    <address addr="192.168.1.1" addrtype="ipv4"/>
    <address addr="00:14:22:01:23:45" addrtype="mac" vendor="Dell"/>
    <hostnames>
      <hostname name="gateway.local" type="PTR"/>
    </hostnames>
    <ports>
      <port protocol="tcp" portid="80">
        <state state="open" reason="syn-ack"/>
        <service name="http" product="nginx" version="1.24.0"/>
      </port>
      <port protocol="tcp" portid="443">
        <state state="open" reason="syn-ack"/>
        <service name="https" product="nginx" version="1.24.0"/>
      </port>
    </ports>
    <os>
      <osmatch name="Linux 5.15" accuracy="95"/>
    </os>
  </host>
</nmaprun>
"""
    scanner = NmapScanner()
    hosts = scanner.parse_nmap_xml(sample_xml)
    assert len(hosts) == 1
    h = hosts[0]
    assert h["ip"] == "192.168.1.1"
    assert h["mac"] == "00:14:22:01:23:45"
    assert h["vendor"] == "Dell"
    assert "gateway.local" in h["hostnames"]
    assert len(h["services"]) == 2
    assert h["services"][0]["port"] == 80
    assert h["services"][0]["service"]["product"] == "nginx"
    assert len(h["os_matches"]) == 1
    assert h["os_matches"][0]["name"] == "Linux 5.15"
