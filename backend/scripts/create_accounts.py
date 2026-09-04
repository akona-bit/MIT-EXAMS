import asyncio
import os
import sys
from typing import Any
from sqlalchemy import select
from supabase import Client, create_client
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from app.core.security import get_password_hash
from app.db.database import AsyncSessionLocal
from app.models.user import Role, User
from app.core.config import settings

USERS_TO_CREATE = [
    {"email": "admin1@mitexams.com", "password": "admin123", "full_name": "Admin 1", "role": "ADMIN"},
    {"email": "admin2@mitexams.com", "password": "admin123", "full_name": "Admin 2", "role": "ADMIN"},
    {"email": "admin3@mitexams.com", "password": "admin123", "full_name": "Admin 3", "role": "ADMIN"},
    {"email": "teacher1@mitexams.com", "password": "teacher123", "full_name": "Teacher 1", "role": "TEACHER"},
    {"email": "teacher2@mitexams.com", "password": "teacher123", "full_name": "Teacher 2", "role": "TEACHER"},
    {"email": "teacher3@mitexams.com", "password": "teacher123", "full_name": "Teacher 3", "role": "TEACHER"},
]

def auth_id_from_response(response: Any) -> str:
    auth_user = getattr(response, "user", None)
    if auth_user is None and isinstance(response, dict):
        auth_user = response.get("user")
    auth_id = getattr(auth_user, "id", None)
    if auth_id is None and isinstance(auth_user, dict):
        auth_id = auth_user.get("id")
    if not auth_id:
        raise RuntimeError("Supabase did not return the created user id")
    return str(auth_id)

async def insert_app_user(data: dict[str, str], auth_id: str) -> int:
    async with AsyncSessionLocal() as db:
        role = (await db.execute(select(Role).where(Role.name == data["role"]))).scalar_one_or_none()
        if role is None:
            raise RuntimeError(f"Role {data['role']} does not exist; run seed_roles first")
        email = data["email"].strip().lower()
        if (await db.execute(select(User).where(User.email == email))).scalar_one_or_none():
            print(f"Application user {email} already exists")
            return 0
        user = User(
            username=email.split("@", 1)[0], email=email,
            full_name=data.get("full_name"), supabase_id=auth_id,
            hashed_password=get_password_hash(data["password"]),
            role_id=role.id, is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user.id

async def provision(client: Client, data: dict[str, str]) -> None:
    auth_id = None
    try:
        response = client.auth.admin.create_user({
            "email": data["email"], "password": data["password"], "email_confirm": True,
            "user_metadata": {"full_name": data.get("full_name"), "role": data["role"], "source": "student_import"},
        })
        auth_id = auth_id_from_response(response)
        print(f"Created Supabase user {data['email']} with auth_id {auth_id}")
    except Exception as e:
        if "already exists" in str(e).lower() or "users_email_partial_key" in str(e).lower() or "422" in str(e):
            print(f"Supabase user {data['email']} already exists or error: {e}")
            return
        raise RuntimeError(f"Failed to create Supabase user: {e}")

    try:
        app_user_id = await insert_app_user(data, auth_id)
        if app_user_id:
            print(f"Created application user {data['email']} with id {app_user_id}")
    except Exception as e:
        print(f"Failed to create application user: {e}")
        try:
            client.auth.admin.delete_user(auth_id)
            print(f"Rolled back Supabase user {auth_id}")
        except Exception as delete_e:
            print(f"Failed to rollback Supabase user {auth_id}: {delete_e}")
        raise

async def main():
    from dotenv import load_dotenv
    load_dotenv()
    supabase_url = os.environ.get("SUPABASE_URL", settings.SUPABASE_URL)
    supabase_key = os.environ.get("SUPABASE_KEY")
    if not supabase_key:
        print("Missing SUPABASE_KEY environment variable. Trying SUPABASE_SERVICE_ROLE_KEY...")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Missing SUPABASE_URL or SUPABASE_KEY environment variables.")
        sys.exit(1)

    print(f"Connecting to Supabase at {supabase_url}...")
    client: Client = create_client(supabase_url, supabase_key)
    
    for u in USERS_TO_CREATE:
        await provision(client, u)

if __name__ == "__main__":
    asyncio.run(main())
