import asyncio
from app.db.database import async_session_maker
from app.models.question import Resource
from sqlalchemy import select

async def main():
    async with async_session_maker() as session:
        res = await session.execute(select(Resource))
        resources = res.scalars().all()
        print(f"FOUND {len(resources)} RESOURCES")
        for r in resources:
            print(f"- {r.id}: {r.content_url}")

if __name__ == '__main__':
    asyncio.run(main())
