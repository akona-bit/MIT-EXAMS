import psycopg2
import sys
from app.core.config import settings

url = settings.DATABASE_URL
sync_url = url.replace("postgresql+asyncpg://", "postgresql://")

print(f"Connecting...")
sys.stdout.flush()

try:
    conn = psycopg2.connect(sync_url, connect_timeout=10)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute('SELECT 1')
    print(f"Connected: {cur.fetchone()}")
    
    cur.execute("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'user' AND column_name = 'student_id'
    """)
    exists = cur.fetchone()
    print(f"student_id exists: {exists is not None}")
    
    if not exists:
        cur.execute('ALTER TABLE "user" ADD COLUMN student_id VARCHAR(6)')
        cur.execute('CREATE UNIQUE INDEX ix_user_student_id ON "user" (student_id) WHERE student_id IS NOT NULL')
        print("Migration done!")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
