import asyncio
import sys
sys.path.insert(0, '.')
from app.db.database import AsyncSessionLocal
from app.models.student_profile import StudentTopicMastery
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        res2 = await db.execute(select(StudentTopicMastery).where(StudentTopicMastery.user_id == 1446))
        mastery = res2.scalars().all()
        print(f'Found {len(mastery)} topic mastery records for student 1446.')

if __name__ == "__main__":
    asyncio.run(check())
