import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from conftest import auth_header
from app.models.user import User
from app.models.exam import Exam, ExamStatus


async def _create_exam(db: AsyncSession, creator_id: int) -> Exam:
    """Helper to create a test exam."""
    exam = Exam(
        name="Kỳ thi thử",
        description="Mô tả kỳ thi thử",
        matrix_id=0,
        status=ExamStatus.DRAFT,
    )
    db.add(exam)
    await db.commit()
    await db.refresh(exam)
    return exam


@pytest.mark.asyncio
async def test_list_exams(client: AsyncClient):
    """Anyone can list exams (public endpoint)."""
    resp = await client.get("/api/v1/exams/")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_list_exams_empty(client: AsyncClient):
    """No exams returns empty list."""
    resp = await client.get("/api/v1/exams/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_get_exam_detail(client: AsyncClient, teacher_user, db: AsyncSession):
    """Get exam detail returns full info."""
    exam = await _create_exam(db, teacher_user.id)
    resp = await client.get(
        f"/api/v1/exams/{exam.id}",
        headers=auth_header(teacher_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Kỳ thi thử"


@pytest.mark.asyncio
async def test_get_exam_not_found(client: AsyncClient, teacher_user):
    """Non-existent exam returns 404."""
    resp = await client.get(
        "/api/v1/exams/99999",
        headers=auth_header(teacher_user),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_exam_requires_admin(client: AsyncClient, teacher_user, db: AsyncSession):
    """Only ADMIN can delete exams."""
    exam = await _create_exam(db, teacher_user.id)
    resp = await client.delete(
        f"/api/v1/exams/{exam.id}",
        headers=auth_header(teacher_user),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_exam(client: AsyncClient, admin_user, db: AsyncSession):
    """Admin can delete draft exam."""
    exam = await _create_exam(db, admin_user.id)
    resp = await client.delete(
        f"/api/v1/exams/{exam.id}",
        headers=auth_header(admin_user),
    )
    assert resp.status_code in (200, 204)


@pytest.mark.asyncio
async def test_question_list(client: AsyncClient, admin_user):
    """List questions works."""
    resp = await client.get(
        "/api/v1/questions/",
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_question_search(client: AsyncClient, admin_user):
    """Search questions by content."""
    resp = await client.get(
        "/api/v1/questions/?search=test",
        headers=auth_header(admin_user),
    )
    assert resp.status_code == 200
