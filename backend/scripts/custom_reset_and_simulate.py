"""
Full reset + simulate a custom ĐGNL exam based on custom_matrix.csv.
Run: python scripts/custom_reset_and_simulate.py
"""
import asyncio
import csv
import random
import sys
import os
import math
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

NUM_STUDENTS = 1000
NUM_FORMS = 20

# Mapping of code prefix to Part
def get_part_by_code(code: str):
    if code.startswith('A'): return 1
    if code.startswith('B'): return 2
    if code.startswith('C'): return 3
    if code.startswith('D'): return 4
    return 1

PART_NAMES = {1: "Tiếng Việt", 2: "Tiếng Anh", 3: "Toán học", 4: "Tư duy khoa học"}

def parse_csv_matrix(filepath):
    parsed = []
    current_topic = ""
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            if not row or not any(row): continue
            code, topic, skill, count_str, note = row[0], row[1], row[2], row[3], row[4] if len(row) > 4 else ""
            if topic.strip():
                current_topic = topic.strip()
            
            count_val = 0.0
            if count_str.strip():
                try:
                    count_val = float(count_str.strip())
                except:
                    pass
            
            parsed.append({
                "code": code.strip(),
                "topic": current_topic,
                "skill": skill.strip(),
                "count": count_val,
                "note": note.strip()
            })
            
    # Resolve fractional counts so they sum exactly per part (each part usually 30)
    # We group by part
    by_part = {1: [], 2: [], 3: [], 4: []}
    for item in parsed:
        part = get_part_by_code(item['code'])
        by_part[part].append(item)
        
    resolved_rules = []
    for part, items in by_part.items():
        total_needed = 30
        current_sum = 0
        for item in items:
            item['resolved_count'] = int(math.floor(item['count']))
            current_sum += item['resolved_count']
        
        # distribute the remainder randomly among those that had a fractional part
        fractional_items = [item for item in items if item['count'] - int(math.floor(item['count'])) > 0]
        
        needed = total_needed - current_sum
        while needed > 0 and fractional_items:
            item = random.choice(fractional_items)
            item['resolved_count'] += 1
            fractional_items.remove(item)
            needed -= 1
            
        # if still needed (e.g. some cells were just empty but we need to hit 30)
        while needed > 0 and items:
            item = random.choice(items)
            item['resolved_count'] += 1
            needed -= 1
            
        resolved_rules.extend(items)
        
    return resolved_rules


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
        return admin, teacher

