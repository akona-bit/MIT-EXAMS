import asyncio
from app.db.database import get_db
from sqlalchemy import text

async def migrate():
    async for db in get_db():
        # Check current columns
        result = await db.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'user' ORDER BY ordinal_position"
        ))
        columns = [row[0] for row in result.all()]
        print("Current columns:", columns)
        
        if 'student_id' not in columns:
            print("Adding student_id column...")
            await db.execute(text('ALTER TABLE "user" ADD COLUMN student_id VARCHAR(6)'))
            await db.commit()
            print("Column added!")
        else:
            print("student_id column already exists")
        break

asyncio.run(migrate())
