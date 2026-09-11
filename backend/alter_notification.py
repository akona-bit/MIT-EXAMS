import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        print("Altering notification table...")
        await conn.execute(text("ALTER TABLE notification ALTER COLUMN recipient_id DROP NOT NULL;"))
        await conn.execute(text("ALTER TABLE notification ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_notification_is_global ON notification (is_global);"))
        print("Done!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
