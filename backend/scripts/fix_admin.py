import asyncio
import os
import sys
from dotenv import load_dotenv
from supabase import create_client
from sqlalchemy import select

load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.db.database import AsyncSessionLocal
from app.models.user import User

async def fix_admin():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    client = create_client(url, key)

    print("Fetching users from Supabase...")
    response = client.auth.admin.list_users()
    users = response if isinstance(response, list) else (response.users if hasattr(response, 'users') else response.get('users', []))
    
    admin_auth_id = None
    for u in users:
        email = getattr(u, 'email', None) or (u.get('email') if isinstance(u, dict) else None)
        if email == 'admin@mitexams.com':
            admin_auth_id = getattr(u, 'id', None) or (u.get('id') if isinstance(u, dict) else None)
            break
            
    if not admin_auth_id:
        print("Admin user does not exist in Supabase yet. Please run provision_users.py again.")
        return
        
    print(f"Found admin in Supabase: {admin_auth_id}")
    
    async with AsyncSessionLocal() as db:
        admin_user = (await db.execute(select(User).where(User.email == 'admin@mitexams.com'))).scalar_one_or_none()
        if admin_user:
            admin_user.supabase_id = str(admin_auth_id)
            await db.commit()
            print("Successfully linked admin@mitexams.com in local database!")
        else:
            print("Local database missing admin user. Run provision_users.py.")

if __name__ == "__main__":
    asyncio.run(fix_admin())
