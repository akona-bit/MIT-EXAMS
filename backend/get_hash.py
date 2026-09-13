import asyncio
from sqlalchemy import text
from app.db.database import engine

async def get_hash():
    async with engine.begin() as conn:
        r = await conn.execute(text("SELECT hashed_password FROM \"user\" WHERE username = 'admin'"))
        h = r.scalar()
        print("HASH:", h)

asyncio.run(get_hash())
