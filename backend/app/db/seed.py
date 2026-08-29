import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import Role, User

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


async def seed_users():
    demo_users = [
        {
            "username": "admin",
            "email": "admin@mitexams.com",
            "password": "admin123",
            "role_id": 1,
            "is_active": True,
        },
        {
            "username": "teacher",
            "email": "teacher@mitexams.com",
            "password": "teacher123",
            "role_id": 2,
            "is_active": True,
        },
        {
            "username": "student",
            "email": "student@mitexams.com",
            "password": "student123",
            "role_id": 4,
            "is_active": True,
        },
    ]

    async with AsyncSessionLocal() as session:
        for user_data in demo_users:
            existing = await session.execute(
                select(User).where(
                    (User.username == user_data["username"]) |
                    (User.email == user_data["email"])
                )
            )
            user = existing.scalars().first()

            if user:
                user.username = user_data["username"]
                user.email = user_data["email"]
                user.hashed_password = get_password_hash(user_data["password"])
                user.role_id = user_data["role_id"]
                user.is_active = user_data["is_active"]
            else:
                session.add(
                    User(
                        username=user_data["username"],
                        email=user_data["email"],
                        hashed_password=get_password_hash(user_data["password"]),
                        role_id=user_data["role_id"],
                        is_active=user_data["is_active"],
                    )
                )

        await session.commit()
        print("Demo users seeded successfully!")


async def main():
    await seed_roles()
    await seed_users()


if __name__ == "__main__":
    asyncio.run(main())
