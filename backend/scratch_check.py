import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    database_url = os.getenv('DATABASE_URL')
    engine = create_async_engine(database_url)
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='user'"))
        cols = [r[0] for r in res.fetchall()]
        print('user columns:', cols)
        
        res2 = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='exam_submission'"))
        cols2 = [r[0] for r in res2.fetchall()]
        print('exam_submission columns:', cols2)

asyncio.run(main())
