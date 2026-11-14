import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
import uuid
from datetime import datetime, timezone, timedelta

from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.core.crypto import encrypt_secret, decrypt_secret, CryptoEngine
from app.models.entities import (
    User,
    UserRole,
    Device,
    DeviceStatus,
    DeviceCategory,
    DeviceSession,
    NetworkEvent,
    AuditLog,
    SystemSetting
)
from app.services.system.backup_service import BackupService
from app.services.system.maintenance_service import MaintenanceService

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

@pytest_asyncio.fixture
async def admin_token(db_session: AsyncSession):
    admin = User(
        id=uuid.uuid4(),
        email="admin_sys@watchnet.local",
        username="admin_sys",
        hashed_password=hash_password("admin123456"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(admin)
    await db_session.commit()
    return create_access_token(subject=str(admin.id))

# -------------------------------------------------------------------
# Test Crypto Envelope Encryption
# -------------------------------------------------------------------
def test_envelope_encryption():
    secret = "SuperSecretPassword123!"
    encrypted = encrypt_secret(secret)
    assert encrypted != secret
    assert encrypted.startswith("wn:enc:v1:")
    
    decrypted = decrypt_secret(encrypted)
    assert decrypted == secret

    # Key rotation test
    new_master = "new-super-secret-key-that-is-at-least-32-chars-long!"
    rotated = CryptoEngine().rotate_secret(encrypted, new_master)
    assert rotated.startswith("wn:enc:v1:")
    
    # Decrypt with new engine
    new_engine = CryptoEngine(master_secret=new_master)
    assert new_engine.decrypt(rotated) == secret

# -------------------------------------------------------------------
# Test Backup & Restore Service
# -------------------------------------------------------------------
@pytest.mark.asyncio
async def test_backup_and_restore_cycle(db_session: AsyncSession):
    backup_svc = BackupService(db_session)

    # 1. Populate a test device and setting
    device = Device(
        mac="AA:BB:CC:11:22:33",
        name="Backup Test TV",
        category=DeviceCategory.GAMING_MEDIA,
        status=DeviceStatus.ONLINE,
        ipv4="192.168.1.105"
    )
    setting = SystemSetting(
        key="test_backup_key",
        value="test_backup_val",
        is_encrypted=False
    )
    db_session.add(device)
    db_session.add(setting)
    await db_session.commit()

    # 2. Create backup archive
    filename, filepath = await backup_svc.create_backup(backup_type="json")
    assert filename.endswith(".zip")

    # Read backup bytes
    with open(filepath, "rb") as f:
        backup_bytes = f.read()

    # 3. Simulate disaster: delete device
    await db_session.delete(device)
    await db_session.commit()

    # 4. Restore from backup
    restore_res = await backup_svc.restore_backup(backup_bytes)
    assert restore_res["success"] is True
    assert restore_res["restored_counts"]["devices"] >= 1
    assert restore_res["restored_counts"]["settings"] >= 1

    # Cleanup backup file
    backup_svc.delete_backup(filename)

# -------------------------------------------------------------------
# Test Standard CSV Export & Import
# -------------------------------------------------------------------
@pytest.mark.asyncio
async def test_device_csv_export_import(db_session: AsyncSession):
    backup_svc = BackupService(db_session)

    # Seed device
    d1 = Device(
        mac="11:22:33:44:55:66",
        name="Exported Laptop",
        category=DeviceCategory.DESKTOP_LAPTOP,
        status=DeviceStatus.ONLINE,
        ipv4="10.0.0.50"
    )
    db_session.add(d1)
    await db_session.commit()

    # Export CSV
    csv_text = await backup_svc.export_devices_csv()
    assert "11:22:33:44:55:66" in csv_text
    assert "Exported Laptop" in csv_text
    assert "Desktop/Laptop" in csv_text

    # Import new device via CSV
    sample_import_csv = (
        "mac,ipv4,ipv6,name,vendor,category,status,interface,icon,notes,is_archived,first_seen,last_seen,locked_fields,custom_properties\n"
        "66:55:44:33:22:11,10.0.0.99,,Imported Camera,Hikvision,IoT/Smart Home,online,eth0,,,,,,[],{}\n"
    )
    import_res = await backup_svc.import_devices_csv(sample_import_csv, conflict_resolution="overwrite")
    assert import_res["created"] == 1

# -------------------------------------------------------------------
# Test Maintenance Pruning Logic
# -------------------------------------------------------------------
@pytest.mark.asyncio
async def test_maintenance_pruning(db_session: AsyncSession):
    maint_svc = MaintenanceService(db_session)
    now = datetime.now(timezone.utc)

    # Add old event (40 days old) and recent event (5 days old)
    old_event = NetworkEvent(
        event_type="DEVICE_OFFLINE",
        timestamp=now - timedelta(days=40)
    )
    recent_event = NetworkEvent(
        event_type="DEVICE_ONLINE",
        timestamp=now - timedelta(days=5)
    )
    db_session.add(old_event)
    db_session.add(recent_event)
    await db_session.commit()

    # Prune with 30-day retention
    prune_res = await maint_svc.prune_expired_data({"network_events": 30})
    assert prune_res["network_events"] >= 1

    # Get stats
    stats = await maint_svc.get_storage_stats()
    assert "table_counts" in stats
    assert "network_events" in stats["table_counts"]

# -------------------------------------------------------------------
# Test Security Headers & API Endpoints
# -------------------------------------------------------------------
@pytest.mark.asyncio
async def test_security_headers_and_system_api(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Verify Security Headers
    res = await client.get("/api/v1/health")
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("Strict-Transport-Security") is not None

    # 2. Verify System Stats API
    res = await client.get("/api/v1/system/maintenance/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "table_counts" in data
    assert "total_records" in data

    # 3. Verify System Backup API
    res = await client.post("/api/v1/system/backup?backup_type=json", headers=headers)
    assert res.status_code == 200
    b_data = res.json()
    assert "filename" in b_data
    backup_file = b_data["filename"]

    # 4. Verify System Backups List API
    res = await client.get("/api/v1/system/backups", headers=headers)
    assert res.status_code == 200
    list_data = res.json()
    assert any(b["filename"] == backup_file for b in list_data)

    # 5. Delete backup
    res = await client.delete(f"/api/v1/system/backups/{backup_file}", headers=headers)
    assert res.status_code == 200

# -------------------------------------------------------------------
# Test Login Rate Limiting
# -------------------------------------------------------------------
@pytest.mark.asyncio
async def test_auth_login_rate_limiting(client: AsyncClient):
    """
    Verifies that POST /api/v1/auth/login strictly rate limits repeated failed login requests
    and triggers HTTP 429 Too Many Requests after 5 attempts per minute.
    """
    statuses = []
    payload = {"username_or_email": "nonexistent_attacker", "password": "wrongpassword"}
    for _ in range(8):
        res = await client.post("/api/v1/auth/login", json=payload)
        statuses.append(res.status_code)
    
    # 5 requests should get 401 Unauthorized, subsequent should be 429 Too Many Requests
    assert 429 in statuses, f"Expected 429 rate limit response, got statuses: {statuses}"
