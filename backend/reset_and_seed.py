"""
Reset database: xóa toàn bộ dữ liệu test, tạo 3 Admin + 3 Teacher + 3 Student.
Run: python reset_and_seed.py
"""
import asyncio
import sys
import os

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text, select

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import Role, User
from app.models.question import Question, Answer, KnowledgeNode
from app.models.passage import Passage
from app.models.exam import (
    Exam, ExamForm, ExamFormQuestion, ExamFormAnswer,
    ExamParticipant, ExamSubmission, ExamSubmissionAnswer,
    ExamTrackingLog, Matrix, MatrixRule, MatrixRuleGroup,
    ExamGenerationRun, ExamStatus, ParticipantStatus, ExamMode
)
from app.models.grading import ExamResult, IrtTask, ItemAnalysisResult
from app.models.omr import OmrJob, OmrSheet
from app.models.notification import Notification
from app.models.feedback import Feedback
from app.models.otp import OTPToken
from app.models.system import SystemSetting
from app.models.audit import AuditLog
from app.models.access import AnswerAccessGrant
from app.models.obsidian import ObsidianFile, ObsidianSyncRun
from app.models.student_profile import StudentActivityDaily, StudentTopicMastery

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession)

# ── Danh sách tài khoản cần tạo ──────────────────────────────────────
ADMINS = [
    {"username": "admin1", "email": "admin1@mitexams.com", "full_name": "Admin One", "password": "Admin@123"},
    {"username": "admin2", "email": "admin2@mitexams.com", "full_name": "Admin Two", "password": "Admin@123"},
    {"username": "admin3", "email": "admin3@mitexams.com", "full_name": "Admin Three", "password": "Admin@123"},
]

TEACHERS = [
    {"username": "teacher1", "email": "teacher1@mitexams.com", "full_name": "Nguyen Van A", "password": "Teacher@123"},
    {"username": "teacher2", "email": "teacher2@mitexams.com", "full_name": "Tran Thi B", "password": "Teacher@123"},
    {"username": "teacher3", "email": "teacher3@mitexams.com", "full_name": "Le Van C", "password": "Teacher@123"},
]

STUDENTS = [
    {"username": "student1", "email": "student1@mitexams.com", "full_name": "Pham Minh D", "student_id": "SV0001", "password": "Student@123"},
    {"username": "student2", "email": "student2@mitexams.com", "full_name": "Hoang Thi E", "student_id": "SV0002", "password": "Student@123"},
    {"username": "student3", "email": "student3@mitexams.com", "full_name": "Vo Van F", "student_id": "SV0003", "password": "Student@123"},
]


async def get_all_table_names(conn) -> list[str]:
    """Lấy danh sách tên bảng từ metadata."""
    def _get_names(sync_conn):
        from sqlalchemy import inspect as sync_inspect
        insp = sync_inspect(sync_conn)
        return insp.get_table_names()
    return await conn.run_sync(_get_names)


async def reset_database():
    """Xóa toàn bộ dữ liệu trong DB (giữ cấu trúc bảng)."""
    async with engine.begin() as conn:
        table_names = await get_all_table_names(conn)

        # PostgreSQL: dùng TRUNCATE ... CASCADE để xóa hết, giữ lại Role
        tables_to_truncate = [t for t in table_names if t.lower() != "role"]

        if tables_to_truncate:
            # Chia nhỏ thành batch 10 bảng để tránh query quá dài
            batch_size = 10
            for i in range(0, len(tables_to_truncate), batch_size):
                batch = tables_to_truncate[i:i + batch_size]
                table_list = ", ".join(f'"{t}"' for t in batch)
                try:
                    await conn.execute(text(f"TRUNCATE {table_list} CASCADE"))
                    for t in batch:
                        print(f"  ✓ Truncated: {t}")
                except Exception as e:
                    # Fallback: DELETE FROM từng bảng theo thứ tự FK
                    for t in batch:
                        try:
                            await conn.execute(text(f'DELETE FROM "{t}"'))
                            print(f"  ✓ Deleted: {t}")
                        except Exception as e2:
                            print(f"  ✗ Skipped {t}: {e2}")

    print(f"\nĐã xóa dữ liệu từ {len(tables_to_truncate)} bảng (giữ lại Role).")


async def seed_roles(session: AsyncSession):
    """Seed 4 roles cơ bản."""
    roles = [
        {"id": 1, "name": "ADMIN", "description": "Admin hệ thống"},
        {"id": 2, "name": "TEACHER", "description": "Giáo viên (người tạo đề)"},
        {"id": 3, "name": "MODERATOR", "description": "Người duyệt câu hỏi"},
        {"id": 4, "name": "STUDENT", "description": "Thí sinh"},
    ]
    for r in roles:
        result = await session.execute(select(Role).where(Role.id == r["id"]))
        if not result.scalars().first():
            session.add(Role(**r))
    await session.flush()
    print("Roles seeded.")


async def seed_users(session: AsyncSession, role_name: str, role_id: int, users: list[dict]):
    """Tạo danh sách user cho 1 role."""
    created = []
    for u in users:
        result = await session.execute(
            select(User).where((User.username == u["username"]) | (User.email == u["email"]))
        )
        existing = result.scalars().first()
        if existing:
            print(f"  ⚠ Already exists: {u['username']}")
            created.append(existing)
            continue

        user_obj = User(
            username=u["username"],
            email=u["email"],
            full_name=u.get("full_name"),
            student_id=u.get("student_id"),
            hashed_password=get_password_hash(u["password"]),
            role_id=role_id,
            is_active=True,
        )
        session.add(user_obj)
        await session.flush()
        created.append(user_obj)
        print(f"  ✓ Created: {u['username']} ({role_name})")
    return created


async def main():
    print("=" * 60)
    print("  RESET & SEED DATABASE")
    print("=" * 60)

    # Bước 1: Xóa toàn bộ dữ liệu
    print("\n[1/3] Đang xóa toàn bộ dữ liệu test...")
    await reset_database()

    # Bước 2: Seed roles + tạo users
    print("\n[2/3] Đang seed roles...")
    async with AsyncSessionLocal() as session:
        await seed_roles(session)
        await session.commit()

    print("\n[3/3] Đang tạo tài khoản...")
    async with AsyncSessionLocal() as session:
        # Lấy role IDs
        result = await session.execute(select(Role).where(Role.name == "ADMIN"))
        admin_role = result.scalars().first()
        result = await session.execute(select(Role).where(Role.name == "TEACHER"))
        teacher_role = result.scalars().first()
        result = await session.execute(select(Role).where(Role.name == "STUDENT"))
        student_role = result.scalars().first()

        print("\n  --- ADMINS ---")
        await seed_users(session, "ADMIN", admin_role.id, ADMINS)

        print("\n  --- TEACHERS ---")
        await seed_users(session, "TEACHER", teacher_role.id, TEACHERS)

        print("\n  --- STUDENTS ---")
        await seed_users(session, "STUDENT", student_role.id, STUDENTS)

        await session.commit()

    # Tổng kết
    print("\n" + "=" * 60)
    print("  HOÀN THÀNH!")
    print("=" * 60)
    print("\n  ADMINS (3):")
    for u in ADMINS:
        print(f"    {u['email']} / {u['password']}")
    print("\n  TEACHERS (3):")
    for u in TEACHERS:
        print(f"    {u['email']} / {u['password']}")
    print("\n  STUDENTS (3):")
    for u in STUDENTS:
        print(f"    {u['email']} / {u['password']}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
