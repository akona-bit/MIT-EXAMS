import time
import logging
from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from jose.utils import base64url_decode
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.core.config import settings
from app.core import security
from app.db.database import get_db
from app.models.user import User, Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

_jwks_cache: Optional[dict] = None
_jwks_cache_ts: float = 0
_JWKS_TTL = 3600  # 1 hour


async def _fetch_supabase_jwks() -> dict:
    """Fetch Supabase JWK Set, cached for 1 hour."""
    global _jwks_cache, _jwks_cache_ts
    now = time.time()
    if _jwks_cache and (now - _jwks_cache_ts) < _JWKS_TTL:
        return _jwks_cache

    supabase_url = settings.SUPABASE_URL.rstrip("/")
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(jwks_url)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_cache_ts = now
            return _jwks_cache
    except Exception as e:
        logging.warning(f"Failed to fetch Supabase JWKS: {e}")
        if _jwks_cache:
            return _jwks_cache
        raise


def _decode_with_jwks(token: str, jwks: dict) -> dict:
    """Verify a JWT against a JWK Set, matching by kid."""
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    alg = header.get("alg", "ES256")

    for jwk_key in jwks.get("keys", []):
        if jwk_key.get("kid") == kid:
            from jose import jwk as jose_jwk
            public_key = jose_jwk.construct(jwk_key)
            return jwt.decode(token, public_key, algorithms=[alg], options={"verify_aud": False})

    raise JWTError(f"No matching key found for kid={kid}")


async def _decode_supabase_token(token: str) -> dict:
    """Decode a Supabase JWT: try HS256 with secret first, then ES256 via JWKS."""
    # 1) Try HS256 with the HMAC secret (for backend-issued OTP tokens)
    try:
        secret_bytes = _decode_secret_key()
        if secret_bytes:
            return jwt.decode(token, key=secret_bytes, algorithms=["HS256"], options={"verify_aud": False})
    except Exception:
        pass

    # 2) Try ES256 (or any alg) via Supabase JWKS
    jwks = await _fetch_supabase_jwks()
    return _decode_with_jwks(token, jwks)


def _decode_secret_key() -> bytes:
    """Decode the HMAC secret from settings."""
    import base64
    raw = settings.SUPABASE_JWT_SECRET
    if not raw:
        return b""
    try:
        return base64.b64decode(raw)
    except Exception:
        return raw.encode() if isinstance(raw, str) else raw


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # ── 1) Try custom OTP JWT (signed with SECRET_KEY) ──
    try:
        if settings.SECRET_KEY:
            custom_payload = jwt.decode(token, key=settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id_str = custom_payload.get("sub")
            if user_id_str and user_id_str.isdigit():
                user_id = int(user_id_str)
                result = await db.execute(select(User).options(selectinload(User.role)).where(User.id == user_id))
                user = result.scalars().first()
                if user:
                    return user
    except Exception:
        pass

    # ── 2) Supabase token (HS256 or ES256 via JWKS) ──
    try:
        payload = await _decode_supabase_token(token)
    except Exception as e:
        logging.error(f"Supabase token decode failed: {type(e).__name__}: {e}")
        raise credentials_exception

    supabase_id = payload.get("sub")
    if not supabase_id:
        raise credentials_exception

    # ── 3) Look up user ──
    result = await db.execute(select(User).options(selectinload(User.role)).where(User.supabase_id == supabase_id))
    user = result.scalars().first()

    if user is None:
        email = payload.get("email")
        if email:
            result = await db.execute(select(User).options(selectinload(User.role)).where(User.email == email))
            user = result.scalars().first()
            if user:
                user.supabase_id = supabase_id
                await db.commit()
                await db.refresh(user)
            else:
                user_metadata = payload.get("user_metadata", {})
                role_hint = (user_metadata.get("role") or "STUDENT").upper()
                if role_hint not in ("ADMIN", "TEACHER", "STUDENT"):
                    role_hint = "STUDENT"

                role_result = await db.execute(select(Role).where(Role.name == role_hint))
                target_role = role_result.scalars().first()
                if not target_role:
                    target_role = Role(name=role_hint, description=role_hint.capitalize())
                    db.add(target_role)
                    await db.commit()
                    await db.refresh(target_role)

                full_name = user_metadata.get("full_name")
                base_username = email.split("@")[0]
                username = base_username
                counter = 1
                while True:
                    existing = await db.execute(select(User).where(User.username == username))
                    if not existing.scalars().first():
                        break
                    username = f"{base_username}{counter}"
                    counter += 1

                import random
                while True:
                    reg_num = f"{random.randint(100000, 999999)}"
                    existing_reg = await db.execute(select(User).where(User.registration_number == reg_num))
                    if not existing_reg.scalars().first():
                        break

                user = User(
                    email=email,
                    supabase_id=supabase_id,
                    username=username,
                    full_name=full_name or username,
                    registration_number=reg_num,
                    role_id=target_role.id,
                    is_active=True
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
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
