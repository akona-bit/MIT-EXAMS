import asyncio
import os
import sys
from sqlalchemy import select
from supabase import create_client
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from app.core.security import get_password_hash
from app.db.database import AsyncSessionLocal
from app.models.user import Role, User

load_dotenv()

async def main():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")  # Service role key
    client = create_client(supabase_url, supabase_key)
    
    email = "student2@mitexams.com"
    password = "student123"
    full_name = "Thí sinh 2 (Chưa thi)"
    
    try:
        response = client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name, "role": "STUDENT"},
        })
        
        auth_user = getattr(response, "user", None)
        if auth_user is None and isinstance(response, dict):
            auth_user = response.get("user")
        auth_id = getattr(auth_user, "id", None)
        if auth_id is None and isinstance(auth_user, dict):
            auth_id = auth_user.get("id")
            
        print(f"Created in Supabase Auth with ID: {auth_id}")
    except Exception as e:
        print(f"Supabase Auth error (maybe already exists): {e}")
        # Try to get existing user
        # Not easily available via admin SDK without list, let's just proceed or assume failure
        return

    async with AsyncSessionLocal() as db:
        role = (await db.execute(select(Role).where(Role.name == "STUDENT"))).scalar_one_or_none()
        
        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing:
            print("User already exists in DB.")
            return
            
        user = User(
            username="student2", email=email,
            full_name=full_name, supabase_id=str(auth_id),
            hashed_password=get_password_hash(password),
            role_id=role.id, is_active=True,
        )
        db.add(user)
        await db.commit()
        print(f"Added to Database: {email} / {password}")

if __name__ == "__main__":
    asyncio.run(main())
