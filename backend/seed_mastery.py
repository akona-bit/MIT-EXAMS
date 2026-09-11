import asyncio
import sys
sys.path.insert(0, '.')
from app.db.database import AsyncSessionLocal
from app.services.student_profile_service import update_student_topic_mastery

async def check():
    async with AsyncSessionLocal() as db:
        print("Running update_student_topic_mastery for submission 1099...")
        await update_student_topic_mastery(db, 1099)
        print("Done.")

if __name__ == "__main__":
    asyncio.run(check())
