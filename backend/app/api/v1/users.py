from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdateMe, UserPasswordUpdate
from app.api.dependencies import get_current_active_user
from app.core.security import get_password_hash, verify_password

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def read_user_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get current user profile.
    """
    return current_user

@router.patch("/me", response_model=UserResponse)
async def update_user_me(
    req: UserUpdateMe,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update own user profile.
    """
    if req.full_name is not None:
        current_user.full_name = req.full_name
        
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.patch("/me/password")
async def update_password_me(
    req: UserPasswordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update own password.
    """
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản không có mật khẩu. Vui lòng liên hệ Admin.",
        )
        
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu cũ không chính xác.",
        )
        
    current_user.hashed_password = get_password_hash(req.new_password)
    await db.commit()
    
    return {"message": "Cập nhật mật khẩu thành công."}
