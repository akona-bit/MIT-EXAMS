import os
import asyncio
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

async def main():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")  # Service role key
    
    if not supabase_url or not supabase_key:
        print("Missing SUPABASE_URL or SUPABASE_KEY")
        return
        
    client = create_client(supabase_url, supabase_key)
    
    try:
        # Check if bucket exists
        buckets = client.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        
        if "verifications" not in bucket_names:
            print("Bucket 'verifications' not found. Creating...")
            client.storage.create_bucket("verifications", name="verifications", options={"public": True})
            print("Bucket 'verifications' created successfully.")
        else:
            print("Bucket 'verifications' already exists.")
            
    except Exception as e:
        print(f"Error creating bucket: {e}")

if __name__ == "__main__":
    asyncio.run(main())
