"""
Test: 1000 thí sinh thi 2 lần (2 kỳ thi khác nhau).
Chỉ simulate — KHÔNG xóa dữ liệu cũ.
Run: python scripts/test_1000students_2exams.py
"""
import asyncio
import random
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import Role, User
from app.models.question import (
    KnowledgeNode, KnowledgeNodeType, Question, QuestionType, QuestionStatus, Answer,
)
from app.models.exam import (
    Matrix, MatrixRule, Exam, ExamStatus,
    ExamForm, ExamFormQuestion, ExamFormAnswer,
    ExamParticipant, ParticipantStatus,
    ExamSubmission, ExamSubmissionAnswer,
)
from app.models.grading import ExamResult
from app.db.bulk import bulk_insert

engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

NUM_STUDENTS = 1000
NUM_FORMS = 20
NUM_EXAMS = 2


async def get_or_create_student(db: AsyncSession, idx: int) -> User:
    username = f"student{idx:04d}"
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user:
        return user

    student_role = await db.execute(select(Role).where(Role.name == "STUDENT"))
    role = student_role.scalar_one()

    user = User(
        username=username,
        email=f"{username}@test.com",
        full_name=f"Thí sinh {idx:04d}",
        student_id=f"{idx:04d}",
        registration_number=f"{idx:04d}",
        hashed_password=get_password_hash("student123"),
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


async def create_exam_with_forms(db: AsyncSession, teacher_id: int, name: str, matrix_id: int) -> tuple:
    exam = Exam(
        name=name,
        description=f"Kỳ thi test {name}",
        status=ExamStatus.PUBLISHED,
        created_by=teacher_id,
        max_attempts=2,
        duration_minutes=120,
    )
    db.add(exam)
    await db.flush()

    forms = []
    for i in range(NUM_FORMS):
        form = ExamForm(
            exam_id=exam.id,
            code=f"MA{chr(65 + i % 26)}{i // 26 + 1:02d}",
            version=i + 1,
        )
        db.add(form)
        forms.append(form)
    await db.flush()

    return exam, forms


async def simulate_exam(
    db: AsyncSession,
    exam: Exam,
    forms: list,
    students: list,
    all_efq: list,
    correct_map: dict,
    efq_part: dict,
    efq_qid: dict,
    efa_by_efq: dict,
):
    BATCH = 200
    total_batches = (len(students) + BATCH - 1) // BATCH

    for batch_idx in range(total_batches):
        batch_students = students[batch_idx * BATCH : (batch_idx + 1) * BATCH]

        participants = []
        submissions = []

        for s in batch_students:
            form = random.choice(forms)
            now = datetime.now(timezone.utc)
            p = ExamParticipant(
                exam_id=exam.id,
                user_id=s.id,
                exam_form_id=form.id,
                status=ParticipantStatus.SUBMITTED,
                start_time=now - timedelta(hours=2),
                submit_time=now - timedelta(minutes=random.randint(30, 110)),
            )
            participants.append(p)

        db.add_all(participants)
        await db.flush()

        for p in participants:
            sub = ExamSubmission(
                exam_id=exam.id,
                user_id=p.user_id,
                exam_participant_id=p.id,
                exam_form_id=p.exam_form_id,
                status="SUBMITTED",
                submitted_at=p.submit_time,
            )
            submissions.append(sub)

        db.add_all(submissions)
        await db.flush()

        esa_batch = []
        results = []

        for sub, p in zip(submissions, participants):
            form_id = p.exam_form_id
            part_scores = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0}
            total_correct = 0
            item_scores = {}
            correct_answers_dict = {}
            selected_answers_dict = {}
            item_points_dict = {}

            form_efqs = [efq for efq in all_efq if efq.exam_form_id == form_id]

            for efq in form_efqs:
                part = efq_part[efq.id]
                q_id = efq_qid[efq.id]
                efa_options = efa_by_efq.get(efq.id, [])
                correct_efa = correct_map.get(efq.id)

                if random.random() < 0.65 and correct_efa:
                    selected_efa = correct_efa
                    is_correct = True
                else:
                    wrong = [e for e in efa_options if e != correct_efa]
                    selected_efa = random.choice(wrong) if wrong else efa_options[0]
                    is_correct = False

                score = 1.0 if is_correct else 0.0
                q_key = str(q_id)

                esa_batch.append({
                    "exam_submission_id": sub.id,
                    "exam_form_question_id": efq.id,
                    "selected_answer_id": selected_efa.answer_id if selected_efa else None,
                    "score": score,
                })

                if is_correct:
                    total_correct += 1
                    part_scores[part] += 1.0

                item_scores[q_key] = score
                correct_answers_dict[q_key] = correct_efa.answer_id if correct_efa else None
                selected_answers_dict[q_key] = selected_efa.answer_id if selected_efa else None
                item_points_dict[q_key] = 1.0

            irt_scores = {p: round((part_scores[p] / 30.0) * 300, 1) for p in range(1, 5)}
            total_irt = sum(irt_scores.values())

            results.append(ExamResult(
                exam_submission_id=sub.id,
                ctt_score_part1=part_scores[1], ctt_score_part2=part_scores[2],
                ctt_score_part3=part_scores[3], ctt_score_part4=part_scores[4],
                irt_score_part1=irt_scores[1], irt_score_part2=irt_scores[2],
                irt_score_part3=irt_scores[3], irt_score_part4=irt_scores[4],
                total_score=total_irt, raw_total_score=float(total_correct),
                item_scores=item_scores, correct_answers=correct_answers_dict,
                selected_answers=selected_answers_dict, item_points=item_points_dict,
                total_points=float(len(form_efqs)), score_method="CTT",
            ))

        await bulk_insert(db, ExamSubmissionAnswer, esa_batch, batch_size=5000)
        db.add_all(results)
        await db.commit()
        print(f"    Batch {batch_idx+1}/{total_batches} done ({len(batch_students)} students)")


