import asyncio
from app.db.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        try:
            await conn.execute(text('ALTER TABLE "user" ADD COLUMN gender VARCHAR(20)'))
            print("Successfully added 'gender' column.")
        except Exception as e:
            print(f"Error adding column (maybe already exists): {e}")

if __name__ == "__main__":
    asyncio.run(main())
