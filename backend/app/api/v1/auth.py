from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, Role
from app.schemas.user import UserCreate, UserResponse, Token, UserBase

router = APIRouter()

@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    Supports login via email or username.
    """
    # Find user by email or username
    stmt = select(User).where(
        or_(User.email == form_data.username, User.username == form_data.username)
    )
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email/username or password"
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/register", response_model=UserResponse)
async def register_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """
    Register a new user.
    """
    # Check if user exists
    if user_in.email:
        result = await db.execute(select(User).where(User.email == user_in.email))
        if result.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="A user with this email already exists in the system.",
            )
    
    if user_in.username:
        result = await db.execute(select(User).where(User.username == user_in.username))
        if result.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="A user with this username already exists in the system.",
            )
            
    # Check if role exists
    result = await db.execute(select(Role).where(Role.id == user_in.role_id))
    role = result.scalars().first()
    if not role:
        raise HTTPException(
            status_code=400,
            detail="Role not found.",
        )
        
    user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=security.get_password_hash(user_in.password),
        role_id=user_in.role_id,
        is_active=user_in.is_active
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
