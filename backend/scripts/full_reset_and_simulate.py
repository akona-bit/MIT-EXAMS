"""
Full reset + simulate a real ĐGNL exam with 300 students.
Run: python scripts/full_reset_and_simulate.py
"""
import asyncio
import random
import sys
import os
from datetime import datetime, timedelta, timezone
from itertools import product

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import Role, User
from app.models.question import KnowledgeNode, KnowledgeNodeType, Question, QuestionType, QuestionStatus, Answer
from app.models.passage import Passage
from app.models.exam import (
    Matrix, MatrixRule, MatrixRuleGroup, Exam, ExamStatus,
    ExamForm, ExamFormQuestion, ExamFormAnswer,
    ExamParticipant, ParticipantStatus,
    ExamSubmission, ExamSubmissionAnswer,
)
from app.db.bulk import bulk_insert
from app.models.grading import ExamResult
from app.models.omr import OmrJob, OmrSheet
from app.models.obsidian import ObsidianSyncRun, ObsidianFile
from app.models.audit import AuditLog
from app.models.system import SystemSetting

engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ── Config ──────────────────────────────────────────────────
NUM_STUDENTS = 300
QUESTIONS_PER_PART = 30
NUM_PARTS = 4
TOTAL_QUESTIONS = QUESTIONS_PER_PART * NUM_PARTS  # 120

PART_NAMES = {
    1: "Tiếng Việt",
    2: "Tiếng Anh",
    3: "Toán học",
    4: "Tư duy khoa học",
}

# Knowledge topics per part
KNOWLEDGE_TREE = {
    1: {  # Tiếng Việt
        "topic": "Ngôn ngữ và Văn học Việt Nam",
        "skills": [
            "Nắm bắt thông tin", "Hiểu dẫn giải", "Phân tích đánh giá", "Suy luận sáng tạo",
            "Nhận biết lỗi chính tả", "Chọn từ đúng ngữ cảnh", "Hiểu thành ngữ tục ngữ",
            "Phân tích đoạn văn", "Sắp xếp câu", "Tóm tắt ý chính",
        ],
    },
    2: {  # Tiếng Anh
        "topic": "English Language Skills",
        "skills": [
            "Reading Comprehension", "Grammar & Vocabulary", "Sentence Structure",
            "Cloze Test", "Word Formation", "Phrasal Verbs",
            "Idiomatic Expressions", "Error Identification", "Para Completion",
            "Inference & Main Idea",
        ],
    },
    3: {  # Toán
        "topic": "Toán học",
        "skills": [
            "Đại số", "Hình học", "Tọa độ Oxy", "Xác suất thống kê",
            "Lũy thừa & Logarithm", "Phương trình & Bất phương trình",
            "Hàm số", "Tổ hợp - Xác suất", "Số phức", "Vectors",
            "Các hàm số特别", "Nguyên hàm & Tích phân",
        ],
    },
    4: {  # Tư duy khoa học
        "topic": "Tư duy khoa học",
        "skills": [
            "Phân tích dữ liệu biểu đồ", "Thiết kế thí nghiệm", "Suy luận logic",
            "Đọc bảng số liệu", "So sánh giả thuyết", "Tính toán vật lý cơ bản",
            "Hiểu quy trình khoa học", "Phân tích nguyên nhân",
            "Kết luận từ dữ liệu", "Nhận diện mẫu số",
        ],
    },
}

LEVELS = [1, 2, 3]  # Nhan biết, Thông hiểu, Vận dụng


