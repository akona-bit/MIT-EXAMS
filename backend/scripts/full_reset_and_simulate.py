"""
Full reset + simulate a real ĐGNL exam with 300 students.
All 300 students have submissions + ExamResult ready for IRT grading.
One extra student account is created but has NOT taken the exam.

Run: python scripts/full_reset_and_simulate.py
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
from app.db.bulk import bulk_insert
from app.models.grading import ExamResult

engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ── Config ──────────────────────────────────────────────────
NUM_STUDENTS = 300
QUESTIONS_PER_PART = 30
NUM_PARTS = 4
TOTAL_QUESTIONS = QUESTIONS_PER_PART * NUM_PARTS

PART_NAMES = {1: "Tieng Viet", 2: "Tieng Anh", 3: "Toan hoc", 4: "Tu duy khoa hoc"}

KNOWLEDGE_TREE = {
    1: {"topic": "Ngon ngu va Van hoc Viet Nam", "skills": [
        "Bat thong tin", "Hieu dan giai", "Phan tich danh gia", "Suy luan sang tao",
        "Nhan biet loi chinh ta", "Chon tu dung ngu canch", "Hieu thanh ngu tung ngu",
        "Phan tich doan van", "Sap xep cau", "Tom tat y chinh",
    ]},
    2: {"topic": "English Language Skills", "skills": [
        "Reading Comprehension", "Grammar and Vocabulary", "Sentence Structure",
        "Cloze Test", "Word Formation", "Phrasal Verbs",
        "Idiomatic Expressions", "Error Identification", "Para Completion",
        "Inference and Main Idea",
    ]},
    3: {"topic": "Toan hoc", "skills": [
        "Dai so", "Hinh hoc", "Toa do Oxy", "Xac suat thong ke",
        "Luy thua and Logarithm", "Phuong trinh and Bat phuong trinh",
        "Ham so", "To hop - Xac suat", "So phuc", "Vectors",
    ]},
    4: {"topic": "Tu duy khoa hoc", "skills": [
        "Phan tich du lieu bieu do", "Thiet ke thi nghiem", "Suy luan logic",
        "Doc bang so lieu", "So sanh gia thuyet", "Tinh toan vat ly co ban",
        "Hieu quy trinh khoa hoc", "Phan tich nguyen nhan",
        "Ket luan tu du lieu", "Nhan dien mau so",
    ]},
}

LEVELS = [1, 2, 3]


async def clear_all():
    print("Xoa du lieu cu...")
    tables = [
        "exam_submission_answer", "exam_submission", "exam_tracking_log",
        "exam_participant", "exam_form_answer", "exam_form_question",
        "exam_form", "exam_result", "irt_task",
        "exam",
        "matrix_rule", "matrix_rule_group", "matrix",
        "question_sub_item", "answer", "question_embedding",
        "question", "resource", "passage",
        "knowledge_node",
        "system_setting", "notification", "feedback", "otp_token",
        '"user"', '"role"',
    ]
    async with engine.begin() as conn:
        for t in tables:
            await conn.execute(text(f"TRUNCATE TABLE {t} CASCADE"))
    print("  Done")


async def seed_roles_and_admin():
    print("Tao roles + admin + teacher...")
    async with SessionLocal() as db:
        for r in [
            {"id": 1, "name": "ADMIN", "description": "Quan tri he thong"},
            {"id": 2, "name": "TEACHER", "description": "Giao vien"},
            {"id": 3, "name": "MODERATOR", "description": "Nguoi duyet cau hoi"},
            {"id": 4, "name": "STUDENT", "description": "Thi sinh"},
        ]:
            db.add(Role(**r))
        await db.flush()

        admin = User(username="admin", email="admin@mitexams.com", full_name="Admin",
                     hashed_password=get_password_hash("admin123"), role_id=1, is_active=True)
        teacher = User(username="teacher", email="teacher@mitexams.com", full_name="Giao vien",
                       hashed_password=get_password_hash("teacher123"), role_id=2, is_active=True)
        db.add_all([admin, teacher])
        await db.commit()
        await db.refresh(admin)
        await db.refresh(teacher)
        print(f"  admin id={admin.id}, teacher id={teacher.id}")
        return admin, teacher


async def seed_knowledge():
    print("Tao knowledge nodes...")
    async with SessionLocal() as db:
        nodes = {}
        for part, info in KNOWLEDGE_TREE.items():
            topic = KnowledgeNode(name=info["topic"], node_type=KnowledgeNodeType.TOPIC,
                                  subject=PART_NAMES[part], short_code=f"P{part}", path_code=f"P{part}")
            db.add(topic)
            await db.flush()
            for i, skill_name in enumerate(info["skills"]):
                skill = KnowledgeNode(name=skill_name, node_type=KnowledgeNodeType.SKILL,
                                      subject=PART_NAMES[part], parent_id=topic.id,
                                      short_code=f"P{part}S{i+1:02d}", path_code=f"P{part}/{skill_name[:20]}")
                db.add(skill)
                await db.flush()
                nodes[(part, i)] = skill.id
        await db.commit()
        print(f"  {len(nodes)} skill nodes")
        return nodes


async def seed_questions(teacher_id, knowledge_nodes):
    print("Tao 120 cau hoi...")
    async with SessionLocal() as db:
        questions_by_key = {}
        answers_map = {}
        for part in range(1, NUM_PARTS + 1):
            skill_ids = [knowledge_nodes[(part, i)] for i in range(10)]
            for idx in range(QUESTIONS_PER_PART):
                level = LEVELS[idx % 3]
                skill_id = skill_ids[idx % 10]
                correct_pos = random.randint(0, 3)
                q = Question(
                    content=f"Cau hoi {part}-{idx+1}: Mo phong noi dung phan {PART_NAMES[part]}?",
                    level=level, type=QuestionType.SINGLE_CHOICE, status=QuestionStatus.APPROVED,
                    knowledge_node_id=skill_id, creator_id=teacher_id,
                    a_param=round(random.uniform(0.5, 2.0), 2),
                    b_param=round(random.uniform(-2.0, 2.0), 2),
                    c_param=round(random.uniform(0.0, 0.3), 2),
                )
                db.add(q)
                await db.flush()
                q_answers = []
                for pos in range(4):
                    ans = Answer(question_id=q.id, content=f"Dap an {'ABCD'[pos]}",
                                 is_correct=(pos == correct_pos), position=pos)
                    db.add(ans)
                    await db.flush()
                    q_answers.append((ans.id, ans.is_correct))
                questions_by_key[(part, idx)] = q.id
                answers_map[(part, idx)] = q_answers
        await db.commit()
        print(f"  {len(questions_by_key)} cau hoi, {len(questions_by_key)*4} dap an")
        return questions_by_key, answers_map


async def create_matrix_and_exam(admin_id, knowledge_nodes, questions_by_key):
    print("Tao ma tran + ky thi + ma de...")
    async with SessionLocal() as db:
        matrix = Matrix(name="Ma tran DGNL Demo", subject="DGNL",
                        description="Ma tran mo phong 120 cau, 4 phan")
        db.add(matrix)
        await db.flush()

        rules_batch = []
        for part in range(1, NUM_PARTS + 1):
            for i in range(10):
                rules_batch.append({
                    "matrix_id": matrix.id, "knowledge_node_id": knowledge_nodes[(part, i)],
                    "question_type": QuestionType.SINGLE_CHOICE, "level": None,
                    "count": 3, "part": part, "position": i,
                })
        await bulk_insert(db, MatrixRule, rules_batch)

        now = datetime.now(timezone.utc)
        exam = Exam(name="Ky thi DGNL Demo 2026", description="Ky thi mo phong 300 thi sinh",
                     matrix_id=matrix.id, start_time=now - timedelta(hours=1),
                     end_time=now + timedelta(hours=2), duration_minutes=150,
                     status=ExamStatus.PUBLISHED, show_score_mode="NONE", show_answer_mode="NONE")
        db.add(exam)
        await db.flush()

        form = ExamForm(exam_id=exam.id, code="101", is_original=True)
        db.add(form)
        await db.flush()

        position = 1
        efqs_to_add = []
        efq_meta = []
        for part in range(1, NUM_PARTS + 1):
            indices = list(range(QUESTIONS_PER_PART))
            random.shuffle(indices)
            for idx in indices:
                q_id = questions_by_key[(part, idx)]
                efq = ExamFormQuestion(exam_form_id=form.id, question_id=q_id,
                                        position=position, part=part)
                efqs_to_add.append(efq)
                efq_meta.append((part, idx, q_id))
                position += 1
        db.add_all(efqs_to_add)
        await db.flush()

        all_q_ids = [qid for _, _, qid in efq_meta]
        ans_rows_all = (await db.execute(
            select(Answer).where(Answer.question_id.in_(all_q_ids))
        )).scalars().all()
        ans_by_q = {}
        for a in ans_rows_all:
            ans_by_q.setdefault(a.question_id, []).append(a)

        efa_batch = []
        for efq, (part, idx, q_id) in zip(efqs_to_add, efq_meta):
            ans_rows = sorted(ans_by_q.get(q_id, []), key=lambda x: x.position)
            shuffled = list(range(len(ans_rows)))
            random.shuffle(shuffled)
            for new_pos, old_pos in enumerate(shuffled):
                efa_batch.append({
                    "exam_form_question_id": efq.id,
                    "answer_id": ans_rows[old_pos].id,
                    "new_position": new_pos + 1,
                })
        await bulk_insert(db, ExamFormAnswer, efa_batch)
        await db.commit()
        print(f"  Exam id={exam.id}, Form id={form.id} (code=101)")
        return exam, form


async def create_students():
    print(f"Tao {NUM_STUDENTS} thi sinh + 1 tai khoan du phong...")
    async with SessionLocal() as db:
        role_result = await db.execute(select(Role).where(Role.name == "STUDENT"))
        student_role = role_result.scalars().first()
        students = []
        for i in range(1, NUM_STUDENTS + 1):
            sbd = f"SBD{i:04d}"
            user = User(username=f"student{i:04d}", email=f"student{i:04d}@test.com",
                        full_name=f"Thi sinh {sbd}", registration_number=f"{i:06d}",
                        role_id=student_role.id, is_active=True)
            db.add(user)
            students.append((sbd, user))
        extra = User(username="student0000", email="student0000@test.com",
                     full_name="Thi sinh du phong (chua thi)", registration_number="000000",
                     role_id=student_role.id, is_active=True)
        db.add(extra)
        await db.commit()
        for sbd, u in students:
            await db.refresh(u)
        await db.refresh(extra)
        print(f"  {len(students)} thi sinh + 1 du phong (id={extra.id})")
        return students, extra


async def simulate_exam(exam, form, students):
    print(f"Mo phong {NUM_STUDENTS} thi sinh lam bai...")
    async with SessionLocal() as db:
        # ── Preload ALL data in 3 queries ──
        all_efq = (await db.execute(
            select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == form.id)
            .order_by(ExamFormQuestion.position)
        )).scalars().all()

        all_efa = (await db.execute(
            select(ExamFormAnswer).where(
                ExamFormAnswer.exam_form_question_id.in_([efq.id for efq in all_efq])
            )
        )).scalars().all()

        all_answers = (await db.execute(
            select(Answer).where(Answer.question_id.in_([efq.question_id for efq in all_efq]))
        )).scalars().all()

        # ── Build lookup dicts ──
        correct_map = {}       # efq.id -> correct answer_id
        efq_part = {}          # efq.id -> part
        efq_qid = {}           # efq.id -> question_id
        efa_by_efq = {}        # efq.id -> [ExamFormAnswer]
        correct_by_qid = {}    # question_id -> correct answer_id

        for efq in all_efq:
            efq_part[efq.id] = efq.part
            efq_qid[efq.id] = efq.question_id

        for a in all_answers:
            if a.is_correct:
                correct_by_qid[a.question_id] = a.id

        for efa in all_efa:
            efa_by_efq.setdefault(efa.exam_form_question_id, []).append(efa)

        # Map efq.id -> correct answer_id via question lookup
        for efq in all_efq:
            cid = correct_by_qid.get(efq.question_id)
            if cid:
                # find which efa maps to this correct answer
                for efa in efa_by_efq.get(efq.id, []):
                    if efa.answer_id == cid:
                        correct_map[efq.id] = efa
                        break

        now = datetime.now(timezone.utc)

        # ── Bulk create participants ──
        participants = []
        for sbd, student in students:
            p = ExamParticipant(
                exam_id=exam.id, user_id=student.id, sbd=sbd, exam_form_id=form.id,
                status=ParticipantStatus.SUBMITTED,
                start_time=now - timedelta(minutes=random.randint(10, 120)),
                submit_time=now - timedelta(minutes=random.randint(1, 9)),
            )
            participants.append(p)
        db.add_all(participants)
        await db.flush()

        # ── Bulk create submissions ──
        submissions = []
        for p in participants:
            sub = ExamSubmission(exam_participant_id=p.id, submit_time=p.submit_time)
            submissions.append(sub)
        db.add_all(submissions)
        await db.flush()

        # ── Create answers + results ──
        esa_batch = []
        results = []

        for sub in submissions:
            part_scores = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0}
            total_correct = 0
            item_scores = {}
            correct_answers_dict = {}
            selected_answers_dict = {}
            item_points_dict = {}

            for efq in all_efq:
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
                total_points=120.0, score_method="CTT",
            ))

        await bulk_insert(db, ExamSubmissionAnswer, esa_batch, batch_size=5000)
        db.add_all(results)
        await db.commit()
        print(f"  {NUM_STUDENTS} submissions + results created")


async def main():
    t0 = asyncio.get_event_loop().time()
    await clear_all()
    admin, teacher = await seed_roles_and_admin()
    knowledge_nodes = await seed_knowledge()
    questions_by_key, answers_map = await seed_questions(teacher.id, knowledge_nodes)
    exam, form = await create_matrix_and_exam(admin.id, knowledge_nodes, questions_by_key)
    students, extra_student = await create_students()
    await simulate_exam(exam, form, students)
    elapsed = asyncio.get_event_loop().time() - t0
    print()
    print("=" * 60)
    print(f"  Hoan thanh trong {elapsed:.1f}s")
    print(f"  Admin:      admin / admin123")
    print(f"  Teacher:    teacher / teacher123")
    print(f"  Thi sinh:   student0001..student0300")
    print(f"  Du phong:   student0000 (CHUA THI, id={extra_student.id})")
    print(f"  Ky thi:     {exam.name} (id={exam.id})")
    print(f"  Ma de:      101 ({TOTAL_QUESTIONS} cau)")
    print(f"  Ket qua:    {NUM_STUDENTS} thi sinh co ExamResult (san sang chấm IRT)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
