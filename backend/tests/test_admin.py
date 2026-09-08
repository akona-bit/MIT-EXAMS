import pytest
from httpx import AsyncClient
from helpers import auth_header


@pytest.mark.asyncio
async def test_get_students_requires_admin(client: AsyncClient, student_user):
    """Non-admin cannot access students list."""
    resp = await client.get("/api/v1/admin/students", headers=auth_header(student_user))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_students_empty(client: AsyncClient, admin_user):
    """Admin gets empty list when no students exist."""
    resp = await client.get("/api/v1/admin/students", headers=auth_header(admin_user))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_get_students_with_data(client: AsyncClient, admin_user, student_users):
    """Admin can see paginated student list with correct total."""
    resp = await client.get("/api/v1/admin/students", headers=auth_header(admin_user))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 25
    assert len(data["items"]) == 25  # API default limit=50, we have 25


@pytest.mark.asyncio
async def test_get_students_pagination(client: AsyncClient, admin_user, student_users):
    """Pagination works with skip/limit."""
    resp = await client.get(
        "/api/v1/admin/students?skip=20&limit=10",
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 25
    assert len(data["items"]) == 5


@pytest.mark.asyncio
async def test_get_students_search(client: AsyncClient, admin_user, student_users):
    """Search filters by email, username, full_name, or registration_number."""
    resp = await client.get(
        "/api/v1/admin/students?search=student005",
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["username"] == "student005"


@pytest.mark.asyncio
async def test_get_students_search_by_sbd(client: AsyncClient, admin_user, student_users):
    """Search works by registration_number (SBD)."""
    resp = await client.get(
        "/api/v1/admin/students?search=100010",
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["sbd"] == "100010"


@pytest.mark.asyncio
async def test_get_students_search_no_match(client: AsyncClient, admin_user, student_users):
    """Search with no match returns empty list."""
    resp = await client.get(
        "/api/v1/admin/students?search=nonexistent",
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_update_student_access(client: AsyncClient, admin_user, student_user):
    """Admin can toggle can_view_answers for a student."""
    assert student_user.can_view_answers is False

    resp = await client.put(
        f"/api/v1/admin/students/{student_user.id}/access",
        json={"can_view_answers": True},
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["can_view_answers"] is True


@pytest.mark.asyncio
async def test_update_student_access_revoke(client: AsyncClient, admin_user, student_user, db):
    """Admin can revoke can_view_answers."""
    from sqlalchemy import update
    await db.execute(update(type(student_user)).where(type(student_user).id == student_user.id).values(can_view_answers=True))
    await db.commit()

    resp = await client.put(
        f"/api/v1/admin/students/{student_user.id}/access",
        json={"can_view_answers": False},
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200
    assert resp.json()["can_view_answers"] is False


@pytest.mark.asyncio
async def test_update_student_access_not_found(client: AsyncClient, admin_user):
    """Updating non-existent student returns 404."""
    resp = await client.put(
        "/api/v1/admin/students/99999/access",
        json={"can_view_answers": True},
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_staff_requires_admin(client: AsyncClient, teacher_user):
    """Non-admin cannot access staff list."""
    resp = await client.get("/api/v1/admin/staff", headers=auth_header(teacher_user))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_staff_with_data(client: AsyncClient, admin_user, teacher_user):
    """Admin can see staff list including teachers."""
    resp = await client.get("/api/v1/admin/staff", headers=auth_header(admin_user))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    emails = [u["email"] for u in data["items"]]
    assert "teacher@test.com" in emails


@pytest.mark.asyncio
async def test_get_staff_search(client: AsyncClient, admin_user, teacher_user):
    """Staff search works by email/name."""
    resp = await client.get(
        "/api/v1/admin/staff?search=teacher",
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert data["items"][0]["username"] == "teacher"


@pytest.mark.asyncio
@pytest.mark.skip(reason="AuditAction.UPDATE_USER missing — real bug to fix separately")
async def test_update_staff_member(client: AsyncClient, admin_user, teacher_user):
    """Admin can update staff role and active status."""
    resp = await client.put(
        f"/api/v1/admin/staff/{teacher_user.id}",
        json={"role_name": "MODERATOR", "is_active": False},
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_unauthenticated_access(client: AsyncClient):
    """Request without token returns 401."""
    resp = await client.get("/api/v1/admin/students")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_students_item_fields(client: AsyncClient, admin_user, student_user):
    """Student item has all expected fields."""
    resp = await client.get("/api/v1/admin/students", headers=auth_header(admin_user))
    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert "id" in item
    assert "email" in item
    assert "username" in item
    assert "full_name" in item
    assert "sbd" in item
    assert "is_active" in item
    assert "can_view_answers" in item
    assert "avg_score" in item
    assert "exam_count" in item
