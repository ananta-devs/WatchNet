import pytest
from app.models.entities import User, Device, DeviceSession, NetworkEvent, PresenceHistory, AuditLog, SystemSetting, UserRole, DeviceStatus, EventSeverity
import uuid
from datetime import datetime, timezone

def test_model_instantiations():
    user = User(
        id=uuid.uuid4(),
        email="admin@watchnet.local",
        username="admin",
        hashed_password="hash",
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    assert user.role == UserRole.ADMINISTRATOR
    assert user.email == "admin@watchnet.local"

    device = Device(
        id=uuid.uuid4(),
        mac="AA:BB:CC:DD:EE:FF",
        ipv4="192.168.1.100",
        status=DeviceStatus.ONLINE,
        custom_properties={"custom_icon": "laptop"}
    )
    assert device.status == DeviceStatus.ONLINE
    assert device.custom_properties["custom_icon"] == "laptop"

    session = DeviceSession(
        id=uuid.uuid4(),
        device_id=device.id,
        is_active=True
    )
    assert session.is_active is True

    presence = PresenceHistory(
        id=uuid.uuid4(),
        device_id=device.id,
        date=datetime.now(timezone.utc),
        hourly_bitmap=0b111111110000000011111111
    )
    assert presence.hourly_bitmap == 0b111111110000000011111111

    event = NetworkEvent(
        device_id=device.id,
        event_type="NEW_DEVICE_DETECTED",
        severity=EventSeverity.WARNING,
        payload={"port": 80}
    )
    assert event.severity == EventSeverity.WARNING

    setting = SystemSetting(
        key="SCAN_SUBNET",
        value="192.168.1.0/24",
        is_encrypted=False
    )
    assert setting.key == "SCAN_SUBNET"
