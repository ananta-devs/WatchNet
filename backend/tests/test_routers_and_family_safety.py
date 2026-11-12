import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.models.entities import User, UserRole, Device, DeviceStatus
from app.models.routers import Router, RouterVendor
from app.models.family import (
    HouseholdProfile,
    ProfileDevice,
    DnsPolicy,
    AccessSchedule,
    DnsActivityLog,
    ProfileRole,
    DnsAction
)
from app.services.routers.router_service import RouterService
from app.services.family.dns_policy_service import DnsPolicyService
from app.services.family.activity_service import ActivityService
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

@pytest.mark.asyncio
async def test_router_registration_and_connection(client: AsyncClient, db_session: AsyncSession):
    # Create admin user
    admin = User(
        email="admin_router@example.com",
        username="admin_router",
        hashed_password=hash_password("adminpass123"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    admin_headers = {"Authorization": f"Bearer {create_access_token(str(admin.id))}"}

    # 1. Register OpenWrt router
    payload = {
        "name": "Main Living Room Gateway",
        "vendor": "OpenWrt",
        "host": "192.168.1.1",
        "port": 80,
        "username": "root",
        "password": "secretpassword",
        "model": "Archer C7 v5",
        "firmware": "OpenWrt 23.05.2"
    }
    resp = await client.post("/api/v1/routers", json=payload, headers=admin_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Main Living Room Gateway"
    assert data["vendor"] == "OpenWrt"
    router_id = data["id"]

    # 2. List routers
    list_resp = await client.get("/api/v1/routers", headers=admin_headers)
    assert list_resp.status_code == 200
    routers = list_resp.json()
    assert any(r["id"] == router_id for r in routers)

    # 3. Test router connection (simulated / safe test)
    test_resp = await client.post(f"/api/v1/routers/{router_id}/test", headers=admin_headers)
    assert test_resp.status_code == 200
    test_data = test_resp.json()
    assert "success" in test_data

    # 4. Sync clients
    sync_resp = await client.post(f"/api/v1/routers/{router_id}/sync", headers=admin_headers)
    assert sync_resp.status_code == 200
    sync_data = sync_resp.json()
    assert "synced_clients_count" in sync_data

@pytest.mark.asyncio
async def test_family_profile_lifecycle_and_pause(client: AsyncClient, db_session: AsyncSession):
    # Create admin user
    admin = User(
        email="admin_family@example.com",
        username="admin_family",
        hashed_password=hash_password("adminpass123"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    admin_headers = {"Authorization": f"Bearer {create_access_token(str(admin.id))}"}

    # 1. Create a child profile
    profile_payload = {
        "name": "Tommy",
        "role": "Child",
        "avatar": "child-avatar"
    }
    resp = await client.post("/api/v1/family/profiles", json=profile_payload, headers=admin_headers)
    assert resp.status_code == 201
    profile_data = resp.json()
    profile_id = profile_data["id"]
    assert profile_data["name"] == "Tommy"
    assert profile_data["role"] == "Child"
    assert profile_data["is_paused"] is False

    # 2. Register a device to assign
    device = Device(
        mac="00:11:22:33:44:aa",
        ipv4="192.168.1.120",
        name="Tommy iPad",
        status=DeviceStatus.ONLINE
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)

    # 3. Assign device to profile
    assign_resp = await client.post(
        f"/api/v1/family/profiles/{profile_id}/assign-device",
        json={"device_id": str(device.id)},
        headers=admin_headers
    )
    assert assign_resp.status_code == 200

    # 4. List profiles and verify device association
    list_resp = await client.get("/api/v1/family/profiles", headers=admin_headers)
    assert list_resp.status_code == 200
    profiles = list_resp.json()
    matching_profile = next(p for p in profiles if p["id"] == profile_id)
    assert len(matching_profile["devices"]) == 1
    assert matching_profile["devices"][0]["mac"] == "00:11:22:33:44:aa"

    # 5. Toggle Pause Internet (e.g. 30 minutes pass / pause)
    pause_resp = await client.post(
        f"/api/v1/family/profiles/{profile_id}/pause",
        json={"paused": True, "duration_minutes": 30},
        headers=admin_headers
    )
    assert pause_resp.status_code == 200
    pause_data = pause_resp.json()
    assert pause_data["is_paused"] is True
    assert pause_data["pause_until"] is not None

    # Resume internet
    resume_resp = await client.post(
        f"/api/v1/family/profiles/{profile_id}/pause",
        json={"paused": False},
        headers=admin_headers
    )
    assert resume_resp.status_code == 200
    assert resume_resp.json()["is_paused"] is False

@pytest.mark.asyncio
async def test_dns_policy_evaluation_and_bedtime(client: AsyncClient, db_session: AsyncSession):
    admin = User(
        email="admin_policy@example.com",
        username="admin_policy",
        hashed_password=hash_password("adminpass123"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    admin_headers = {"Authorization": f"Bearer {create_access_token(str(admin.id))}"}

    # 1. Create teen profile
    profile = HouseholdProfile(name="Alice", role=ProfileRole.TEEN)
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(profile)

    # 2. Save DNS Policy (Block Adult, Gambling, Social Media; Whitelist wikipedia.org, Custom block distracting-game.com)
    policy_payload = {
        "name": "Alice Study Policy",
        "categories": ["Adult", "Gambling", "Social Media"],
        "blocked_domains": ["distracting-game.com"],
        "allowed_domains": ["wikipedia.org", "educational-site.com"],
        "is_active": True
    }
    policy_resp = await client.put(
        f"/api/v1/family/profiles/{profile.id}/policies",
        json=policy_payload,
        headers=admin_headers
    )
    assert policy_resp.status_code == 200

    # 3. Retrieve policies
    get_pol_resp = await client.get(f"/api/v1/family/profiles/{profile.id}/policies", headers=admin_headers)
    assert get_pol_resp.status_code == 200
    assert len(get_pol_resp.json()) == 1

    # 4. Save Bedtime schedule (21:00 to 07:00, all days)
    sched_payload = {
        "name": "Night Bedtime",
        "days_of_week": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        "start_time": "21:00",
        "end_time": "07:00",
        "is_active": True
    }
    sched_resp = await client.post(
        f"/api/v1/family/profiles/{profile.id}/schedules",
        json=sched_payload,
        headers=admin_headers
    )
    assert sched_resp.status_code == 200

    # 5. Test Policy Evaluator directly
    policy = (await DnsPolicyService.get_policies_for_profile(db_session, profile.id))[0]
    schedule = (await DnsPolicyService.get_schedules_for_profile(db_session, profile.id))[0]

    # Allowed domain
    eval_allow = DnsPolicyService.evaluate_domain("wikipedia.org", policy)
    assert eval_allow["action"] == "ALLOWED"

    # Category block (Social Media)
    eval_tiktok = DnsPolicyService.evaluate_domain("tiktok.com", policy)
    assert eval_tiktok["action"] == "BLOCKED_POLICY"
    assert eval_tiktok["category"] == "Social Media"

    # Custom blacklist block
    eval_custom = DnsPolicyService.evaluate_domain("distracting-game.com", policy)
    assert eval_custom["action"] == "BLOCKED_POLICY"

    # Bedtime schedule check during 23:30 (night)
    night_time = datetime(2026, 11, 12, 23, 30, tzinfo=timezone.utc)
    assert DnsPolicyService.is_schedule_active_now(schedule, current_dt=night_time) is True

    # Daytime check 14:00
    day_time = datetime(2026, 11, 12, 14, 0, tzinfo=timezone.utc)
    assert DnsPolicyService.is_schedule_active_now(schedule, current_dt=day_time) is False

    # Overnight cross-midnight test for single day:
    mon_only_sched = AccessSchedule(
        days_of_week=["mon"],
        start_time="21:00",
        end_time="07:00",
        is_active=True
    )
    # Mon evening 22:00 -> True
    assert DnsPolicyService.is_schedule_active_now(mon_only_sched, current_dt=datetime(2026, 11, 9, 22, 0, tzinfo=timezone.utc)) is True
    # Tue morning 02:00 -> True (started on Mon evening)
    assert DnsPolicyService.is_schedule_active_now(mon_only_sched, current_dt=datetime(2026, 11, 10, 2, 0, tzinfo=timezone.utc)) is True
    # Mon morning 02:00 -> False (Sun was not active)
    assert DnsPolicyService.is_schedule_active_now(mon_only_sched, current_dt=datetime(2026, 11, 9, 2, 0, tzinfo=timezone.utc)) is False

@pytest.mark.asyncio
async def test_activity_telemetry_and_privacy_disclosures(client: AsyncClient, db_session: AsyncSession):
    admin = User(
        email="admin_act@example.com",
        username="admin_act",
        hashed_password=hash_password("adminpass123"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    admin_headers = {"Authorization": f"Bearer {create_access_token(str(admin.id))}"}

    # Ingest query from AdGuard Home / Pi-hole
    ingest_payload = {
        "domain": "pornhub.com",
        "device_ip_or_mac": "192.168.1.50",
        "query_type": "A",
        "resolver_source": "Pi-hole"
    }
    ingest_resp = await client.post("/api/v1/family/activity/ingest", json=ingest_payload, headers=admin_headers)
    assert ingest_resp.status_code == 201

    # Ingest allowed query
    ingest_allow = {
        "domain": "github.com",
        "device_ip_or_mac": "192.168.1.50",
        "query_type": "AAAA",
        "resolver_source": "AdGuardHome"
    }
    await client.post("/api/v1/family/activity/ingest", json=ingest_allow, headers=admin_headers)

    # Query activity logs
    act_resp = await client.get("/api/v1/family/activity?limit=10", headers=admin_headers)
    assert act_resp.status_code == 200
    logs = act_resp.json()
    assert len(logs) >= 2
    assert any(l["domain"] == "pornhub.com" for l in logs)

    # Analytics and Transparent disclosures
    analytics_resp = await client.get("/api/v1/family/analytics", headers=admin_headers)
    assert analytics_resp.status_code == 200
    analytics_data = analytics_resp.json()
    assert "disclosure" in analytics_data
    assert "DNS-over-HTTPS" in analytics_data["disclosure"]
    assert "HTTPS decryption" in analytics_data["disclosure"]
    assert analytics_data["total_queries"] >= 2
