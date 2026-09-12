import asyncio
from sqlalchemy import text
from app.db.database import engine

async def clear_database():
    async with engine.begin() as conn:
        print("Connected to DB, fetching tables...")
        # Get all tables in public schema
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        """))
        tables = [row[0] for row in result.fetchall()]
        
        for table in tables:
            if table not in ["user", "role", "alembic_version"]:
                print(f"Truncating {table}...")
                await conn.execute(text(f'TRUNCATE TABLE "{table}" CASCADE;'))
                
        print("Database truncated successfully.")

if __name__ == "__main__":
    asyncio.run(clear_database())
