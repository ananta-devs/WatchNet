import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
import uuid
from datetime import datetime, timezone

from app.main import app
from app.core.database import Base, get_db
from app.models.entities import (
    Device,
    DeviceCategory,
    DeviceStatus,
    DeviceSession,
    PresenceHistory,
    User,
    UserRole
)
from app.services.devices.oui_resolver import (
    oui_resolver,
    normalize_mac,
    is_laa_randomized
)
from app.services.devices.classifier import device_classifier
from app.services.devices.device_service import DeviceService
from app.core.security import create_access_token, hash_password

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


def test_oui_resolver():
    # 1. Known OUI vendor resolution
    vendor, is_rand = oui_resolver.lookup("00:03:93:11:22:33")
    assert vendor == "Apple, Inc."
    assert is_rand is False

    vendor, is_rand = oui_resolver.lookup("b8:27:eb:aa:bb:cc")
    assert vendor == "Raspberry Pi Foundation"
    assert is_rand is False

    vendor, is_rand = oui_resolver.lookup("18:fe:34:01:02:03")
    assert vendor == "Espressif Inc."
    assert is_rand is False

    vendor, is_rand = oui_resolver.lookup("00:06:5b:aa:bb:cc")
    assert vendor == "Dell Inc."
    assert is_rand is False

    # 2. RFC 7042 Locally Administered Address (LAA / Randomized MAC)
    assert is_laa_randomized("02:00:00:00:00:01") is True
    assert is_laa_randomized("da:a1:19:12:34:56") is True
    assert is_laa_randomized("00:11:22:33:44:55") is False

    rand_vendor, is_rand = oui_resolver.lookup("02:11:22:33:44:55")
    assert is_rand is True
    assert "Randomized" in rand_vendor

    # 3. Normalization checks
    assert normalize_mac("001122334455") == "00:11:22:33:44:55"
    assert normalize_mac("00-11-22-33-44-55") == "00:11:22:33:44:55"
    assert normalize_mac("AA:BB:CC:DD:EE:FF") == "aa:bb:cc:dd:ee:ff"


def test_device_classifier():
    # 1. Hostname heuristics
    res = device_classifier.classify(
        mac="00:11:22:33:44:55",
        hostname="Anant-iPhone-15"
    )
    assert res["category"] == DeviceCategory.MOBILE
    assert res["confidence"] >= 0.8

    res = device_classifier.classify(
        mac="00:11:22:33:44:55",
        hostname="livingroom-appletv-4k"
    )
    assert res["category"] == DeviceCategory.GAMING_MEDIA

    res = device_classifier.classify(
        mac="00:11:22:33:44:55",
        hostname="esp32-livingroom-temp"
    )
    assert res["category"] == DeviceCategory.IOT_SMART_HOME

    res = device_classifier.classify(
        mac="00:11:22:33:44:55",
        hostname="core-router-unifi-udm"
    )
    assert res["category"] == DeviceCategory.NETWORK_INFRASTRUCTURE

    res = device_classifier.classify(
        mac="00:11:22:33:44:55",
        hostname="truenas-backup-server"
    )
    assert res["category"] == DeviceCategory.SERVER

    # 2. Port clues
    res_ports = device_classifier.classify(
        mac="00:11:22:33:44:55",
        open_ports=[22, 80, 443]
    )
    assert res_ports["category"] == DeviceCategory.SERVER

    # 3. OUI clues
    res_oui = device_classifier.classify(
        mac="18:fe:34:00:00:01" # Espressif
    )
    assert res_oui["category"] == DeviceCategory.IOT_SMART_HOME


@pytest.mark.asyncio
async def test_device_service_field_lock_and_history(db_session):
    service = DeviceService(db_session)

    # 1. Initial automated observation promotes device
    dev = await service.apply_automated_telemetry(
        mac="00:14:22:01:02:03", # Dell
        ip="192.168.1.150",
        hostname="workstation-pc",
        source="arp_scan"
    )
    assert dev.id is not None
    assert dev.name == "workstation-pc"
    assert dev.category == DeviceCategory.DESKTOP_LAPTOP

    # 2. User manually locks the name and customizes category
    updated = await service.update_device(
        device_id=dev.id,
        name="Anant's Main Rig",
        category="Server",
        notes="Home lab development machine",
        locked_fields=["name", "category"]
    )
    assert updated.name == "Anant's Main Rig"
    assert updated.category == DeviceCategory.SERVER
    assert "name" in updated.locked_fields
    assert "category" in updated.locked_fields

    # 3. Subsequent automated scan attempts to overwrite with new hostname & laptop category
    re_scan = await service.apply_automated_telemetry(
        mac="00:14:22:01:02:03",
        ip="192.168.1.155", # IP changed
        hostname="rogue-detected-hostname"
    )
    # Field lock should prevent name & category overwrites!
    assert re_scan.name == "Anant's Main Rig"
    assert re_scan.category == DeviceCategory.SERVER
    # But dynamic fields like IP should update and record history
    assert re_scan.ipv4 == "192.168.1.155"

    # 4. Check device history
    history = await service.get_device_history(dev.id)
    assert "192.168.1.150" in history["ip_history"]
    assert "192.168.1.155" in history["ip_history"]
    assert len(history["sessions"]) >= 1
    assert len(history["events"]) >= 2 # NEW_DEVICE_DETECTED, IP_CHANGED


