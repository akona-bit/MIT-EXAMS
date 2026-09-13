import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def migrate():
    engine = create_async_engine(settings.DATABASE_URL, pool_timeout=10)
    async with engine.begin() as conn:
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'user' AND column_name = 'student_id'"
        ))
        exists = result.first()
        print(f"student_id exists: {exists is not None}")
        
        if not exists:
            await conn.execute(text('ALTER TABLE "user" ADD COLUMN student_id VARCHAR(6)'))
            print("Column added!")
            await conn.execute(text('CREATE UNIQUE INDEX ix_user_student_id ON "user" (student_id) WHERE student_id IS NOT NULL'))
            print("Index created!")
        
    await engine.dispose()
    print("Done!")

asyncio.run(migrate())
