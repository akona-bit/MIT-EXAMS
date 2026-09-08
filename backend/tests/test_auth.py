import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from helpers import auth_header
from app.models.user import User
from app.models.otp import OTPToken
from datetime import datetime, timezone, timedelta


async def _create_otp(db: AsyncSession, email: str, code: str = "123456", purpose: str = "login") -> OTPToken:
    """Helper to create a valid OTP token (naive datetimes for SQLite compat)."""
    from datetime import datetime, timedelta
    otp = OTPToken(
        email=email,
        code=code,
        purpose=purpose,
        is_used=False,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(minutes=5),
    )
    db.add(otp)
    await db.commit()
    await db.refresh(otp)
    return otp


@pytest.mark.asyncio
async def test_me_endpoint(client: AsyncClient, admin_user):
    """GET /me returns current user info."""
    resp = await client.get("/api/v1/auth/me", headers=auth_header(admin_user))
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["email"] == "admin@test.com"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    """GET /me without token returns 401."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_me(client: AsyncClient, admin_user):
    """PUT /me updates full_name."""
    resp = await client.put(
        "/api/v1/auth/me",
        json={"full_name": "Nguyen Van A"},
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Nguyen Van A"


@pytest.mark.asyncio
async def test_verify_otp_creates_user(client: AsyncClient, seed_roles, db: AsyncSession):
    """Verify OTP auto-creates student user if not exists."""
    email = "newguest@test.com"
    await _create_otp(db, email, "654321")

    resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": "654321"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_verify_otp_wrong_code(client: AsyncClient, seed_roles, db: AsyncSession):
    """Wrong OTP code returns 400."""
    email = "wrongcode@test.com"
    await _create_otp(db, email, "111111")

    resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": "999999"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_otp_expired(client: AsyncClient, seed_roles, db: AsyncSession):
    """Expired OTP returns 400."""
    email = "expired@test.com"
    otp = OTPToken(
        email=email,
        code="123456",
        purpose="login",
        is_used=False,
        created_at=datetime.utcnow() - timedelta(minutes=10),
        expires_at=datetime.utcnow() - timedelta(minutes=5),
    )
    db.add(otp)
    await db.commit()

    resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": "123456"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_otp_existing_user(client: AsyncClient, admin_user, db: AsyncSession):
    """Verify OTP for existing user returns token without creating new."""
    await _create_otp(db, admin_user.email, "222222")

    resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"email": admin_user.email, "code": "222222"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_resolve_sbd(client: AsyncClient, student_user):
    """Resolve SBD returns masked email."""
    resp = await client.post(
        "/api/v1/auth/resolve-sbd",
        json={"sbd": "123456"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "***" in data["email"]


@pytest.mark.asyncio
async def test_resolve_sbd_not_found(client: AsyncClient, seed_roles):
    """Resolve non-existent SBD returns 404."""
    resp = await client.post(
        "/api/v1/auth/resolve-sbd",
        json={"sbd": "000000"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_send_otp_cooldown(client: AsyncClient, seed_roles, db: AsyncSession):
    """Send OTP respects 60s cooldown."""
    email = "cooldown@test.com"
    otp = OTPToken(
        email=email,
        code="111111",
        purpose="login",
        is_used=False,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(minutes=5),
    )
    db.add(otp)
    await db.commit()

    resp = await client.post(
        "/api/v1/auth/send-otp",
        json={"email": email},
    )
    assert resp.status_code == 429
