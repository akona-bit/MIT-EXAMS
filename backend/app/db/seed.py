import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.config import settings
from app.models.user import Role

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession)

async def seed_roles():
    roles = [
        {"id": 1, "name": "ADMIN", "description": "Admin hệ thống"},
        {"id": 2, "name": "TEACHER", "description": "Giáo viên (người tạo đề)"},
        {"id": 3, "name": "MODERATOR", "description": "Người duyệt câu hỏi"},
        {"id": 4, "name": "STUDENT", "description": "Thí sinh"}
    ]
    async with AsyncSessionLocal() as session:
        for r in roles:
            result = await session.execute(select(Role).where(Role.id == r["id"]))
            if not result.scalars().first():
                session.add(Role(**r))
        await session.commit()
        print("Roles seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_roles())
