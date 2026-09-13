"""
Seed test students with exam participation and results for search testing.
Run: python seed_test_students.py
"""
import asyncio
import random
import sys
import os

# Fix Windows encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, text

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import Role, User
from app.models.exam import (
    Exam, ExamForm, ExamParticipant, ExamSubmission,
    ExamStatus, ParticipantStatus, Matrix
)
from app.models.grading import ExamResult

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession)

TEST_STUDENTS = [
    {"full_name": "Nguyen Van An", "email": "an.nguyen@student.com", "username": "an.nguyen"},
    {"full_name": "Tran Thi Bich", "email": "bich.tran@student.com", "username": "bich.tran"},
    {"full_name": "Le Minh Cuong", "email": "cuong.le@student.com", "username": "cuong.le"},
    {"full_name": "Pham Thi Dao", "email": "dao.pham@student.com", "username": "dao.pham"},
    {"full_name": "Hoang Van Em", "email": "em.hoang@student.com", "username": "em.hoang"},
    {"full_name": "Nguyen Thi Giang", "email": "giang.nguyen@student.com", "username": "giang.nguyen"},
    {"full_name": "Tran Minh Ha", "email": "ha.tran@student.com", "username": "ha.tran"},
    {"full_name": "Le Thi Iris", "email": "iris.le@student.com", "username": "iris.le"},
    {"full_name": "Pham Van Khoa", "email": "khoa.pham@student.com", "username": "khoa.pham"},
    {"full_name": "Hoang Thi Lan", "email": "lan.hoang@student.com", "username": "lan.hoang"},
]


async def seed_test_students():
    async with AsyncSessionLocal() as session:
        # Get student role
        result = await session.execute(select(Role).where(Role.name == "STUDENT"))
        student_role = result.scalars().first()
        if not student_role:
            print("ERROR: STUDENT role not found. Run seed.py first.")
            return

        # Create students
        created_user_ids = []
        for student_data in TEST_STUDENTS:
            result = await session.execute(
                select(User).where(User.email == student_data["email"])
            )
            user = result.scalars().first()

            if not user:
                user = User(
                    username=student_data["username"],
                    email=student_data["email"],
                    full_name=student_data["full_name"],
                    hashed_password=get_password_hash("student123"),
                    role_id=student_role.id,
                    is_active=True,
                )
                session.add(user)
                await session.flush()
                print(f"Created student: {student_data['full_name']}")
            else:
                print(f"Student exists: {student_data['full_name']}")

            created_user_ids.append(user.id)

        # Get matrix
        result = await session.execute(select(Matrix).limit(1))
        matrix = result.scalars().first()
        if not matrix:
            print("ERROR: No matrix found. Create a matrix first.")
            return

        matrix_id = matrix.id

        # Create exams
        exam_names = [
            "Ky thi thu DGNL Thang 9/2026 - De A",
            "Ky thi thu DGNL Thang 9/2026 - De B",
            "Thi khao sat nang luc Quy 3/2026",
        ]

        exam_ids = []
        for exam_name in exam_names:
            result = await session.execute(select(Exam).where(Exam.name == exam_name))
            exam = result.scalars().first()

            if not exam:
                status = ExamStatus.COMPLETED if len(exam_ids) == 0 else ExamStatus.PUBLISHED
                exam = Exam(
                    name=exam_name,
                    description="Ky thi test for search feature",
                    matrix_id=matrix_id,
                    status=status,
                    duration_minutes=150,
                    start_time=datetime.now(timezone.utc) - timedelta(days=7),
                    end_time=datetime.now(timezone.utc) + timedelta(days=30),
                )
                session.add(exam)
                await session.flush()
                print(f"Created exam: {exam_name}")

                # Create forms
                for code in ["161", "188", "202", "215"]:
                    form = ExamForm(
                        exam_id=exam.id,
                        code=code,
                        is_original=(code == "161"),
                    )
                    session.add(form)

            exam_ids.append(exam.id)

        await session.flush()

        # Create participations and results
        for user_id in created_user_ids:
            for exam_id in exam_ids:
                if random.random() > 0.3:
                    result = await session.execute(
                        select(ExamParticipant).where(
                            ExamParticipant.exam_id == exam_id,
                            ExamParticipant.user_id == user_id
                        )
                    )
                    existing = result.scalars().first()

                    if not existing:
                        result = await session.execute(
                            select(ExamForm).where(ExamForm.exam_id == exam_id)
                        )
                        forms = result.scalars().all()
                        if not forms:
                            continue

                        chosen_form = random.choice(forms)

                        participant = ExamParticipant(
                            exam_id=exam_id,
                            user_id=user_id,
                            sbd=f"{random.randint(100000, 999999)}",
                            attempt_number=1,
                            exam_form_id=chosen_form.id,
                            status=ParticipantStatus.SUBMITTED,
                            start_time=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48)),
                            submit_time=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 24)),
                        )
                        session.add(participant)
                        await session.flush()

                        submission = ExamSubmission(
                            exam_participant_id=participant.id,
                            submit_time=participant.submit_time,
                        )
                        session.add(submission)
                        await session.flush()

                        ctt_part1 = round(random.uniform(100, 280), 2)
                        ctt_part2 = round(random.uniform(100, 280), 2)
                        ctt_part3 = round(random.uniform(100, 280), 2)
                        ctt_part4 = round(random.uniform(100, 280), 2)
                        raw_total = ctt_part1 + ctt_part2 + ctt_part3 + ctt_part4

                        irt_part1 = round(random.uniform(100, 300), 2) if random.random() > 0.5 else None
                        irt_part2 = round(random.uniform(100, 300), 2) if irt_part1 else None
                        irt_part3 = round(random.uniform(100, 300), 2) if irt_part1 else None
                        irt_part4 = round(random.uniform(100, 300), 2) if irt_part1 else None
                        total_score = sum(filter(None, [irt_part1, irt_part2, irt_part3, irt_part4])) if irt_part1 else None

                        exam_result = ExamResult(
                            exam_submission_id=submission.id,
                            ctt_score_part1=ctt_part1,
                            ctt_score_part2=ctt_part2,
                            ctt_score_part3=ctt_part3,
                            ctt_score_part4=ctt_part4,
                            raw_total_score=raw_total,
                            irt_score_part1=irt_part1,
                            irt_score_part2=irt_part2,
                            irt_score_part3=irt_part3,
                            irt_score_part4=irt_part4,
                            total_score=total_score,
                            score_method="IRT" if irt_part1 else "CTT",
                            item_scores={},
                        )
                        session.add(exam_result)

        await session.commit()
        print("\nDone! Test students and exam data seeded.")
        print(f"  - {len(created_user_ids)} students")
        print(f"  - {len(exam_ids)} exams")
        print("\nLogin with any student email, password: student123")


async def main():
    await seed_test_students()


if __name__ == "__main__":
    asyncio.run(main())
