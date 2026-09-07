import asyncio
import os
import sys
from sqlalchemy import text
from app.db.database import engine

async def main():
    async with engine.begin() as conn:
        print("Wiping out old exams and matrices data...")
        await conn.execute(text("TRUNCATE TABLE matrix CASCADE;"))
        await conn.execute(text("TRUNCATE TABLE exam CASCADE;"))
        print("Successfully wiped old exams and matrices from DB.")

if __name__ == "__main__":
    asyncio.run(main())
