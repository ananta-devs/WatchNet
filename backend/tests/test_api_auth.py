import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
import uuid

from app.main import app
from app.core.database import Base, get_db
from app.models.entities import User, UserRole
from app.core.security import hash_password

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
async def test_health_endpoint(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "redis" in data

@pytest.mark.asyncio
async def test_version_endpoint(client):
    response = await client.get("/api/v1/version")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.0.0-rc.1"
    assert data["project"] == "WatchNet"

@pytest.mark.asyncio
async def test_auth_flow(client, db_session):
    # Seed a test user
    user = User(
        id=uuid.uuid4(),
        email="test@watchnet.local",
        username="testuser",
        hashed_password=hash_password("Password123!"),
        role=UserRole.ADMINISTRATOR,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    # Login failed (wrong password)
    login_fail = await client.post("/api/v1/auth/login", json={
        "username_or_email": "testuser",
        "password": "WrongPassword"
    })
    assert login_fail.status_code == 401

    # Login success
    login_ok = await client.post("/api/v1/auth/login", json={
        "username_or_email": "testuser",
        "password": "Password123!"
    })
    assert login_ok.status_code == 200
    token_data = login_ok.json()
    assert "access_token" in token_data
    assert "access_token" in login_ok.cookies

    # Me endpoint with Cookie
    me_resp = await client.get("/api/v1/auth/me", cookies={"access_token": token_data["access_token"]})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "test@watchnet.local"

    # Refresh endpoint
    refresh_token = login_ok.cookies.get("refresh_token")
    refresh_resp = await client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 200
    assert "access_token" in refresh_resp.json()

    # Logout
    logout_resp = await client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200
