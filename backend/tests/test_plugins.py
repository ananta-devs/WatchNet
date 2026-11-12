import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
import uuid

from app.main import app
from app.core.database import Base, get_db
from app.models.entities import User, UserRole
from app.models.plugins import PluginRecord, PluginExecutionLog
from app.core.security import create_access_token, hash_password
from app.services.plugins.base_plugin import BasePlugin, ExecutionContext, PluginResult
from app.services.plugins.plugin_registry import PluginRegistry, register_all_upstream_plugins
from app.services.plugins.plugin_runner import PluginRunner
from pydantic import BaseModel, Field

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
async def auth_headers(db_session):
    user = User(
        id=uuid.uuid4(),
        email="admin@watchnet.local",
        username="admin",
        hashed_password=hash_password("adminpass123"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    token = create_access_token(str(user.id))
    return {"Authorization": f"Bearer {token}"}


class MockSlowConfig(BaseModel):
    delay: float = Field(0.05, description="Sleep duration")

class MockSlowPlugin(BasePlugin):
    name = "Mock Slow Plugin"
    plugin_id = "MOCK_SLOW"
    category = "monitoring"
    description = "Test plugin that simulates long tasks"
    config_schema = MockSlowConfig

    async def execute(self, context: ExecutionContext) -> PluginResult:
        cfg = MockSlowConfig(**context.config) if context.config else MockSlowConfig()
        await asyncio.sleep(cfg.delay)
        return PluginResult(success=True, status="success", items_produced=10, log_output="Completed mock slow")


class MockFailingPlugin(BasePlugin):
    name = "Mock Failing Plugin"
    plugin_id = "MOCK_FAIL"
    category = "system"
    description = "Test plugin that raises an exception"

    async def execute(self, context: ExecutionContext) -> PluginResult:
        raise RuntimeError("Simulated internal plugin failure")


def test_registry_registration():
    registry = PluginRegistry.get_instance()
    register_all_upstream_plugins(registry)
    all_ids = registry.get_all_plugin_ids()
    
    # Assert upstream plugins exist
    assert "LUCIRPC" in all_ids
    assert "UNIFIAPI" in all_ids
    assert "ARPSCAN" in all_ids
    assert "ICMP" in all_ids
    assert "INTRSPD" in all_ids
    assert "APPRISE" in all_ids
    assert "CSVBCKP" in all_ids
    assert "WOL" in all_ids
    assert len(all_ids) >= 28


@pytest.mark.asyncio
async def test_runner_execution_and_timeout():
    registry = PluginRegistry.get_instance()
    registry.register(MockSlowPlugin)
    registry.register(MockFailingPlugin)

    runner = PluginRunner(max_concurrency=2, default_timeout_sec=5.0)

    # Normal successful execution
    res = await runner.execute_plugin("MOCK_SLOW", parameters={"test": 1})
    assert res.success is True
    assert res.status == "success"
    assert res.items_produced == 10

    # Timeout execution
    res_timeout = await runner.execute_plugin("MOCK_SLOW", timeout_sec=0.01)
    # MockSlowPlugin sleeps for 0.05s so 0.01s will trigger timeout
    assert res_timeout.success is False
    assert res_timeout.status == "timeout"
    assert "timed out" in res_timeout.error

    # Error isolation execution
    res_fail = await runner.execute_plugin("MOCK_FAIL")
    assert res_fail.success is False
    assert res_fail.status == "failed"
    assert "Simulated internal plugin failure" in res_fail.error


@pytest.mark.asyncio
async def test_plugins_api_endpoints(client, auth_headers):
    # 1. GET /api/v1/plugins
    res = await client.get("/api/v1/plugins", headers=auth_headers)
    assert res.status_code == 200
    plugins_data = res.json()
    assert len(plugins_data) >= 20

    # 2. GET /api/v1/plugins/{id}
    res_single = await client.get("/api/v1/plugins/ICMP", headers=auth_headers)
    assert res_single.status_code == 200
    icmp_data = res_single.json()
    assert icmp_data["plugin_id"] == "ICMP"
    assert icmp_data["category"] == "monitoring"
    assert "properties" in icmp_data["config_schema"]

    # 3. POST /api/v1/plugins/{id}/toggle
    res_toggle = await client.post(
        "/api/v1/plugins/ICMP/toggle",
        json={"is_enabled": True},
        headers=auth_headers
    )
    assert res_toggle.status_code == 200
    assert res_toggle.json()["is_enabled"] is True

    # 4. PUT /api/v1/plugins/{id}/config
    res_cfg = await client.put(
        "/api/v1/plugins/ICMP/config",
        json={"config": {"count": 5, "timeout_sec": 2.0}, "schedule_interval_sec": 120},
        headers=auth_headers
    )
    assert res_cfg.status_code == 200
    assert res_cfg.json()["schedule_interval_sec"] == 120
    assert res_cfg.json()["config_json"]["count"] == 5

    # 5. Invalid config rejection
    res_invalid_cfg = await client.put(
        "/api/v1/plugins/ICMP/config",
        json={"config": {"count": "not-a-number"}, "schedule_interval_sec": 120},
        headers=auth_headers
    )
    assert res_invalid_cfg.status_code == 422

    # 6. POST /api/v1/plugins/{id}/run
    res_run = await client.post(
        "/api/v1/plugins/ICMP/run",
        json={"parameters": {}},
        headers=auth_headers
    )
    assert res_run.status_code == 200
    run_result = res_run.json()
    assert run_result["success"] is True

    # 7. GET /api/v1/plugins/{id}/logs
    res_logs = await client.get("/api/v1/plugins/ICMP/logs", headers=auth_headers)
    assert res_logs.status_code == 200
    logs = res_logs.json()
    assert len(logs) >= 1
    assert logs[0]["plugin_id"] == "ICMP"
    assert logs[0]["status"] == "success"

    # 8. Unauthenticated access check (HTTP 401)
    res_unauth = await client.get("/api/v1/plugins")
    assert res_unauth.status_code == 401

    # 9. Nonexistent plugin error check (HTTP 404)
    res_404 = await client.get("/api/v1/plugins/NONEXISTENT_XYZ", headers=auth_headers)
    assert res_404.status_code == 404


@pytest.mark.asyncio
async def test_plugin_teardown_and_scheduler_tick(db_session):
    # Test that teardown is invoked even on failure/timeout
    teardown_called = []

    class MockTeardownPlugin(BasePlugin):
        name = "Mock Teardown"
        plugin_id = "MOCK_TEARDOWN"
        category = "system"

        async def execute(self, context: ExecutionContext) -> PluginResult:
            raise RuntimeError("Failure before teardown")

        async def teardown(self) -> None:
            teardown_called.append(True)
            await super().teardown()

    registry = PluginRegistry.get_instance()
    registry.register(MockTeardownPlugin)

    runner = PluginRunner(default_timeout_sec=5.0)
    res = await runner.execute_plugin("MOCK_TEARDOWN", db_session=db_session)
    assert res.success is False
    assert len(teardown_called) == 1
