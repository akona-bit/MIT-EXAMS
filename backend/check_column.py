import asyncio
from app.db.database import get_db
from sqlalchemy import text

async def check():
    async for db in get_db():
        result = await db.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'user' AND column_name = 'student_id'"
        ))
        row = result.first()
        print("student_id column exists:", row is not None)
        break

asyncio.run(check())
