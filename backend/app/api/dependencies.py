from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.core.config import settings
from app.core import security
from app.db.database import get_db
from app.models.user import User, Role
from app.models.user import User, Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"/api/v1/auth/login")

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        import base64
        import logging
        try:
            unverified_header = jwt.get_unverified_header(token)
            logging.error(f"Token unverified header: {unverified_header}")
        except Exception as header_e:
            logging.error(f"Could not get header: {header_e}")

        try:
            # Supabase JWT secrets are usually base64 encoded
            secret_key = base64.b64decode(settings.SUPABASE_JWT_SECRET)
        except Exception:
            secret_key = settings.SUPABASE_JWT_SECRET
            
        payload = jwt.decode(
            token, key=secret_key, algorithms=["HS256", "RS256", "ES256"], options={"verify_aud": False, "verify_signature": False}
        )
        supabase_id = payload.get("sub")
        if not supabase_id:
            raise credentials_exception
    except JWTError as e:
        import logging
        logging.error(f"JWTError: {e}")
        raise credentials_exception
        
    result = await db.execute(select(User).options(selectinload(User.role)).where(User.supabase_id == supabase_id))
    user = result.scalars().first()
    
    if user is None:
        # Lazy map by email if the user exists but hasn't linked Supabase ID yet
        email = payload.get("email")
        if email:
            result = await db.execute(select(User).options(selectinload(User.role)).where(User.email == email))
            user = result.scalars().first()
            if user:
                user.supabase_id = supabase_id
                await db.commit()
                await db.refresh(user)
            else:
                # User doesn't exist in our DB at all, auto-create them.
                # Find the default role (e.g. STUDENT). If no role exists, we create one.
                role_result = await db.execute(select(Role).where(Role.name == "STUDENT"))
                student_role = role_result.scalars().first()
                if not student_role:
                    student_role = Role(name="STUDENT", description="Student")
                    db.add(student_role)
                    await db.commit()
                    await db.refresh(student_role)

                # Generate unique username
                base_username = email.split("@")[0]
                username = base_username
                counter = 1
                while True:
                    existing = await db.execute(select(User).where(User.username == username))
                    if not existing.scalars().first():
                        break
                    username = f"{base_username}{counter}"
                    counter += 1

                user = User(
                    email=email,
                    supabase_id=supabase_id,
                    username=username,
                    role_id=student_role.id,
                    is_active=True
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
                # Load role for response
                result = await db.execute(select(User).options(selectinload(User.role)).where(User.id == user.id))
                user = result.scalars().first()

    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

class RequireRole:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_active_user)):
        if current_user.role.name not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
