import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL)

async def alter_enum():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TYPE knowledgenodetype ADD VALUE 'KNOWLEDGE';"))
            print("Successfully added KNOWLEDGE to enum.")
        except Exception as e:
            print(f"Error (maybe already exists): {e}")

if __name__ == "__main__":
    asyncio.run(alter_enum())