async def clear_all():
    """Truncate all tables in correct order."""
    print("Xóa toàn bộ dữ liệu cũ...")
    tables = [
        "exam_submission_answer", "exam_submission", "exam_tracking_log",
        "exam_participant", "exam_form_answer", "exam_form_question",
        "exam_form", "exam_generation_run", "exam_result", "irt_task",
        "item_analysis_result",
        "exam",
        "matrix_rule", "matrix_rule_group", "matrix",
        "question_sub_item", "answer", "question_embedding",
        "question", "resource", "passage",
        "knowledge_node_parent", "knowledge_node_link", "knowledge_node",
        "obsidian_file", "obsidian_sync_run",
        "omr_sheet", "omr_job",
        "audit_log", "system_setting",
        '"user"', '"role"',
    ]
    async with engine.begin() as conn:
        for t in tables:
            await conn.execute(text(f"TRUNCATE TABLE {t} CASCADE"))
    print("  ✓ Đã xóa tất cả")


async def seed_roles_and_admin():
    """Create 4 roles + admin user."""
    print("Tạo roles + admin...")
    async with SessionLocal() as db:
        roles = [
            {"id": 1, "name": "ADMIN", "description": "Quản trị hệ thống"},
            {"id": 2, "name": "TEACHER", "description": "Giáo viên"},
            {"id": 3, "name": "MODERATOR", "description": "Người duyệt câu hỏi"},
            {"id": 4, "name": "STUDENT", "description": "Thí sinh"},
        ]
        for r in roles:
            db.add(Role(**r))
        await db.flush()

        admin = User(
            username="admin",
            email="admin@mitexams.com",
            full_name="Admin",
            hashed_password=get_password_hash("admin123"),
            role_id=1,
            is_active=True,
        )
        teacher = User(
            username="teacher",
            email="teacher@mitexams.com",
            full_name="Giáo viên",
            hashed_password=get_password_hash("teacher123"),
            role_id=2,
            is_active=True,
        )
        db.add_all([admin, teacher])
        await db.commit()
        await db.refresh(admin)
        await db.refresh(teacher)
        print(f"  ✓ admin (id={admin.id}), teacher (id={teacher.id})")
        return admin, teacher


async def seed_knowledge():
    """Create knowledge tree for 4 parts."""
    print("Tạo kiến thức node...")
    async with SessionLocal() as db:
        nodes = {}  # (part, skill_idx) -> node_id
        for part, info in KNOWLEDGE_TREE.items():
            # Topic node
            topic = KnowledgeNode(
                name=info["topic"],
                node_type=KnowledgeNodeType.TOPIC,
                subject=PART_NAMES[part],
                short_code=f"P{part}",
                path_code=f"P{part}",
            )
            db.add(topic)
            await db.flush()

            for i, skill_name in enumerate(info["skills"]):
                skill = KnowledgeNode(
                    name=skill_name,
                    node_type=KnowledgeNodeType.SKILL,
                    subject=PART_NAMES[part],
                    parent_id=topic.id,
                    short_code=f"P{part}S{i+1:02d}",
                    path_code=f"P{part}/{skill_name[:20]}",
                )
                db.add(skill)
                await db.flush()
                nodes[(part, i)] = skill.id

        await db.commit()
        print(f"  ✓ {len(nodes)} skill nodes")
        return nodes


