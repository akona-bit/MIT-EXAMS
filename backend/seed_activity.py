import asyncio
import sys
sys.path.insert(0, '.')
from app.db.database import AsyncSessionLocal
from app.models.student_profile import StudentActivityDaily
from datetime import datetime, date

# import all models implicitly
import app.main 

async def check():
    async with AsyncSessionLocal() as db:
        print("Seeding StudentActivityDaily for user 1446...")
        new_record = StudentActivityDaily(
            user_id=1446,
            activity_date=date.today(),
            submissions_count=1,
            lessons_watched_count=0,
            watch_minutes=0,
            forum_posts_count=0,
            is_strengthened_day=False
        )
        db.add(new_record)
        await db.commit()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(check())
