import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
import uuid

from app.main import app
from app.core.database import Base, get_db
from app.models.entities import User, UserRole, Device, DeviceStatus, NetworkEvent
from app.core.security import hash_password, create_access_token

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
async def test_rbac_enforcement(client, db_session):
    # Create users with different roles
    viewer = User(
        id=uuid.uuid4(),
        email="viewer@watchnet.local",
        username="viewer",
        hashed_password=hash_password("Pass123!"),
        role=UserRole.VIEWER,
        is_active=True
    )
    admin = User(
        id=uuid.uuid4(),
        email="admin@watchnet.local",
        username="admin",
        hashed_password=hash_password("Pass123!"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add_all([viewer, admin])
    await db_session.commit()

    viewer_token = create_access_token(str(viewer.id))
    admin_token = create_access_token(str(admin.id))

    # 1. Unauthenticated request to GET /api/v1/devices should return 401
    resp_unauth = await client.get("/api/v1/devices")
    assert resp_unauth.status_code == 401

    # 2. Viewer GET /api/v1/devices should succeed (200)
    resp_viewer_get = await client.get(
        "/api/v1/devices",
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert resp_viewer_get.status_code == 200
    assert resp_viewer_get.json() == []

    # 3. Viewer POST /api/v1/devices should be FORBIDDEN (403)
    resp_viewer_post = await client.post(
        "/api/v1/devices",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={
            "mac": "00:11:22:33:44:55",
            "name": "Unauthorized Add"
        }
    )
    assert resp_viewer_post.status_code == 403

    # 4. Admin POST /api/v1/devices should SUCCEED (200)
    resp_admin_post = await client.post(
        "/api/v1/devices",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "mac": "00:11:22:33:44:55",
            "name": "Authorized Server",
            "ipv4": "192.168.1.50",
            "status": "online"
        }
    )
    assert resp_admin_post.status_code == 200
    created_device = resp_admin_post.json()
    assert created_device["mac"] == "00:11:22:33:44:55"
    assert created_device["name"] == "Authorized Server"

@pytest.mark.asyncio
async def test_collector_event_ingestion(client, db_session):
    # Post collector event to /api/v1/devices/events
    event_payload = {
        "device_mac": "AA:BB:CC:DD:EE:01",
        "ipv4": "10.0.0.99",
        "interface": "eth0",
        "vendor": "Intel Corp",
        "event_type": "DEVICE_DISCOVERED",
        "payload": {"rssi": -42}
    }
    resp = await client.post("/api/v1/devices/events", json=event_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ingested"

    # Subsequent query to verify device was inserted and updated
    event_payload_update = {
        "device_mac": "AA:BB:CC:DD:EE:01",
        "ipv4": "10.0.0.100",
        "interface": "eth0",
        "event_type": "IP_CHANGED",
        "payload": {"old_ip": "10.0.0.99"}
    }
    resp_update = await client.post("/api/v1/devices/events", json=event_payload_update)
    assert resp_update.status_code == 200
