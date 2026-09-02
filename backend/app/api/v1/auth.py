from datetime import timedelta, datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
import random
import string

from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, Role
from app.models.otp import OTPToken
from app.schemas.user import UserCreate, UserResponse, Token
from app.api.dependencies import get_current_active_user
from app.core.analytics import capture
from app.services.email import send_otp_email, send_password_reset_email
from pydantic import BaseModel, EmailStr


class ResolveSBDRequest(BaseModel):
    sbd: str

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
    new_password: str

router = APIRouter()


def _generate_otp_code(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


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


# --- OTP Endpoints (Resend) ---

@router.post("/send-otp")
async def send_otp(req: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Send OTP code to email for guest login."""
    code = _generate_otp_code()
    now = datetime.utcnow()

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

    try:
        send_otp_email(req.email, code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gửi email thất bại: {str(e)}")

    return {"message": f"Mã OTP đã gửi tới {req.email}"}


@router.post("/verify-otp")
async def verify_otp(req: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
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

    if otp.expires_at < datetime.utcnow():
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
async def send_reset_password(req: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Send password reset code to email."""
    # Check user exists
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    if not user:
        # Don't reveal if email exists
        return {"message": f"Nếu email {req.email} tồn tại, mã xác thực đã được gửi"}

    code = _generate_otp_code()
    now = datetime.utcnow()

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

    try:
        reset_url = f"{settings.FRONTEND_URL}/reset-password?email={req.email}&code={code}"
        send_password_reset_email(req.email, reset_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gửi email thất bại: {str(e)}")

    return {"message": f"Mã xác thực đã gửi tới {req.email}"}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
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

    if otp.expires_at < datetime.utcnow():
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