async def seed_questions(teacher_id: int, knowledge_nodes: dict):
    """Create 120 questions (30 per part) with 4 answers each."""
    print("Tạo 120 câu hỏi...")
    async with SessionLocal() as db:
        questions_to_add = []
        q_meta = [] # store correct_pos and part, idx
        for part in range(1, NUM_PARTS + 1):
            skill_ids = [knowledge_nodes[(part, i)] for i in range(10)]
            for idx in range(QUESTIONS_PER_PART):
                level = LEVELS[idx % 3]
                skill_id = skill_ids[idx % 10]
                correct_pos = random.randint(0, 3)

                q = Question(
                    content=f"Câu hỏi {part}-{idx+1}: Mô phỏng nội dung phần {PART_NAMES[part]}?",
                    level=level,
                    type=QuestionType.SINGLE_CHOICE,
                    status=QuestionStatus.APPROVED,
                    knowledge_node_id=skill_id,
                    creator_id=teacher_id,
                    a_param=round(random.uniform(0.5, 2.0), 2),
                    b_param=round(random.uniform(-2.0, 2.0), 2),
                    c_param=round(random.uniform(0.0, 0.3), 2),
                )
                questions_to_add.append(q)
                q_meta.append((part, idx, correct_pos))
                
        db.add_all(questions_to_add)
        await db.flush()
        
        answers_batch = []
        for q, (part, idx, correct_pos) in zip(questions_to_add, q_meta):
            q_answers = []
            for pos in range(4):
                ans = Answer(
                    question_id=q.id,
                    content=f"Đáp án {'ABCD'[pos]}",
                    is_correct=(pos == correct_pos),
                    position=pos,
                )
                db.add(ans)
                q_answers.append(ans)
            answers_map[(part, idx)] = q_answers
            questions[(part, idx)] = q.id
        await db.flush()
        
        # update answers_map to store id and is_correct for return
        for k, v in answers_map.items():
            answers_map[k] = [(ans.id, ans.is_correct) for ans in v]

        await db.commit()
        print(f"  ✓ {len(questions)} câu hỏi, {len(questions)*4} đáp án")
        return questions, answers_map


async def create_matrix_and_exam(admin_id: int, knowledge_nodes: dict, questions: dict):
    """Create matrix + exam + form with 120 questions shuffled."""
    print("Tạo ma trận + kỳ thi...")
    async with SessionLocal() as db:
        # Matrix
        matrix = Matrix(
            name="Ma trận ĐGNL Demo",
            subject="ĐGNL",
            description="Ma trận mô phỏng 120 câu, 4 phần",
        )
        db.add(matrix)
        await db.flush()

        # Rules: 30 per part
        rules_batch = []
        for part in range(1, NUM_PARTS + 1):
            skill_ids = [knowledge_nodes[(part, i)] for i in range(10)]
            for i, skill_id in enumerate(skill_ids):
                rules_batch.append({
                    "matrix_id": matrix.id,
                    "knowledge_node_id": skill_id,
                    "question_type": QuestionType.SINGLE_CHOICE,
                    "level": None,
                    "count": 3,
                    "part": part,
                    "position": i,
                })
        await bulk_insert(db, MatrixRule, rules_batch)

        # Exam
        now = datetime.now(timezone.utc)
        exam = Exam(
            name="Kỳ thi ĐGNL Demo 2026",
            description="Kỳ thi mô phỏng với 300 thí sinh",
            matrix_id=matrix.id,
            start_time=now - timedelta(hours=1),
            end_time=now + timedelta(hours=2),
            duration_minutes=150,
            status=ExamStatus.PUBLISHED,
            show_score_mode="NONE",
            show_answer_mode="NONE",
        )
        db.add(exam)
        await db.flush()

        # Form: shuffle questions per part
        form = ExamForm(
            exam_id=exam.id,
            code="101",
            is_original=True,
        )
        db.add(form)
        await db.flush()

        position = 1
        form_questions = {}  # (part, idx) -> ExamFormQuestion
        efqs_to_add = []
        efq_meta = []
        for part in range(1, NUM_PARTS + 1):
            indices = list(range(QUESTIONS_PER_PART))
            random.shuffle(indices)
            for idx in indices:
                q_id = questions[(part, idx)]
                efq = ExamFormQuestion(
                    exam_form_id=form.id,
                    question_id=q_id,
                    position=position,
                    part=part,
                )
                efqs_to_add.append(efq)
                efq_meta.append((part, idx, q_id))
                position += 1
                
        db.add_all(efqs_to_add)
        await db.flush()
        
        # We need all answers in one go for fast lookup
        all_q_ids = [q_id for _, _, q_id in efq_meta]
        ans_rows_all = (await db.execute(
            select(Answer).where(Answer.question_id.in_(all_q_ids))
        )).scalars().all()
        ans_by_q = {}
        for a in ans_rows_all:
            ans_by_q.setdefault(a.question_id, []).append(a)
        
        efa_batch = []
        for efq, (part, idx, q_id) in zip(efqs_to_add, efq_meta):
            form_questions[(part, idx)] = efq
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
        print(f"  ✓ Exam id={exam.id}, Form id={form.id}, {TOTAL_QUESTIONS} câu")
        return exam, form, form_questions


