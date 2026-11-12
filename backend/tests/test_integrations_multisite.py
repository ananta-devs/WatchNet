import pytest
import pytest_asyncio
import json
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
import uuid

from app.main import app
from app.core.database import Base, get_db
from app.models.entities import User, UserRole, Device, DeviceStatus, DeviceCategory, NetworkEvent
from app.models.multisite import RemoteSite, SiteSyncLog
from app.models.monitoring import InternetHealthLog, SpeedtestResult
from app.core.security import hash_password, create_access_token
from app.core.event_broker import event_broker
from app.services.integrations.home_assistant import HomeAssistantIntegration
from app.mcp.watchnet_mcp import WatchNetMCPServer
from app.services.multisite.sync_service import MultiSiteSyncService

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
async def test_sse_event_stream_formatting(client):
    """Verify Server-Sent Events (SSE) /api/v1/events/stream initial frame format."""
    # Connect to stream
    async with client.stream("GET", "/api/v1/events/stream") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        
        # Read the first event chunk
        lines = []
        async for line in response.aiter_lines():
            lines.append(line)
            if "ping" in line or "connected" in line:
                break
            if len(lines) > 5:
                break

        full_output = "\n".join(lines)
        assert "ping" in full_output or "connected" in full_output
        await response.aclose()


@pytest.mark.asyncio
async def test_prometheus_metrics_generation(client, db_session):
    """Verify Prometheus exporter endpoint /api/v1/metrics exports all required standard metrics."""
    # Seed devices and logs
    dev = Device(
        mac="11:22:33:44:55:66",
        ipv4="192.168.1.50",
        name="NAS Server",
        status=DeviceStatus.ONLINE,
        category=DeviceCategory.SERVER
    )
    event = NetworkEvent(
        event_type="NEW_DEVICE_DETECTED",
        payload={"ip": "192.168.1.50"}
    )
    health = InternetHealthLog(
        is_connected=True,
        gateway_latency_ms=12.45
    )
    speed = SpeedtestResult(
        download_mbps=245.5,
        upload_mbps=48.2,
        ping_ms=10.5
    )
    db_session.add_all([dev, event, health, speed])
    await db_session.commit()

    resp = await client.get("/api/v1/metrics")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    body = resp.text

    assert "watchnet_devices_total" in body
    assert 'status="online"' in body
    assert "watchnet_events_total" in body
    assert 'type="NEW_DEVICE_DETECTED"' in body
    assert "watchnet_gateway_latency_ms 12.45" in body
    assert "watchnet_speedtest_download_mbps 245.5" in body
    assert "watchnet_speedtest_upload_mbps 48.2" in body
    assert "watchnet_system_uptime_seconds" in body


@pytest.mark.asyncio
async def test_home_assistant_mqtt_and_webhook():
    """Verify Home Assistant MQTT auto-discovery payload schemas and Webhook structure."""
    ha = HomeAssistantIntegration(ha_url="http://homeassistant.local:8123", webhook_id="watchnet-test-hook")

    sample_device = {
        "mac": "aa:bb:cc:dd:ee:ff",
        "name": "Smart Thermostat",
        "status": "online",
        "category": "IoT/Smart Home",
        "vendor": "Ecobee Inc.",
        "ipv4": "192.168.1.105"
    }

    # 1. Device tracker config
    tracker = ha.build_mqtt_device_tracker_config(sample_device, discovery_prefix="homeassistant")
    assert tracker["topic"] == "homeassistant/device_tracker/watchnet_aabbccddeeff/config"
    assert tracker["payload"]["unique_id"] == "watchnet_tracker_aabbccddeeff"
    assert tracker["payload"]["payload_home"] == "home"
    assert tracker["payload"]["payload_not_home"] == "not_home"
    assert tracker["state_value"] == "home"
    assert tracker["payload"]["device"]["identifiers"] == ["watchnet_aabbccddeeff"]

    # 2. Sensor config
    sensor = ha.build_mqtt_sensor_config(sample_device, sensor_type="ip", discovery_prefix="homeassistant")
    assert sensor["topic"] == "homeassistant/sensor/watchnet_aabbccddeeff_ip/config"
    assert sensor["payload"]["unique_id"] == "watchnet_sensor_aabbccddeeff_ip"
    assert sensor["state_value"] == "192.168.1.105"


