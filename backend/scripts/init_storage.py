import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parent.parent))
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_KEY not found in environment.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def init_storage():
    bucket_name = "resources"
    print(f"Checking if bucket '{bucket_name}' exists...")
    
    buckets = supabase.storage.list_buckets()
    bucket_exists = any(b.name == bucket_name for b in buckets)
    
    if not bucket_exists:
        print(f"Creating bucket '{bucket_name}' (private)...")
        # create_bucket with public=False to ensure it's private
        supabase.storage.create_bucket(bucket_name, public=False)
        print("Bucket created successfully.")
    else:
        print(f"Bucket '{bucket_name}' already exists. Ensuring it's private is handled by RLS.")

    # Create RLS policies using SQL RPC or raw SQL
    # Note: Since the supabase python client doesn't have a direct method to execute arbitrary SQL 
    # as superuser unless we use the Postgres connection string directly, we will connect using sqlalchemy.
    from app.core.config import settings
    from sqlalchemy import create_engine
    from sqlalchemy.sql import text
    
    print("Applying Storage RLS Policies...")
    # Use the async sqlalchemy url but replace +asyncpg with standard postgresql for sync script
    sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
    engine = create_engine(sync_url)
    
    with engine.connect() as conn:
        # Check if the policy exists, drop if it does, then recreate
        sql_drop_staff = "DROP POLICY IF EXISTS \"Staff Full Access on Resources\" ON storage.objects;"
        sql_drop_student = "DROP POLICY IF EXISTS \"Student Read Access via Signed URL ONLY\" ON storage.objects;"
        
        sql_create_staff = """
        CREATE POLICY "Staff Full Access on Resources" ON storage.objects
        FOR ALL
        USING (
          bucket_id = 'resources' AND 
          auth.uid() IN (SELECT id::uuid FROM public."user" WHERE role IN ('ADMIN', 'TEACHER'))
        );
        """
        
        sql_create_student = """
        CREATE POLICY "Student Read Access via Signed URL ONLY" ON storage.objects
        FOR SELECT
        USING (
          bucket_id = 'resources' AND 
          false -- Frontend ONLY access through backend Signed URLs, no direct select
        );
        """
        
        conn.execute(text(sql_drop_staff))
        conn.execute(text(sql_drop_student))
        conn.execute(text(sql_create_staff))
        conn.execute(text(sql_create_student))
        
        # Ensure RLS is enabled on storage.objects
        conn.execute(text("ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;"))
        conn.commit()
        print("Storage RLS Policies applied successfully!")

if __name__ == "__main__":
    init_storage()
