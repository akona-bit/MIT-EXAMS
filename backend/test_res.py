import asyncio
from sqlalchemy import select
from app.db.database import async_session_maker
from app.models.question import Resource

async def check():
    async with async_session_maker() as session:
        result = await session.execute(select(Resource.id, Resource.original_name))
        print("Resources in DB:", result.fetchall())

if __name__ == "__main__":
    asyncio.run(check())
