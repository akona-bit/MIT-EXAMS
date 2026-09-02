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
from pydantic import BaseModel

class ResolveSBDRequest(BaseModel):
    sbd: str

class UpdateMeRequest(BaseModel):
    full_name: str

router = APIRouter()



@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Return the authenticated user's profile for the frontend auth store.
    """
    return current_user

@router.post("/resolve-sbd")
async def resolve_sbd(req: ResolveSBDRequest, db: AsyncSession = Depends(get_db)):
    """
    Resolve SBD to Email for login.
    """
    result = await db.execute(select(User).where(User.registration_number == req.sbd))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Số báo danh không tồn tại")
    
    return {"email": user.email}

@router.put("/me", response_model=UserResponse)
async def update_current_user(
    req: UpdateMeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update the authenticated user's profile.
    """
    current_user.full_name = req.full_name
    await db.commit()
    await db.refresh(current_user)
    return current_user