async def create_students():
    """Create 300 student users + Supabase auth entries."""
    print(f"Tạo {NUM_STUDENTS} thí sinh...")
    async with SessionLocal() as db:
        # Get student role
        role_result = await db.execute(select(Role).where(Role.name == "STUDENT"))
        student_role = role_result.scalars().first()

        students = []
        for i in range(1, NUM_STUDENTS + 1):
            sbd = f"SBD{i:04d}"
            user = User(
                username=f"student{i:04d}",
                email=f"student{i:04d}@test.com",
                full_name=f"Thí sinh {sbd}",
                role_id=student_role.id,
                is_active=True,
            )
            db.add(user)
            students.append((sbd, user))

        await db.commit()
        for sbd, u in students:
            await db.refresh(u)
        print(f"  ✓ {len(students)} thí sinh")
        return students


async def simulate_exam(exam, form, form_questions, students):
    """Each student answers all 120 questions (random + 70% correct bias)."""
    print(f"Mô phỏng {NUM_STUDENTS} thí sinh làm bài...")
    async with SessionLocal() as db:
        # Preload correct answers for each form question
        correct_map = {}  # exam_form_question_id -> answer_id
        all_efq = (await db.execute(
            select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == form.id)
        )).scalars().all()
        for efq in all_efq:
            efa_rows = (await db.execute(
                select(ExamFormAnswer).where(ExamFormAnswer.exam_form_question_id == efq.id)
            )).scalars().all()
            # Find which ExamFormAnswer maps to the correct Answer
            ans_rows = (await db.execute(
                select(Answer).where(Answer.id.in_([e.answer_id for e in efa_rows]))
            )).scalars().all()
            correct_by_id = {a.id: a.is_correct for a in ans_rows}
            for efa in efa_rows:
                if correct_by_id.get(efa.answer_id, False):
                    correct_map[efq.id] = efa
                    break

        # Also preload the question's correct answer for scoring
        q_correct = {}  # question_id -> answer_id
        for efq in all_efq:
            ans_rows = (await db.execute(
                select(Answer).where(Answer.question_id == efq.question_id, Answer.is_correct == True)
            )).scalars().all()
            if ans_rows:
                q_correct[efq.question_id] = ans_rows[0].id

        now = datetime.now(timezone.utc)
        
        # 1. Bulk insert Participants
        participants = []
        for sbd, student in students:
            p = ExamParticipant(
                exam_id=exam.id,
                user_id=student.id,
                sbd=sbd,
                exam_form_id=form.id,
                status=ParticipantStatus.SUBMITTED,
                start_time=now - timedelta(minutes=random.randint(10, 120)),
                submit_time=now - timedelta(minutes=random.randint(1, 9)),
            )
            participants.append(p)
        db.add_all(participants)
        await db.flush()
        
        # 2. Bulk insert Submissions
        submissions = []
        for p in participants:
            sub = ExamSubmission(
                exam_participant_id=p.id,
                submit_time=p.submit_time,
            )
            submissions.append(sub)
        db.add_all(submissions)
        await db.flush()
        
        # Pre-load question levels
        all_q_ids = [efq.question_id for efq in all_efq]
        q_levels_rows = (await db.execute(select(Question.id, Question.level).where(Question.id.in_(all_q_ids)))).all()
        q_levels = {row.id: row.level for row in q_levels_rows}
        
        # Pre-load efa options
        all_efa_rows = (await db.execute(select(ExamFormAnswer).where(ExamFormAnswer.exam_form_question_id.in_([efq.id for efq in all_efq])))).scalars().all()
        efa_by_efq = {}
        for efa in all_efa_rows:
            efa_by_efq.setdefault(efa.exam_form_question_id, []).append(efa)

        esa_batch = []
        results = []
        
        for sub in submissions:
            # Answer all 120 questions
            correct_count = 0
            total_score = 0
            item_scores = {}
            correct_answers_dict = {}
            selected_answers_dict = {}
            item_points_dict = {}
            
            part_scores = {p: 0.0 for p in range(1, 5)}

            for efq in all_efq:
                q_level = q_levels.get(efq.question_id, 1)
                correct_prob = {1: 0.75, 2: 0.60, 3: 0.40}.get(q_level, 0.60)
                efa_options = efa_by_efq.get(efq.id, [])

                if random.random() < correct_prob and efq.id in correct_map:
                    selected_efa = correct_map[efq.id]
                    is_correct = True
                else:
                    wrong = [e for e in efa_options if e.id != correct_map.get(efq.id)]
                    selected_esa = random.choice(wrong) if wrong else efa_options[0]
                    selected_efa = selected_esa
                    is_correct = False

                score = 1.0 if is_correct else 0.0
                esa_batch.append({
                    "exam_submission_id": sub.id,
                    "exam_form_question_id": efq.id,
                    "selected_answer_id": selected_efa.answer_id,
                    "score": score,
                })

                if is_correct:
                    correct_count += 1
                    total_score += 1.0
                    part_scores[efq.part] = part_scores.get(efq.part, 0) + 1.0

                item_scores[str(efq.id)] = score
                correct_answers_dict[str(efq.id)] = q_correct.get(efq.question_id)
                selected_answers_dict[str(efq.id)] = selected_efa.answer_id
                item_points_dict[str(efq.id)] = score
                
            # Scale to 0-300 per part
            irt_scores = {p: round((part_scores[p] / 30.0) * 300, 1) for p in range(1, 5)}
            total_irt = sum(irt_scores.values())

            result = ExamResult(
                exam_submission_id=sub.id,
                ctt_score_part1=part_scores[1],
                ctt_score_part2=part_scores[2],
                ctt_score_part3=part_scores[3],
                ctt_score_part4=part_scores[4],
                irt_score_part1=irt_scores[1],
                irt_score_part2=irt_scores[2],
                irt_score_part3=irt_scores[3],
                irt_score_part4=irt_scores[4],
                total_score=total_irt,
                raw_total_score=total_score,
                item_scores=item_scores,
                correct_answers=correct_answers_dict,
                selected_answers=selected_answers_dict,
                item_points=item_points_dict,
                score_method="CTT",
            )
            results.append(result)

        await bulk_insert(db, ExamSubmissionAnswer, esa_batch, batch_size=5000)
        db.add_all(results)
        await db.commit()
        print(f"  ✓ {NUM_STUDENTS} submissions + results created")


async def main():
    t0 = asyncio.get_event_loop().time()

    await clear_all()
    admin, teacher = await seed_roles_and_admin()
    knowledge_nodes = await seed_knowledge()
    questions, answers_map = await seed_questions(teacher.id, knowledge_nodes)
    exam, form, form_questions = await create_matrix_and_exam(admin.id, knowledge_nodes, questions)
    students = await create_students()
    await simulate_exam(exam, form, form_questions, students)

    elapsed = asyncio.get_event_loop().time() - t0
    print(f"\n{'='*50}")
    print(f"Hoàn thành trong {elapsed:.1f}s")
    print(f"  Admin:     admin / admin123")
    print(f"  Teacher:   teacher / teacher123")
    print(f"  Students:  student0001..student0300 / (không có password local)")
    print(f"  Exam:      Kỳ thi ĐGNL Demo 2026 (id={exam.id})")
    print(f"  Form:      101 ({TOTAL_QUESTIONS} câu)")
    print(f"  Students:  {NUM_STUDENTS} thí sinh đã nộp bài")
    print(f"{'='*50}")


if __name__ == "__main__":
    asyncio.run(main())