async def seed_knowledge_and_matrix_and_questions(teacher_id, csv_path):
    print("Tao knowledge nodes, ma tran va cau hoi...")
    rules_data = parse_csv_matrix(csv_path)
    
    async with SessionLocal() as db:
        matrix = Matrix(name="Ma tran DGNL Custom", subject="DGNL", description="Ma tran tu file CSV")
        db.add(matrix)
        await db.flush()
        
        # Build Knowledge Nodes
        topics = {}
        skills = {}
        
        questions_by_key = {}  # (part, index) -> question_id
        efq_meta = [] # list of (part, q_id)
        
        for rule in rules_data:
            part = get_part_by_code(rule['code'])
            topic_name = rule['topic'] if rule['topic'] else f"Topic {part}"
            skill_name = rule['skill'] if rule['skill'] else f"Skill {rule['code']}"
            
            if (part, topic_name) not in topics:
                t = KnowledgeNode(name=topic_name, node_type=KnowledgeNodeType.TOPIC,
                                  subject=PART_NAMES[part], short_code=f"P{part}", path_code=f"P{part}")
                db.add(t)
                await db.flush()
                topics[(part, topic_name)] = t.id
                
            parent_id = topics[(part, topic_name)]
            if (part, topic_name, skill_name) not in skills:
                s = KnowledgeNode(name=skill_name, node_type=KnowledgeNodeType.SKILL,
                                  subject=PART_NAMES[part], parent_id=parent_id,
                                  short_code=rule['code'], path_code=f"P{part}/{skill_name[:20]}")
                db.add(s)
                await db.flush()
                skills[(part, topic_name, skill_name)] = s.id
                
            skill_id = skills[(part, topic_name, skill_name)]
            
            if rule['resolved_count'] > 0:
                mr = MatrixRule(
                    matrix_id=matrix.id,
                    knowledge_node_id=skill_id,
                    question_type=QuestionType.SINGLE_CHOICE,
                    count=rule['resolved_count'],
                    part=part,
                    position=len(efq_meta),
                    note=rule['note']
                )
                db.add(mr)
                await db.flush()
                
                # Create exact questions for this rule
                for _ in range(rule['resolved_count']):
                    correct_pos = random.randint(0, 3)
                    q = Question(
                        content=f"Câu hỏi thuộc phần {PART_NAMES[part]}\\n**Chủ đề**: {topic_name}\\n**Kỹ năng**: {skill_name}\\n**Ghi chú**: {rule['note']}\\n\\nHãy chọn đáp án đúng nhất.",
                        level=random.choice([1, 2, 3]),
                        type=QuestionType.SINGLE_CHOICE,
                        status=QuestionStatus.APPROVED,
                        knowledge_node_id=skill_id,
                        creator_id=teacher_id,
                        a_param=round(random.uniform(0.5, 2.0), 2),
                        b_param=round(random.uniform(-2.0, 2.0), 2),
                        c_param=round(random.uniform(0.0, 0.3), 2),
                    )
                    db.add(q)
                    await db.flush()
                    
                    for pos in range(4):
                        ans = Answer(question_id=q.id, content=f"Đáp án {'ABCD'[pos]} cho câu hỏi {skill_name}",
                                     is_correct=(pos == correct_pos), position=pos)
                        db.add(ans)
                    await db.flush()
                    efq_meta.append((part, q.id))
                    
        await db.commit()
        print(f"  Da tao {len(efq_meta)} cau hoi tu CSV")
        return matrix, efq_meta

async def create_exam_and_forms(matrix, efq_meta):
    print(f"Tao ky thi + {NUM_FORMS} ma de...")
    async with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        exam = Exam(name="Ky thi DGNL 1000 TS - 20 Ma De", description=f"Ky thi custom mo phong 1000 thi sinh, {NUM_FORMS} ma de",
                     matrix_id=matrix.id, start_time=now - timedelta(hours=1),
                     end_time=now + timedelta(hours=2), duration_minutes=150,
                     status=ExamStatus.PUBLISHED, show_score_mode="NONE", show_answer_mode="NONE")
        db.add(exam)
        await db.flush()

        # Group efq_meta by part to enforce order Part 1 -> Part 4
        by_part = {1: [], 2: [], 3: [], 4: []}
        for p, q_id in efq_meta:
            by_part[p].append(q_id)
            
        all_q_ids = [q_id for p, q_id in efq_meta]
        ans_rows_all = (await db.execute(
            select(Answer).where(Answer.question_id.in_(all_q_ids))
        )).scalars().all()
        ans_by_q = {}
        for a in ans_rows_all:
            ans_by_q.setdefault(a.question_id, []).append(a)

        forms = []
        final_efq_metas = {} # form_id -> final_efq_meta
        
        for form_idx in range(NUM_FORMS):
            form = ExamForm(exam_id=exam.id, code=f"{101 + form_idx}", is_original=(form_idx == 0))
            db.add(form)
            await db.flush()
            forms.append(form)

            position = 1
            efqs_to_add = []
            final_efq_meta = []
            
            for part in range(1, 5):
                q_ids = list(by_part[part])
                random.shuffle(q_ids) # shuffle within part
                for q_id in q_ids:
                    efq = ExamFormQuestion(exam_form_id=form.id, question_id=q_id, position=position, part=part)
                    efqs_to_add.append(efq)
                    final_efq_meta.append((part, position, q_id))
                    position += 1
                    
            db.add_all(efqs_to_add)
            await db.flush()

            efa_batch = []
            for efq, (part, idx, q_id) in zip(efqs_to_add, final_efq_meta):
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
            final_efq_metas[form.id] = final_efq_meta
            
        await db.commit()
        
        print(f"  Exam id={exam.id}, Created {len(forms)} forms")
        return exam, forms, final_efq_metas

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
                     role_id=student_role.id, is_active=True,
                     hashed_password=get_password_hash("student123"))
                     
        # Give the first student a known password for testing too if needed, but extra is enough
        for _, u in students:
            u.hashed_password = get_password_hash("student123")
            
        db.add(extra)
        await db.commit()
        for sbd, u in students:
            await db.refresh(u)
        await db.refresh(extra)
        print(f"  {len(students)} thi sinh + 1 du phong (id={extra.id})")
        return students, extra

