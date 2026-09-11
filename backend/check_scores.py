"""Quick script to check actual score values in DB."""
import asyncio
import sys
sys.path.insert(0, '.')
from app.db.database import AsyncSessionLocal
from app.models.grading import ExamResult
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(ExamResult).order_by(ExamResult.id.desc()).limit(5)
        )
        results = res.scalars().all()
        for r in results:
            print(f"ID={r.id} | "
                  f"P1={r.ctt_score_part1} P2={r.ctt_score_part2} "
                  f"P3={r.ctt_score_part3} P4={r.ctt_score_part4} | "
                  f"raw_total={r.raw_total_score} | "
                  f"total_score(IRT)={r.total_score} | "
                  f"method={r.score_method}")

if __name__ == "__main__":
    asyncio.run(check())
