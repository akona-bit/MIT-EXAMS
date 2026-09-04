import asyncio
import os
import sys

# Add parent directory to path so we can import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import engine
from app.models.user import User  # IMPORTANT: Import User first so SQLAlchemy knows its type
from app.models.notification import Notification

async def create_table():
    async with engine.begin() as conn:
        print("Creating notification table...")
        await conn.run_sync(Notification.__table__.create, checkfirst=True)
        print("Done!")

if __name__ == "__main__":
    asyncio.run(create_table())
