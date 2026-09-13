import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip().startswith("DATABASE_URL"):
            os.environ.setdefault("DATABASE_URL", line.split("=", 1)[1].strip().strip('"'))
            break

from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        db_size = (await db.execute(text("SELECT pg_database_size(current_database())"))).scalar_one()
        print(f"DB size: {db_size/1024/1024:.2f} MB")

        tables_res = await db.execute(text(
            "SELECT c.relname AS table_name, pg_total_relation_size(c.oid) AS total_size, "
            "COALESCE(c.reltuples, 0)::bigint AS row_estimate "
            "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relkind = 'r' "
            "ORDER BY pg_total_relation_size(c.oid) DESC"
        ))
        for r in tables_res.all()[:8]:
            print(f"  table {r.table_name}: {r.total_size/1024:.1f} KB, ~{r.row_estimate} rows")

        buckets_res = await db.execute(text("SELECT id, name, public, created_at FROM storage.buckets ORDER BY name"))
        buckets = {r.name: r.id for r in buckets_res.all()}
        print(f"Buckets: {buckets}")

        usage_res = await db.execute(text(
            "SELECT bucket_id, COUNT(*) AS file_count, COALESCE(SUM((metadata->>'size')::bigint), 0) AS total_size "
            "FROM storage.objects GROUP BY bucket_id"
        ))
        for r in usage_res.all():
            print(f"  bucket {r.bucket_id}: {r.file_count} files, {r.total_size/1024/1024:.2f} MB")

        top_res = await db.execute(text(
            "SELECT bucket_id, name, (metadata->>'size')::bigint AS size, created_at "
            "FROM storage.objects ORDER BY (metadata->>'size')::bigint DESC NULLS LAST LIMIT 5"
        ))
        for r in top_res.all():
            print(f"  top: [{r.bucket_id}] {r.name} = {r.size/1024:.1f} KB")

        try:
            n = (await db.execute(text("SELECT COUNT(*) FROM auth.users"))).scalar_one()
            print(f"Auth users: {n}")
        except Exception as e:
            print(f"auth.users lỗi: {e}")

asyncio.run(main())
