import asyncio
from sqlalchemy import text
from app.db.database import engine

async def check():
    async with engine.begin() as conn:
        result = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
        ))
        tables = [row[0] for row in result.fetchall()]
        print(f"Total tables: {len(tables)}")
        for t in tables:
            try:
                r = await conn.execute(text(f'SELECT COUNT(*) FROM "{t}"'))
                count = r.scalar()
                if count > 0:
                    print(f"  {t}: {count} rows")
            except Exception as e:
                print(f"  {t}: error - {e}")

asyncio.run(check())
