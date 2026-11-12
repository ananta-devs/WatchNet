import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
import uuid

from app.main import app
from app.core.database import Base, get_db
from app.models.entities import User, UserRole, Device, DeviceStatus, DeviceCategory
from app.core.security import hash_password, create_access_token
from app.services.monitoring.internet_monitor import InternetMonitor
from app.services.monitoring.speedtest_service import SpeedtestService
from app.services.monitoring.website_monitor import WebsiteMonitor
from app.services.monitoring.port_scanner import PortScanner
from app.services.monitoring.topology_service import TopologyService

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

@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_internet_monitor_service():
    monitor = InternetMonitor(timeout=2.0)
    check = await monitor.run_full_check()
    assert "timestamp" in check
    assert "is_connected" in check
    assert "dns_resolvers" in check
    assert isinstance(check["dns_resolvers"], dict)

@pytest.mark.asyncio
async def test_speedtest_service():
    service = SpeedtestService(timeout=5.0)
    res = await service.run_speedtest()
    assert "download_mbps" in res
    assert "upload_mbps" in res
    assert "ping_ms" in res
    assert res["download_mbps"] >= 0
    assert res["ping_ms"] >= 0

@pytest.mark.asyncio
async def test_website_monitor_service():
    monitor = WebsiteMonitor(timeout=5.0)
    res = await monitor.check_endpoint("https://cloudflare.com")
    assert "url" in res
    assert "latency_ms" in res
    assert "is_up" in res
    assert res["is_up"] is True
    assert res["status_code"] in (200, 301, 302, 308)
    assert res["ssl_days_remaining"] is not None
    assert res["ssl_days_remaining"] > 0

@pytest.mark.asyncio
async def test_port_scanner_service():
    scanner = PortScanner(timeout=0.5)
    # Scanning loopback port
    results = await scanner.scan_target("127.0.0.1", ports=[9999])
    assert isinstance(results, list)

@pytest.mark.asyncio
async def test_topology_service(db_session):
    # Seed devices
    gw = Device(
        mac="00:11:22:33:44:01",
        ipv4="192.168.1.1",
        name="Router-GW",
        category=DeviceCategory.NETWORK_INFRASTRUCTURE,
        status=DeviceStatus.ONLINE
    )
    pc = Device(
        mac="00:11:22:33:44:02",
        ipv4="192.168.1.100",
        name="Workstation-PC",
        category=DeviceCategory.DESKTOP_LAPTOP,
        status=DeviceStatus.ONLINE
    )
    db_session.add_all([gw, pc])
    await db_session.commit()

    topo = TopologyService(db_session)
    data = await topo.build_topology()

    assert "nodes" in data
    assert "edges" in data
    assert "summary" in data
    assert data["summary"]["devices_count"] >= 2
    assert any(n["type"] == "cloud" for n in data["nodes"])
    assert any(n["type"] == "router" for n in data["nodes"])

@pytest.mark.asyncio
async def test_monitoring_api_endpoints(client, db_session):
    # Create admin user
    admin_user = User(
        email="admin_mon@example.com",
        username="admin_mon",
        hashed_password=hash_password("AdminPass123!"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(admin_user)
    await db_session.commit()

    token = create_access_token(subject=str(admin_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Internet Status
    resp = await client.get("/api/v1/monitoring/internet", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "is_connected" in data
    assert "history_24h" in data

    # 2. Speedtest Trigger
    resp = await client.post("/api/v1/monitoring/speedtest/run", headers=headers)
    assert resp.status_code == 200
    speed_data = resp.json()
    assert "download_mbps" in speed_data

    # 3. Speedtest History
    resp = await client.get("/api/v1/monitoring/speedtest/history", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # 4. Websites CRUD
    site_payload = {"url": "https://example.com", "name": "Example Corp", "check_interval_sec": 60}
    resp = await client.post("/api/v1/monitoring/websites", json=site_payload, headers=headers)
    assert resp.status_code == 201
    site_data = resp.json()
    site_id = site_data["id"]
    assert site_data["name"] == "Example Corp"

    # List websites
    resp = await client.get("/api/v1/monitoring/websites", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # Check website
    resp = await client.post(f"/api/v1/monitoring/websites/{site_id}/check", headers=headers)
    assert resp.status_code == 200

    # Delete website
    resp = await client.delete(f"/api/v1/monitoring/websites/{site_id}", headers=headers)
    assert resp.status_code == 204

    # 5. Device Port Scanning
    dev = Device(
        mac="AA:BB:CC:DD:EE:01",
        ipv4="127.0.0.1",
        name="Localhost Probe Target",
        category=DeviceCategory.SERVER,
        status=DeviceStatus.ONLINE
    )
    db_session.add(dev)
    await db_session.commit()

    resp = await client.post(f"/api/v1/monitoring/devices/{dev.id}/scan-ports", headers=headers)
    assert resp.status_code == 200
    scan_res = resp.json()
    assert "ports" in scan_res
    assert "total_open" in scan_res

    resp = await client.get(f"/api/v1/monitoring/devices/{dev.id}/ports", headers=headers)
    assert resp.status_code == 200

    # 6. Topology Endpoint
    resp = await client.get("/api/v1/topology", headers=headers)
    assert resp.status_code == 200
    topo_data = resp.json()
    assert "nodes" in topo_data
    assert "edges" in topo_data