async def simulate_exam(exam, forms, students, final_efq_metas):
    print(f"Mo phong {NUM_STUDENTS} thi sinh lam bai voi {NUM_FORMS} ma de (co the ton thoi gian)...")
    async with SessionLocal() as db:
        form_ids = [f.id for f in forms]
        
        all_efq = (await db.execute(
            select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id.in_(form_ids))
            .order_by(ExamFormQuestion.position)
        )).scalars().all()

        all_efa = (await db.execute(
            select(ExamFormAnswer).where(ExamFormAnswer.exam_form_question_id.in_([efq.id for efq in all_efq]))
        )).scalars().all()

        all_answers = (await db.execute(
            select(Answer).where(Answer.question_id.in_([efq.question_id for efq in all_efq]))
        )).scalars().all()

        correct_map = {}
        efq_part = {}
        efq_qid = {}
        efa_by_efq = {}
        correct_by_qid = {}

        for efq in all_efq:
            efq_part[efq.id] = efq.part
            efq_qid[efq.id] = efq.question_id

        for a in all_answers:
            if a.is_correct:
                correct_by_qid[a.question_id] = a.id

        for efa in all_efa:
            efa_by_efq.setdefault(efa.exam_form_question_id, []).append(efa)

        for efq in all_efq:
            cid = correct_by_qid.get(efq.question_id)
            if cid:
                for efa in efa_by_efq.get(efq.id, []):
                    if efa.answer_id == cid:
                        correct_map[efq.id] = efa
                        break

        now = datetime.now(timezone.utc)

        # Batch insert to avoid huge memory spikes
        batch_size = 100
        total_batches = (len(students) + batch_size - 1) // batch_size
        
        for batch_idx in range(total_batches):
            batch_students = students[batch_idx * batch_size : (batch_idx + 1) * batch_size]
            
            participants = []
            for sbd, student in batch_students:
                form = random.choice(forms)
                p = ExamParticipant(
                    exam_id=exam.id, user_id=student.id, sbd=sbd, exam_form_id=form.id,
                    status=ParticipantStatus.SUBMITTED,
                    start_time=now - timedelta(minutes=random.randint(10, 120)),
                    submit_time=now - timedelta(minutes=random.randint(1, 9)),
                )
                participants.append(p)
            db.add_all(participants)
            await db.flush()

            submissions = []
            for p in participants:
                sub = ExamSubmission(exam_participant_id=p.id, submit_time=p.submit_time)
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
            print(f"    Xong batch {batch_idx+1}/{total_batches} ({len(batch_students)} thi sinh)")

async def main():
    t0 = asyncio.get_event_loop().time()
    await clear_all()
    admin, teacher = await seed_roles_and_admin()
    
    csv_path = os.path.join(os.path.dirname(__file__), 'custom_matrix.csv')
    matrix, efq_meta = await seed_knowledge_and_matrix_and_questions(teacher.id, csv_path)
    exam, forms, final_efq_metas = await create_exam_and_forms(matrix, efq_meta)
    
    students, extra_student = await create_students()
    await simulate_exam(exam, forms, students, final_efq_metas)
    
    elapsed = asyncio.get_event_loop().time() - t0
    print()
    print("=" * 60)
    print(f"  Hoan thanh trong {elapsed:.1f}s")
    print(f"  Admin:      admin / admin123")
    print(f"  Teacher:    teacher / teacher123")
    print(f"  Thi sinh:   student0001..student1000 (Pass: student123)")
    print(f"  Du phong:   student0000 (CHUA THI, Pass: student123)")
    print(f"  Ky thi:     {exam.name} (id={exam.id})")
    print(f"  So ma de:   {NUM_FORMS} ma de")
    print(f"  Ket qua:    {NUM_STUDENTS} thi sinh co ExamResult")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
