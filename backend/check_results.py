import asyncio
import sys
sys.path.insert(0, '.')
from app.db.database import AsyncSessionLocal
from app.models.exam import ExamParticipant, ExamSubmission
from app.models.grading import ExamResult
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(ExamResult).where(ExamResult.exam_submission_id == 1099))
        results = res.scalars().all()
        print(f'Found {len(results)} ExamResult records for submission 1099.')

if __name__ == "__main__":
    asyncio.run(check())
