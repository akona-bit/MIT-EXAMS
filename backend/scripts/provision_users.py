"""Create Supabase Auth users and matching application users with compensation rollback.

Run with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in the environment.
This is deliberately separate from the old hard-coded demo script.
"""

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
USERS_TO_CREATE = [
    {"email": "admin@mitexams.com", "password": "admin123", "full_name": "Admin", "role": "ADMIN"},
    {"email": "teacher@mitexams.com", "password": "teacher123", "full_name": "Teacher", "role": "TEACHER"},
    {"email": "student@mitexams.com", "password": "student123", "full_name": "Student", "role": "STUDENT"},
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
            raise RuntimeError(f"Application user {email} already exists")
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
        app_id = await insert_app_user(data, auth_id)
        print(f"Created Auth + app user {data['email']} (app_id={app_id}, supabase_id={auth_id})")
    except Exception as error:
        if auth_id:
            try:
                client.auth.admin.delete_user(auth_id)
            except Exception as rollback_error:
                raise RuntimeError(f"App insert failed and Auth rollback failed for {auth_id}: {rollback_error}") from error
            print(f"Rolled back Auth user {auth_id}")
        raise RuntimeError(f"Failed to provision {data['email']}: {error}") from error
async def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    client = create_client(url, key)
    for data in USERS_TO_CREATE:
        try:
            await provision(client, data)
        except RuntimeError as error:
            print(error, file=sys.stderr)

if __name__ == "__main__":
    asyncio.run(main())
