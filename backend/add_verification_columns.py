import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    database_url = os.getenv("DATABASE_URL")
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE \"user\" ADD COLUMN verification_image_url VARCHAR(255) DEFAULT NULL;"))
            print("Column 'verification_image_url' added successfully.")
        except Exception as e:
            print(f"Error adding 'verification_image_url': {e}")
            
        try:
            await conn.execute(text("ALTER TABLE \"user\" ADD COLUMN verification_status VARCHAR(50) DEFAULT 'UNVERIFIED';"))
            print("Column 'verification_status' added successfully.")
        except Exception as e:
            print(f"Error adding 'verification_status': {e}")

if __name__ == "__main__":
    asyncio.run(main())
