from datetime import timedelta, datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from slowapi import Limiter
from slowapi.util import get_remote_address
import secrets


def _utcnow():
    """Return naive UTC now — safe to compare with both naive and aware datetimes."""
    return datetime.utcnow()
import string
import logging

from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, Role
from app.models.otp import OTPToken
from pydantic import Field, EmailStr
from app.schemas.user import UserCreate, UserResponse, Token
from app.api.dependencies import get_current_active_user
from app.core.analytics import capture
from app.services.email import send_otp_email, send_password_reset_email, send_credentials_email
from fastapi import BackgroundTasks
import os
from pydantic import BaseModel


class ResolveIdentifierRequest(BaseModel):
    identifier: str

class UpdateMeRequest(BaseModel):
    full_name: str

class SendOTPRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=8)

class LoginWithIdentifierRequest(BaseModel):
    identifier: str
    password: str

class BulkCreateGuestRequest(BaseModel):
    guests: list[dict]  # [{"email": "...", "student_id": "...", "full_name": "..."}]
    send_email: bool = True

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)


def _generate_otp_code(length: int = 6) -> str:
    return ''.join(secrets.choice(string.digits) for _ in range(length))


@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Return the authenticated user's profile for the frontend auth store.
    """
    return current_user

@router.post("/resolve-student-id")
async def resolve_student_id(req: ResolveIdentifierRequest, db: AsyncSession = Depends(get_db)):
    """
    Check if a student_id or email exists and return basic info (without email for privacy).
    """
    result = await db.execute(
        select(User).where(or_(User.student_id == req.identifier, User.email == req.identifier))
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Định danh không tồn tại")
    
    return {
        "exists": True,
        "full_name": user.full_name,
        "has_password": user.hashed_password is not None,
    }

@router.post("/login-identifier")
@limiter.limit("10/minute")
async def login_with_identifier(request: Request, req: LoginWithIdentifierRequest, db: AsyncSession = Depends(get_db)):
    """
    Login with identifier (email or 6-digit student_id) and password.
    """
    result = await db.execute(
        select(User).where(or_(User.student_id == req.identifier, User.email == req.identifier))
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Tài khoản hoặc mật khẩu không đúng")
    
    if not user.hashed_password:
        raise HTTPException(status_code=401, detail="Tài khoản này chưa có mật khẩu. Vui lòng liên hệ quản trị viên.")
    
    if not security.verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Mã thí sinh hoặc mật khẩu không đúng")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")
    
    # Generate JWT
    token = security.create_access_token(
        subject=user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    
    return {"access_token": token, "token_type": "bearer"}

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


# --- OTP Endpoints (Resend) ---

@router.post("/send-otp")
@limiter.limit("5/minute")
async def send_otp(request: Request, background_tasks: BackgroundTasks, req: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Send OTP code to email for guest login."""
    # Check cooldown (60 seconds)
    latest_otp_result = await db.execute(
        select(OTPToken)
        .where(OTPToken.email == req.email, OTPToken.purpose == "login")
        .order_by(OTPToken.id.desc())
        .limit(1)
    )
    latest_otp = latest_otp_result.scalars().first()
    if latest_otp and (_utcnow() - latest_otp.created_at).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="Vui lòng đợi 1 phút trước khi yêu cầu mã mới")

    code = _generate_otp_code()
    now = _utcnow()

    otp = OTPToken(
        email=req.email,
        code=code,
        purpose="login",
        is_used=False,
        created_at=now,
        expires_at=now + timedelta(minutes=5),
    )
    db.add(otp)
    await db.commit()

    background_tasks.add_task(send_otp_email, req.email, code)

    return {"message": f"Mã OTP đã gửi tới {req.email}"}


@router.post("/verify-otp")
@limiter.limit("10/minute")
async def verify_otp(request: Request, req: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """Verify OTP code and return JWT token. Creates user if not exists (guest)."""
    result = await db.execute(
        select(OTPToken)
        .where(
            OTPToken.email == req.email,
            OTPToken.code == req.code,
            OTPToken.purpose == "login",
            OTPToken.is_used == False,
        )
        .order_by(OTPToken.id.desc())
        .limit(1)
    )
    otp = result.scalars().first()

    if not otp:
        raise HTTPException(status_code=400, detail="Mã OTP không đúng")

    if otp.expires_at < _utcnow():
        raise HTTPException(status_code=400, detail="Mã OTP đã hết hạn")

    otp.is_used = True
    await db.commit()

    # Find or create user
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()

    if not user:
        # Auto-create guest user
        student_role = await db.execute(select(Role).where(Role.name == "STUDENT"))
        role = student_role.scalars().first()
        if not role:
            raise HTTPException(status_code=500, detail="Role STUDENT chưa được khởi tạo")

        username = req.email.split("@")[0]
        user = User(
            email=req.email,
            username=username,
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Generate JWT
    token = security.create_access_token(
        subject=user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {"access_token": token, "token_type": "bearer"}


@router.post("/send-reset-password")
@limiter.limit("3/minute")
async def send_reset_password(request: Request, background_tasks: BackgroundTasks, req: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Send password reset code to email."""
    # Check user exists
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Email này chưa được đăng ký tài khoản")

    # Check cooldown (60 seconds)
    latest_otp_result = await db.execute(
        select(OTPToken)
        .where(OTPToken.email == req.email, OTPToken.purpose == "reset_password")
        .order_by(OTPToken.id.desc())
        .limit(1)
    )
    latest_otp = latest_otp_result.scalars().first()
    if latest_otp and (_utcnow() - latest_otp.created_at).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="Vui lòng đợi 1 phút trước khi yêu cầu mã mới")

    code = _generate_otp_code()
    now = _utcnow()

    otp = OTPToken(
        email=req.email,
        code=code,
        purpose="reset_password",
        is_used=False,
        created_at=now,
        expires_at=now + timedelta(minutes=5),
    )
    db.add(otp)
    await db.commit()

    background_tasks.add_task(send_password_reset_email, req.email, code)

    return {"message": f"Mã xác thực đã gửi tới {req.email}"}


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using OTP code."""
    result = await db.execute(
        select(OTPToken)
        .where(
            OTPToken.email == req.email,
            OTPToken.code == req.code,
            OTPToken.purpose == "reset_password",
            OTPToken.is_used == False,
        )
        .order_by(OTPToken.id.desc())
        .limit(1)
    )
    otp = result.scalars().first()

    if not otp:
        raise HTTPException(status_code=400, detail="Mã xác thực không đúng")

    if otp.expires_at < _utcnow():
        raise HTTPException(status_code=400, detail="Mã xác thực đã hết hạn")

    otp.is_used = True

    # Update password
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")

    user.hashed_password = security.get_password_hash(req.new_password)
    await db.commit()

    return {"message": "Đặt lại mật khẩu thành công"}
