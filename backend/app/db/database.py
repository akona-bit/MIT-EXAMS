from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# backward-compatible alias expected by some modules
async_session_maker = AsyncSessionLocal

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
