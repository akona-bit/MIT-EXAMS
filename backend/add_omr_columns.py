import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

async def run():
    engine = create_async_engine(os.getenv('DATABASE_URL'))
    async with engine.begin() as conn:
        try:
            await conn.execute(text('ALTER TABLE exam ADD COLUMN allow_omr BOOLEAN DEFAULT FALSE'))
            print("Added allow_omr to exam")
        except Exception as e:
            print("Error adding allow_omr:", e)
            
        try:
            await conn.execute(text('ALTER TABLE exam_submission ADD COLUMN omr_image_url VARCHAR(500)'))
            print("Added omr_image_url to exam_submission")
        except Exception as e:
            print("Error adding omr_image_url:", e)

if __name__ == "__main__":
    asyncio.run(run())
