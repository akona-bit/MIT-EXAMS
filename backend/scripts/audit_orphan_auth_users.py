"""Report Supabase Auth student users missing from the application User table.

This script is read-only: it never inserts, updates, or deletes records.
Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and backend/.env DATABASE_URL.
"""

import asyncio
import os
import sys
from typing import Any
from sqlalchemy import select
from supabase import create_client
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from app.db.database import AsyncSessionLocal
from app.models.user import User

def value(item: Any, name: str, default: Any = None) -> Any:
    result = getattr(item, name, default)
    if isinstance(item, dict):
        result = item.get(name, default)
    return result
async def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    response = create_client(url, key).auth.admin.list_users()
    auth_users = value(response, "users", [])
    async with AsyncSessionLocal() as db:
        app_ids = set((await db.execute(select(User.supabase_id))).scalars().all())
    orphan_count = 0
    for auth_user in auth_users:
        metadata = value(auth_user, "user_metadata", {}) or {}
        role = str(metadata.get("role", "")).upper()
        if role not in {"STUDENT", "THÍ SINH", "THI_SINH"}:
            continue
        auth_id = str(value(auth_user, "id", ""))
        if auth_id not in app_ids:
            orphan_count += 1
            print(f"orphan email={value(auth_user, 'email', '')} id={auth_id}")
    print(f"Found {orphan_count} orphan student Auth user(s). No data was changed.")

if __name__ == "__main__":
    asyncio.run(main())