@pytest.mark.asyncio
async def test_bulk_editing_and_archival(db_session):
    service = DeviceService(db_session)

    d1 = Device(
        id=uuid.uuid4(),
        mac="00:11:22:11:11:01",
        ipv4="192.168.1.101",
        status=DeviceStatus.ONLINE,
        category=DeviceCategory.UNKNOWN
    )
    d2 = Device(
        id=uuid.uuid4(),
        mac="00:11:22:11:11:02",
        ipv4="192.168.1.102",
        status=DeviceStatus.ONLINE,
        category=DeviceCategory.UNKNOWN
    )
    db_session.add_all([d1, d2])
    await db_session.commit()

    # Bulk categorize & tag
    count = await service.bulk_update(
        device_ids=[d1.id, d2.id],
        category="IoT/Smart Home",
        add_tags=["smart-plug", "kitchen"],
        lock_category=True
    )
    assert count == 2

    dev1 = await service.get_device_by_id(d1.id)
    assert dev1.category == DeviceCategory.IOT_SMART_HOME
    assert "smart-plug" in dev1.custom_properties.get("tags", [])
    assert "category" in dev1.locked_fields

    # Bulk archival
    arc_count = await service.bulk_update(
        device_ids=[d1.id],
        is_archived=True
    )
    assert arc_count == 1
    dev1_arc = await service.get_device_by_id(d1.id)
    assert dev1_arc.is_archived is True


@pytest.mark.asyncio
async def test_devices_rest_api(client, db_session):
    # Setup test admin user
    admin = User(
        id=uuid.uuid4(),
        email="device_admin@watchnet.local",
        username="device_admin",
        hashed_password=hash_password("Pass123!"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(admin)
    await db_session.commit()
    token = create_access_token(str(admin.id))
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create device via POST /api/v1/devices
    post_res = await client.post(
        "/api/v1/devices",
        headers=headers,
        json={
            "mac": "b8:27:eb:12:34:56",
            "ipv4": "192.168.1.200",
            "name": "Raspberry Pi OctoPrint",
            "category": "IoT/Smart Home",
            "icon": "cpu",
            "custom_properties": {"tags": ["3d-printer"]}
        }
    )
    assert post_res.status_code == 200
    created = post_res.json()
    device_id = created["id"]
    assert created["vendor"] == "Raspberry Pi Foundation"

    # 2. Get device details via GET /api/v1/devices/{id}
    get_res = await client.get(f"/api/v1/devices/{device_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["mac"] == "b8:27:eb:12:34:56"

    # 3. Update device via PUT /api/v1/devices/{id}
    put_res = await client.put(
        f"/api/v1/devices/{device_id}",
        headers=headers,
        json={
            "name": "OctoPrint Dedicated",
            "notes": "Connected to Ender 3 v2",
            "locked_fields": ["name", "notes"]
        }
    )
    assert put_res.status_code == 200
    assert put_res.json()["name"] == "OctoPrint Dedicated"
    assert "notes" in put_res.json()["locked_fields"]

    # 4. Filter devices via GET /api/v1/devices?vendor=Raspberry&paginate=true
    list_res = await client.get("/api/v1/devices?vendor=Raspberry&paginate=true", headers=headers)
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["total"] >= 1
    assert any(d["id"] == device_id for d in data["devices"])

    # 5. History endpoint GET /api/v1/devices/{id}/history
    hist_res = await client.get(f"/api/v1/devices/{device_id}/history", headers=headers)
    assert hist_res.status_code == 200
    assert "ip_history" in hist_res.json()

    # 6. Presence endpoint GET /api/v1/devices/{id}/presence
    # Seed a presence history record
    p = PresenceHistory(
        device_id=uuid.UUID(device_id),
        date=datetime.now(timezone.utc),
        hourly_bitmap=0b10101
    )
    db_session.add(p)
    await db_session.commit()

    pres_res = await client.get(f"/api/v1/devices/{device_id}/presence?days=7", headers=headers)
    assert pres_res.status_code == 200
    presence_matrix = pres_res.json()
    assert len(presence_matrix) >= 1
    assert len(presence_matrix[0]["hours"]) == 24
    assert presence_matrix[0]["hours"][0] is True # Bit 0 is 1
    assert presence_matrix[0]["hours"][1] is False # Bit 1 is 0
    assert presence_matrix[0]["hours"][2] is True # Bit 2 is 1

    # 7. CIDR subnet filtering test
    cidr_res = await client.get("/api/v1/devices?ip_range=192.168.1.0/24&paginate=true", headers=headers)
    assert cidr_res.status_code == 200
    assert any(d["id"] == device_id for d in cidr_res.json()["devices"])

    # 8. IP Range (dash-separated) filtering test
    range_res = await client.get("/api/v1/devices?ip_range=192.168.1.190-192.168.1.210&paginate=true", headers=headers)
    assert range_res.status_code == 200
    assert any(d["id"] == device_id for d in range_res.json()["devices"])

    # 9. Soft delete (archive) endpoint DELETE /api/v1/devices/{id}
    del_soft = await client.delete(f"/api/v1/devices/{device_id}", headers=headers)
    assert del_soft.status_code == 204
    get_soft = await client.get(f"/api/v1/devices/{device_id}", headers=headers)
    assert get_soft.status_code == 200
    assert get_soft.json()["is_archived"] is True

    # 10. Hard delete endpoint DELETE /api/v1/devices/{id}?hard_delete=true
    del_hard = await client.delete(f"/api/v1/devices/{device_id}?hard_delete=true", headers=headers)
    assert del_hard.status_code == 204
    get_hard = await client.get(f"/api/v1/devices/{device_id}", headers=headers)
    assert get_hard.status_code == 404