async def main():
    t0 = asyncio.get_event_loop().time()

    async with SessionLocal() as db:
        # Lấy teacher
        teacher_role = await db.execute(select(Role).where(Role.name == "TEACHER"))
        teacher = (await db.execute(select(User).where(User.role_id == teacher_role.scalar_one().id))).first()
        if not teacher:
            print("ERROR: No teacher found. Run custom_reset_and_simulate.py first.")
            return
        teacher_id = teacher[0].id

        # Lấy matrix đầu tiên
        matrix_result = await db.execute(select(Matrix).limit(1))
        matrix = matrix_result.scalar_one_or_none()
        if not matrix:
            print("ERROR: No matrix found. Run custom_reset_and_simulate.py first.")
            return

        # Tạo 1000 thí sinh
        print(f"Tao {NUM_STUDENTS} thi sinh...")
        students = []
        for i in range(1, NUM_STUDENTS + 1):
            s = await get_or_create_student(db, i)
            students.append(s)
        await db.commit()
        print(f"  Da tao {len(students)} thi sinh")

        # Tạo exam forms (dùng chung câu hỏi)
        # Lấy exam forms hiện có
        existing_forms = await db.execute(select(ExamForm).limit(NUM_FORMS))
        forms = [f for f in existing_forms.scalars().all()]

        if not forms:
            print("ERROR: No exam forms found. Run custom_reset_and_simulate.py first.")
            return

        # Lấy EFQ, EFA, correct answers
        all_efq_result = await db.execute(select(ExamFormQuestion))
        all_efq = list(all_efq_result.scalars().all())

        efq_part = {}
        efq_qid = {}
        for efq in all_efq:
            # Part logic: based on question order within form
            idx = all_efq.index(efq)
            efq_part[efq.id] = (idx // 30) + 1  # 30 questions per part
            efq_qid[efq.id] = efq.question_id

        efa_result = await db.execute(select(ExamFormAnswer))
        all_efa = list(efa_result.scalars().all())

        efa_by_efq = {}
        correct_map = {}
        for efa in all_efa:
            efa_by_efq.setdefault(efa.exam_form_question_id, []).append(efa)
            if efa.is_correct:
                correct_map[efa.exam_form_question_id] = efa

        # Tạo 2 kỳ thi
        for exam_num in range(1, NUM_EXAMS + 1):
            print(f"\n{'='*50}")
            print(f"  KY THI {exam_num}: 1000 thi sinh")
            print(f"{'='*50}")

            exam, new_forms = await create_exam_with_forms(
                db, teacher_id, f"Ky thi test {exam_num} - 1000 HS", matrix.id
            )
            await db.commit()

            # Tạo EFQ cho forms mới
            new_efq_batch = []
            for form in new_forms:
                for orig_efq in all_efq[:120]:  # 120 câu = 4 phần x 30
                    new_efq = ExamFormQuestion(
                        exam_form_id=form.id,
                        question_id=orig_efq.question_id,
                    )
                    new_efq_batch.append(new_efq)

            db.add_all(new_efq_batch)
            await db.flush()

            # Map EFQ mới
            new_efq_result = await db.execute(
                select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id.in_([f.id for f in new_forms]))
            )
            new_all_efq = list(new_efq_result.scalars().all())

            new_efa_batch = []
            new_correct_map = {}
            new_efq_part = {}
            new_efq_qid = {}
            new_efa_by_efq = {}

            for i, nefq in enumerate(new_all_efq):
                new_efq_part[nefq.id] = (i % 120) // 30 + 1
                new_efq_qid[nefq.id] = nefq.question_id

                # Copy answers from original EFQ
                orig_efq = all_efq[i % len(all_efq)]
                orig_efa_list = efa_by_efq.get(orig_efq.id, [])

                for orig_efa in orig_efa_list:
                    new_efa = ExamFormAnswer(
                        exam_form_question_id=nefq.id,
                        answer_id=orig_efa.answer_id,
                        is_correct=orig_efa.is_correct,
                    )
                    new_efa_batch.append(new_efa)
                    new_efa_by_efq.setdefault(nefq.id, []).append(new_efa)
                    if orig_efa.is_correct:
                        new_correct_map[nefq.id] = new_efa

            db.add_all(new_efa_batch)
            await db.commit()

            print(f"  Simulate {len(students)} thi sinh...")
            await simulate_exam(
                db, exam, new_forms, students,
                new_all_efq, new_correct_map, new_efq_part, new_efq_qid, new_efa_by_efq,
            )

        elapsed = asyncio.get_event_loop().time() - t0
        print()
        print("=" * 60)
        print(f"  HOAN THANH trong {elapsed:.1f}s")
        print(f"  {NUM_EXAMS} ky thi x {NUM_STUDENTS} thi sinh = {NUM_EXAMS * NUM_STUDENTS} bai thi")
        print(f"  Tai khoan: student0001..student1000 / Pass: student123")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