@pytest.mark.asyncio
async def test_mcp_server_tools(db_session):
    """Verify WatchNet Model Context Protocol (MCP) tool provider operations."""
    dev = Device(
        mac="00:aa:bb:cc:dd:ee",
        ipv4="192.168.1.120",
        name="Developer Laptop",
        category=DeviceCategory.DESKTOP_LAPTOP,
        status=DeviceStatus.ONLINE,
        vendor="Apple"
    )
    health = InternetHealthLog(is_connected=True, gateway_latency_ms=8.5, wan_ip="203.0.113.1")
    speed = SpeedtestResult(download_mbps=350.0, upload_mbps=100.0, ping_ms=6.0)
    db_session.add_all([dev, health, speed])
    await db_session.commit()

    mcp = WatchNetMCPServer(db_session)

    # 1. get_device_inventory
    inventory = await mcp.get_device_inventory(query="Developer", status="online")
    assert len(inventory) == 1
    assert inventory[0]["mac"] == "00:aa:bb:cc:dd:ee"
    assert inventory[0]["vendor"] == "Apple"

    # 2. get_network_health
    net_health = await mcp.get_network_health()
    assert net_health["devices_summary"]["online"] >= 1
    assert net_health["internet_health"]["is_connected"] is True
    assert net_health["internet_health"]["gateway_latency_ms"] == 8.5
    assert net_health["speedtest"]["download_mbps"] == 350.0

    # 3. get_device_details
    details = await mcp.get_device_details("00:aa:bb:cc:dd:ee")
    assert details is not None
    assert details["name"] == "Developer Laptop"
    assert details["category"] == "Desktop/Laptop"


@pytest.mark.asyncio
async def test_multisite_registration_and_sync(client, db_session):
    """Verify Remote Site registration, token authentication, and batch discovery sync."""
    # 1. Create Administrator user for registration
    admin_user = User(
        email="site_admin@example.com",
        username="site_admin",
        hashed_password=hash_password("AdminPass123!"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(admin_user)
    await db_session.commit()

    admin_token = create_access_token(subject=str(admin_user.id))
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Register Remote Site
    register_payload = {
        "name": "Branch Office East",
        "location": "Boston, MA",
        "interface": "eth1"
    }
    resp = await client.post("/api/v1/sync/register", json=register_payload, headers=auth_headers)
    assert resp.status_code == 201
    reg_data = resp.json()
    assert reg_data["name"] == "Branch Office East"
    assert "api_key" in reg_data
    site_id = reg_data["id"]
    site_key = reg_data["api_key"]

    # 3. Verify duplicate registration fails
    dup_resp = await client.post("/api/v1/sync/register", json=register_payload, headers=auth_headers)
    assert dup_resp.status_code == 400

    # 4. Ingest batch discovery payload from remote site collector
    batch_data = {
        "batch": [
            {
                "mac": "bc:24:11:22:33:44",
                "ip": "10.0.1.15",
                "vendor": "Cisco Systems",
                "name": "Branch-Switch-01",
                "interface": "eth1"
            },
            {
                "mac": "bc:24:11:22:33:45",
                "ip": "10.0.1.20",
                "vendor": "Dell Inc.",
                "name": "Branch-FileServer",
                "interface": "eth1"
            }
        ]
    }

    # Try ingest without auth header
    unauth_resp = await client.post("/api/v1/sync/ingest", json=batch_data)
    assert unauth_resp.status_code == 401

    # Ingest with valid X-Site-Key
    site_headers = {"X-Site-Key": site_key}
    sync_resp = await client.post("/api/v1/sync/ingest", json=batch_data, headers=site_headers)
    assert sync_resp.status_code == 200
    sync_res = sync_resp.json()
    assert sync_res["status"] == "success"
    assert sync_res["synced_count"] == 2
    assert sync_res["site_name"] == "Branch Office East"

    # 5. List remote nodes
    nodes_resp = await client.get("/api/v1/sync/nodes", headers=auth_headers)
    assert nodes_resp.status_code == 200
    nodes = nodes_resp.json()
    assert len(nodes) >= 1
    branch_node = next((n for n in nodes if n["name"] == "Branch Office East"), None)
    assert branch_node is not None
    assert branch_node["status"] == "ONLINE"
    assert branch_node["device_count"] == 2
    assert branch_node["location"] == "Boston, MA"

    # 6. Verify device inventory filtering by site_id
    dev_filter_resp = await client.get(f"/api/v1/devices?site_id={site_id}&paginate=true", headers=auth_headers)
    assert dev_filter_resp.status_code == 200
    filtered_data = dev_filter_resp.json()
    assert filtered_data["total"] == 2
    assert len(filtered_data["devices"]) == 2
    assert all(str(d["site_id"]) == str(site_id) for d in filtered_data["devices"])

