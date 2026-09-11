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
            await conn.execute(text("ALTER TABLE \"user\" ADD COLUMN gender VARCHAR(20) DEFAULT NULL;"))
            print("Column 'gender' added successfully.")
        except Exception as e:
            if "already exists" in str(e):
                print("Column 'gender' already exists.")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
