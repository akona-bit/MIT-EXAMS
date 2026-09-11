import asyncio
import os
import sys
from sqlalchemy import select

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.models.user import User, Role
from supabase import create_client

async def main():
    print("Fixing student@mitexams.com authentication...")
    
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_KEY in .env")
        return
        
    client = create_client(url, key)
    email = "student@mitexams.com"
    password = "student123"
    
    # 1. Check if user exists in Supabase Auth
    print("Checking Supabase Auth...")
    auth_id = None
    try:
        # Try to create, if exists it will fail (or we can list users)
        users = client.auth.admin.list_users()
        for u in users:
            if hasattr(u, 'email') and u.email == email:
                auth_id = u.id
                break
            elif isinstance(u, dict) and u.get('email') == email:
                auth_id = u.get('id')
                break
    except Exception as e:
        print(f"Error checking Supabase Auth: {e}")
        
    if not auth_id:
        print(f"User {email} not found in Supabase Auth. Creating...")
        try:
            resp = client.auth.admin.create_user({
                "email": email, 
                "password": password, 
                "email_confirm": True,
                "user_metadata": {"full_name": "Student", "role": "STUDENT"}
            })
            auth_user = getattr(resp, "user", None) or (resp.get("user") if isinstance(resp, dict) else None)
            auth_id = getattr(auth_user, "id", None) or (auth_user.get("id") if isinstance(auth_user, dict) else None)
            print(f"Created in Supabase Auth with ID: {auth_id}")
        except Exception as e:
            print(f"Failed to create user in Supabase: {e}")
            return
    else:
        print(f"User {email} found in Supabase Auth (ID: {auth_id}). Updating password...")
        try:
            client.auth.admin.update_user_by_id(auth_id, {"password": password})
            print("Password updated successfully.")
        except Exception as e:
            print(f"Failed to update password: {e}")
            
    # 2. Sync with Postgres DB
    print("Syncing with Postgres DB...")
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        
        if not user:
            print(f"User {email} not found in Postgres. Creating...")
            role = (await db.execute(select(Role).where(Role.name == "STUDENT"))).scalar_one_or_none()
            if not role:
                print("Role STUDENT does not exist! Please run db migrations/seed.")
                return
                
            user = User(
                username="student", 
                email=email,
                full_name="Student", 
                supabase_id=auth_id,
                role_id=role.id, 
                is_active=True,
            )
            db.add(user)
            await db.commit()
            print(f"Created user {email} in Postgres.")
        else:
            print(f"User {email} found in Postgres. Updating supabase_id if needed...")
            if user.supabase_id != auth_id:
                user.supabase_id = auth_id
                await db.commit()
                print("Updated supabase_id.")
            else:
                print("Postgres user is already synced.")
                
    print(f"\nDone! You can now login with:\nEmail: {email}\nPassword: {password}")

if __name__ == "__main__":
    asyncio.run(main())
