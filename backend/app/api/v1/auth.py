from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, Role
from app.schemas.user import UserCreate, UserResponse, Token
from app.api.dependencies import get_current_active_user
from app.core.analytics import capture

router = APIRouter()



@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Return the authenticated user's profile for the frontend auth store.
    """
    return current_user
