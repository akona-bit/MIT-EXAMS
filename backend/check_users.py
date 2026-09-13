import asyncio
from sqlalchemy import text
from app.db.database import engine

async def check():
    async with engine.begin() as conn:
        result = await conn.execute(text('SELECT id, username, role_id FROM "user" LIMIT 10'))
        rows = result.fetchall()
        print("Users:", rows)
        result2 = await conn.execute(text("SELECT id, name FROM role"))
        rows2 = result2.fetchall()
        print("Roles:", rows2)

asyncio.run(check())
