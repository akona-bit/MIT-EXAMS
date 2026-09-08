import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import get_db
from app.models.base import Base
from app.models.user import User, Role
from app.core.security import get_password_hash, create_access_token

# In-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db():
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db: AsyncSession):
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seed_roles(db: AsyncSession):
    roles = [
        Role(id=1, name="ADMIN", description="Admin"),
        Role(id=2, name="TEACHER", description="Teacher"),
        Role(id=3, name="MODERATOR", description="Moderator"),
        Role(id=4, name="STUDENT", description="Student"),
    ]
    for r in roles:
        db.add(r)
    await db.commit()
    return roles


@pytest_asyncio.fixture
async def admin_user(db: AsyncSession, seed_roles):
    user = User(
        username="admin",
        email="admin@test.com",
        hashed_password=get_password_hash("admin123"),
        role_id=1,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def teacher_user(db: AsyncSession, seed_roles):
    user = User(
        username="teacher",
        email="teacher@test.com",
        hashed_password=get_password_hash("teacher123"),
        role_id=2,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def student_user(db: AsyncSession, seed_roles):
    user = User(
        username="student",
        email="student@test.com",
        hashed_password=get_password_hash("student123"),
        role_id=4,
        is_active=True,
        registration_number="123456",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def student_users(db: AsyncSession, seed_roles):
    """Create 25 students for pagination testing."""
    users = []
    for i in range(25):
        user = User(
            username=f"student{i:03d}",
            email=f"student{i:03d}@test.com",
            hashed_password=get_password_hash("pass123"),
            role_id=4,
            is_active=True,
            registration_number=f"{100000 + i}",
            full_name=f"Hoc sinh {i}",
            can_view_answers=(i % 5 == 0),
        )
        db.add(user)
        users.append(user)
    await db.commit()
    for u in users:
        await db.refresh(u)
    return users


def auth_header(user: User) -> dict:
    token = create_access_token(subject=str(user.id))
    return {"Authorization": f"Bearer {token}"}
