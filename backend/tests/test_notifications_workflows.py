import pytest
import pytest_asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from sqlalchemy import select

from app.main import app
from app.core.database import Base, get_db
from app.models.entities import User, UserRole, Device, DeviceCategory, DeviceStatus
from app.models.notifications import InAppNotification, NotificationChannel, NotificationDeliveryLog
from app.models.workflows import WorkflowRule, WorkflowExecutionLog
from app.core.security import create_access_token, hash_password
from app.services.notifications.notification_router import notification_router, NotificationRouter
from app.services.notifications.publishers import NotificationPayload, WebhookPublisher
from app.services.workflows.workflow_engine import (
    workflow_engine,
    is_mac_randomized,
    is_time_between,
    send_magic_packet
)

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

@pytest_asyncio.fixture(scope="function")
async def admin_auth_token(db_session):
    admin_user = User(
        email="admin_notif@example.com",
        username="admin_notif",
        hashed_password=hash_password("adminpass"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(admin_user)
    await db_session.commit()
    return create_access_token(subject=str(admin_user.id))


# --- 1. Notification Router & Deduplication Tests ---

@pytest.mark.asyncio
async def test_notification_deduplication_and_suppression(db_session):
    router = NotificationRouter(suppression_window_seconds=60)

    # First dispatch should go through
    res1 = await router.dispatch(
        session=db_session,
        title="Flapping Device Alert",
        message="Device online",
        severity="WARNING",
        event_type="DEVICE_CONNECTED",
        device_id="00000000-0000-0000-0000-000000000001"
    )
    assert res1["status"] == "delivered"
    assert res1["in_app_id"] is not None

    # Immediate second dispatch for same device + event should be suppressed
    res2 = await router.dispatch(
        session=db_session,
        title="Flapping Device Alert",
        message="Device online again",
        severity="WARNING",
        event_type="DEVICE_CONNECTED",
        device_id="00000000-0000-0000-0000-000000000001"
    )
    assert res2["status"] == "suppressed"

    # Different event type should not be suppressed
    res3 = await router.dispatch(
        session=db_session,
        title="Device Disconnected",
        message="Device offline",
        severity="WARNING",
        event_type="DEVICE_DISCONNECTED",
        device_id="00000000-0000-0000-0000-000000000001"
    )
    assert res3["status"] == "delivered"

    # Bypass suppression flag
    res4 = await router.dispatch(
        session=db_session,
        title="Force Alert",
        message="Forced bypass",
        severity="WARNING",
        event_type="DEVICE_CONNECTED",
        device_id="00000000-0000-0000-0000-000000000001",
        bypass_suppression=True
    )
    assert res4["status"] == "delivered"


@pytest.mark.asyncio
async def test_notification_channel_fanout_and_threshold(db_session):
    # Setup two channels: one INFO min_severity, one CRITICAL min_severity
    ch_info = NotificationChannel(
        name="Mock General Channel",
        channel_type="ntfy",
        min_severity="INFO",
        is_enabled=True,
        config_json={"server_url": "https://mock.ntfy.sh", "topic": "test-info"}
    )
    ch_crit = NotificationChannel(
        name="Mock Urgent Channel",
        channel_type="ntfy",
        min_severity="CRITICAL",
        is_enabled=True,
        config_json={"server_url": "https://mock.ntfy.sh", "topic": "test-crit"}
    )
    db_session.add_all([ch_info, ch_crit])
    await db_session.commit()

    router = NotificationRouter(suppression_window_seconds=1)

    # Dispatched WARNING alert: should deliver to ch_info, but skip ch_crit
    res = await router.dispatch(
        session=db_session,
        title="Warning Alert",
        message="Some warning occurred",
        severity="WARNING",
        event_type="HIGH_LATENCY",
        bypass_suppression=True
    )
    assert res["status"] == "delivered"

    # Check delivery logs
    stmt = select(NotificationDeliveryLog)
    result = await db_session.execute(stmt)
    logs = result.scalars().all()
    # ch_info should have log, ch_crit was skipped
    assert len(logs) == 1
    assert logs[0].channel_id == ch_info.id


# --- 2. Workflow Rule Evaluation & Conditions Tests ---

@pytest.mark.asyncio
async def test_workflow_condition_matching():
    # Helper checks
    assert is_mac_randomized("da:a1:19:22:33:44") is True
    assert is_mac_randomized("d8:a1:19:22:33:44") is False  # byte 0xd8 = 0b11011000 (bit 1 is 0)

    # Schedule between
    from datetime import time
    assert is_time_between("09:00", "17:00", current_time=time(12, 0)) is True
    assert is_time_between("09:00", "17:00", current_time=time(20, 0)) is False
    # Midnight span
    assert is_time_between("22:00", "04:00", current_time=time(23, 30)) is True
    assert is_time_between("22:00", "04:00", current_time=time(10, 0)) is False

    # Mock device
    mock_dev = Device(
        mac="b8:27:eb:12:34:56",
        ipv4="192.168.1.120",
        vendor="Raspberry Pi Foundation",
        category=DeviceCategory.IOT_SMART_HOME
    )

    # vendor_contains
    c1 = {"type": "vendor_contains", "value": "Raspberry"}
    assert await workflow_engine.evaluate_condition(c1, {}, mock_dev) is True

    # ip_in_cidr
    c2 = {"type": "ip_in_cidr", "value": "192.168.1.0/24"}
    assert await workflow_engine.evaluate_condition(c2, {}, mock_dev) is True
    c2_fail = {"type": "ip_in_cidr", "value": "10.0.0.0/8"}
    assert await workflow_engine.evaluate_condition(c2_fail, {}, mock_dev) is False

    # mac_matches wildcard
    c3 = {"type": "mac_matches", "value": "b8:27:eb:*"}
    assert await workflow_engine.evaluate_condition(c3, {}, mock_dev) is True

    # category_equals
    c4 = {"type": "category_equals", "value": "IoT/Smart Home"}
    assert await workflow_engine.evaluate_condition(c4, {}, mock_dev) is True

    # IPv6 in CIDR
    c_ipv6 = {"type": "ip_in_cidr", "value": "2001:db8::/32"}
    assert await workflow_engine.evaluate_condition(c_ipv6, {"ipv6": "2001:db8::1"}) is True
    assert await workflow_engine.evaluate_condition(c_ipv6, {"ipv6": "2001:cafe::1"}) is False

    # time_between with value string format
    c_time = {"type": "time_between", "value": "00:00-23:59"}
    assert await workflow_engine.evaluate_condition(c_time, {}) is True


@pytest.mark.asyncio
async def test_workflow_execution_and_action_handling(db_session):
    # Create test device
    dev = Device(
        mac="00:11:22:33:44:55",
        ipv4="192.168.1.88",
        vendor="Tuya Smart",
        name="Generic Smart Switch",
        category=DeviceCategory.UNKNOWN
    )
    db_session.add(dev)
    await db_session.commit()
    await db_session.refresh(dev)

    # Create workflow rule
    rule = WorkflowRule(
        name="Auto Classify Tuya to IoT and Add Tag",
        is_enabled=True,
        trigger_event="NEW_DEVICE_DETECTED",
        conditions_json=[
            {"type": "vendor_contains", "value": "Tuya"}
        ],
        actions_json=[
            {"action": "assign_category", "category": "IoT/Smart Home"},
            {"action": "add_tag", "tag": "smart-home-automation"},
            {"action": "archive_device"}
        ]
    )
    db_session.add(rule)
    await db_session.commit()

    # Trigger event
    results = await workflow_engine.run_workflows_for_event(
        session=db_session,
        event_type="NEW_DEVICE_DETECTED",
        event_data={"vendor": "Tuya Smart", "mac": dev.mac},
        device_id=str(dev.id)
    )

    assert len(results) == 1
    assert results[0]["rule_name"] == "Auto Classify Tuya to IoT and Add Tag"

    # Verify device mutations
    await db_session.refresh(dev)
    assert dev.category == DeviceCategory.IOT_SMART_HOME
    assert "smart-home-automation" in dev.custom_properties.get("tags", [])
    assert dev.is_archived is True

    # Verify execution log entry
    stmt = select(WorkflowExecutionLog).where(WorkflowExecutionLog.rule_id == rule.id)
    exec_res = await db_session.execute(stmt)
    exec_logs = exec_res.scalars().all()
    assert len(exec_logs) == 1
    assert exec_logs[0].matched is True


# --- 3. Notification & Workflow REST API Endpoints ---

@pytest.mark.asyncio
async def test_notifications_api(client, admin_auth_token, db_session):
    headers = {"Authorization": f"Bearer {admin_auth_token}"}

    # 1. Create Channel
    ch_payload = {
        "name": "SecOps Telegram",
        "channel_type": "telegram",
        "is_enabled": True,
        "config_json": {"bot_token": "123:ABC", "chat_id": "-100123"},
        "min_severity": "WARNING"
    }
    create_res = await client.post("/api/v1/notifications/channels", json=ch_payload, headers=headers)
    assert create_res.status_code == 201
    ch_data = create_res.json()
    assert ch_data["name"] == "SecOps Telegram"
    ch_id = ch_data["id"]

    # 2. List channels
    list_res = await client.get("/api/v1/notifications/channels", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Create In-App Notification directly in DB
    in_app = InAppNotification(
        title="Security Breach Detected",
        message="Port scan from untrusted MAC",
        severity="CRITICAL",
        event_type="SECURITY_ALERT"
    )
    db_session.add(in_app)
    await db_session.commit()
    await db_session.refresh(in_app)

    # 4. List In-App notifications
    inbox_res = await client.get("/api/v1/notifications", headers=headers)
    assert inbox_res.status_code == 200
    inbox_data = inbox_res.json()
    assert inbox_data["total"] >= 1
    assert inbox_data["unread_count"] >= 1

    # 5. Mark read
    read_res = await client.put(f"/api/v1/notifications/{in_app.id}/read", headers=headers)
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # 5b. Mark all read
    read_all_res = await client.post("/api/v1/notifications/read-all", headers=headers)
    assert read_all_res.status_code == 200

    # 5c. Channel test endpoint
    test_ch_res = await client.post(
        "/api/v1/notifications/test",
        json={"channel_id": ch_id, "message": "API Test Alert"},
        headers=headers
    )
    # Telegram without live token returns False or error handling
    assert test_ch_res.status_code in (200, 500)

    # 6. Delete channel
    del_res = await client.delete(f"/api/v1/notifications/channels/{ch_id}", headers=headers)
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_workflows_api(client, admin_auth_token, db_session):
    headers = {"Authorization": f"Bearer {admin_auth_token}"}

    # 1. Create Workflow Rule
    rule_payload = {
        "name": "Alert on Gateway Offline",
        "is_enabled": True,
        "trigger_event": "GATEWAY_OFFLINE",
        "conditions_json": [],
        "actions_json": [
            {"action": "send_notification", "message": "CRITICAL: Router is down!", "severity": "CRITICAL"}
        ]
    }
    create_res = await client.post("/api/v1/workflows", json=rule_payload, headers=headers)
    assert create_res.status_code == 201
    rule_data = create_res.json()
    rule_id = rule_data["id"]

    # 2. List workflows
    list_res = await client.get("/api/v1/workflows", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Toggle Rule
    toggle_res = await client.post(f"/api/v1/workflows/{rule_id}/toggle", headers=headers)
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_enabled"] is False

    # Toggle back to true
    await client.post(f"/api/v1/workflows/{rule_id}/toggle", headers=headers)

    # 4. Test Rule Simulation
    test_res = await client.post(
        f"/api/v1/workflows/{rule_id}/test",
        json={"event_data": {"gateway_ip": "192.168.1.1"}},
        headers=headers
    )
    assert test_res.status_code == 200
    test_data = test_res.json()
    assert test_data["matched"] is True

    # 4b. Update Workflow Rule
    update_res = await client.put(
        f"/api/v1/workflows/{rule_id}",
        json={
            "name": "Updated Gateway Alert",
            "is_enabled": True,
            "trigger_event": "GATEWAY_OFFLINE",
            "conditions_json": [],
            "actions_json": []
        },
        headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Gateway Alert"

    # 4c. Get rule execution logs
    logs_res = await client.get(f"/api/v1/workflows/{rule_id}/logs", headers=headers)
    assert logs_res.status_code == 200

    # 5. Delete Rule
    del_res = await client.delete(f"/api/v1/workflows/{rule_id}", headers=headers)
    assert del_res.status_code == 200
