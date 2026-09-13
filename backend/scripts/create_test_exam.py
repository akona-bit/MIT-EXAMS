import asyncio
import sys
import os
import random
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import Role, User
from app.models.question import (
    KnowledgeNode, KnowledgeNodeType, Question, QuestionType, QuestionStatus, Answer, QuestionSubItem
)
from app.models.passage import Passage
from app.models.exam import (
    Exam, ExamStatus, ExamForm, ExamFormQuestion, ExamFormAnswer
)
from app.db.bulk import bulk_insert

engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def main():
    print("Tao de thi dac biet: 3 cau ngu lieu, 3 cau chum...")
    async with SessionLocal() as db:
        # Get role STUDENT
        student_role = (await db.execute(select(Role).where(Role.name == "STUDENT"))).scalars().first()
        if not student_role:
            print("Khong tim thay role STUDENT!")
            return
            
        # Create test student
        test_student = (await db.execute(select(User).where(User.username == "test_student"))).scalars().first()
        if not test_student:
            test_student = User(
                username="test_student", email="test_student@test.com",
                full_name="Thi sinh Test Nhanh", registration_number="999999",
                role_id=student_role.id, is_active=True,
                hashed_password=get_password_hash("test1234")
            )
            db.add(test_student)
            await db.flush()
        else:
            test_student.hashed_password = get_password_hash("test1234")
            
        # Get admin/teacher for creator_id
        admin = (await db.execute(select(User).where(User.username == "admin"))).scalars().first()
        creator_id = admin.id if admin else 1
        
        # Create a dummy KnowledgeNode
        kn = KnowledgeNode(name="Test Topic", node_type=KnowledgeNodeType.TOPIC)
        db.add(kn)
        await db.flush()
        
        # 1. Create a Passage
        now = datetime.now(timezone.utc)
        passage = Passage(
            public_code=f"PASSAGE_{int(now.timestamp())}",
            content="Đây là một đoạn ngữ liệu văn bản dài. Đọc kỹ để trả lời các câu hỏi bên dưới. Hệ Mặt Trời có 8 hành tinh. Sao Mộc là hành tinh lớn nhất.",
            source_author="Khoa học tự nhiên 6",
            creator_id=creator_id
        )
        db.add(passage)
        await db.flush()
        
        # 2. Create 3 reading passage questions
        questions = []
        for i in range(1, 4):
            q = Question(
                content=f"Dựa vào đoạn văn trên, câu hỏi {i} là gì?",
                level=random.choice([1, 2]),
                type=QuestionType.SINGLE_CHOICE,
                status=QuestionStatus.APPROVED,
                creator_id=creator_id,
                passage_id=passage.id,
                knowledge_node_id=kn.id
            )
            db.add(q)
            await db.flush()
            
            # Answers for single choice
            for pos in range(4):
                ans = Answer(
                    question_id=q.id,
                    content=f"Đáp án {pos+1} cho câu hỏi {i}",
                    is_correct=(pos == 0), # always pos 0 is correct
                    position=pos
                )
                db.add(ans)
            await db.flush()
            questions.append(q)
            
        # 3. Create 3 composite questions (câu chùm)
        for i in range(4, 7):
            q_comp = Question(
                content=f"Cho biểu thức A. Hãy trả lời các ý dưới đây (Câu chùm {i}).",
                level=3,
                type=QuestionType.COMPOSITE,
                status=QuestionStatus.APPROVED,
                creator_id=creator_id,
                knowledge_node_id=kn.id
            )
            db.add(q_comp)
            await db.flush()
            
            # Sub items
            for pos, label in enumerate(['a', 'b', 'c', 'd']):
                sub = QuestionSubItem(
                    question_id=q_comp.id,
                    label=label,
                    prompt=f"Mệnh đề {label} có đúng không?",
                    position=pos,
                    point_weight=0.25,
                    kind="tf"
                )
                db.add(sub)
                await db.flush()
                
                # Answers for sub item (True/False)
                ans_true = Answer(
                    question_id=q_comp.id,
                    sub_item_id=sub.id,
                    content="Đúng",
                    is_correct=random.choice([True, False]),
                    position=0
                )
                ans_false = Answer(
                    question_id=q_comp.id,
                    sub_item_id=sub.id,
                    content="Sai",
                    is_correct=not ans_true.is_correct,
                    position=1
                )
                db.add(ans_true)
                db.add(ans_false)
            await db.flush()
            questions.append(q_comp)
            
        # 4. Create an Exam
        from app.models.exam import Matrix
        matrix = Matrix(name="Dummy Matrix for Test", subject="DGNL", description="Dummy")
        db.add(matrix)
        await db.flush()
        
        exam = Exam(
            name=f"Đề thi thử Ngữ liệu & Câu chùm",
            description="Đề thi 6 câu: 3 câu theo ngữ liệu chung, 3 câu chùm True/False.",
            matrix_id=matrix.id,
            start_time=now - timedelta(hours=1),
            end_time=now + timedelta(hours=24),
            duration_minutes=60,
            status=ExamStatus.PUBLISHED,
            show_score_mode="IMMEDIATELY",
            show_answer_mode="IMMEDIATELY",
        )
        db.add(exam)
        await db.flush()
        
        # 5. Create 1 Exam Form
        form = ExamForm(exam_id=exam.id, code="999", is_original=True)
        db.add(form)
        await db.flush()
        
        # 6. Map questions to form
        position = 1
        efa_batch = []
        for q in questions:
            efq = ExamFormQuestion(exam_form_id=form.id, question_id=q.id, position=position, part=1)
            db.add(efq)
            await db.flush()
            position += 1
            
            # Map answers to form (shuffle logic just copies original for simplicity here since it's test)
            ans_rows = (await db.execute(select(Answer).where(Answer.question_id == q.id).order_by(Answer.position))).scalars().all()
            for new_pos, a in enumerate(ans_rows):
                efa_batch.append({
                    "exam_form_question_id": efq.id,
                    "answer_id": a.id,
                    "new_position": new_pos + 1
                })
                
        await bulk_insert(db, ExamFormAnswer, efa_batch)
        await db.commit()
        
        print("Done!")
        print("="*50)
        print("TÀI KHOẢN THI THỬ:")
        print("Username/SBD: test_student")
        print("Password: test1234")
        print(f"Kỳ thi: {exam.name} (ID: {exam.id})")
        print("="*50)

if __name__ == "__main__":
    asyncio.run(main())
