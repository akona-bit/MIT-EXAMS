import asyncio
from sqlalchemy import text
from app.db.database import engine
from app.models.base import Base
# Import all models to register with Base
import app.models.user
import app.models.access
import app.models.student_profile
import app.models.exam
import app.models.question
import app.models.grading

async def fix_db():
    async with engine.begin() as conn:
        # Drop old table if exists
        await conn.execute(text("DROP TABLE IF EXISTS student_knowledge_mastery CASCADE"))
        # Drop new table if exists to recreate clean
        await conn.execute(text("DROP TABLE IF EXISTS student_topic_mastery CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS answer_access_grant CASCADE"))
        # Create all tables that don't exist
        await conn.run_sync(Base.metadata.create_all)
        print("Database schema fixed.")

if __name__ == "__main__":
    asyncio.run(fix_db())
