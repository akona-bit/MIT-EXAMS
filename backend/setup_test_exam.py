import os, sys, asyncio
sys.path.append(os.getcwd())
from app.db.database import async_session_maker
from sqlalchemy import select, text
from app.models.question import Question, QuestionType
from app.models.exam import Exam, ExamForm, ExamFormQuestion, ExamParticipant, ExamMode, ExamStatus, ParticipantStatus, Matrix
from app.models.user import User, Role
from app.core.security import get_password_hash
from datetime import datetime, timedelta
import random
import uuid

async def setup():
    async with async_session_maker() as session:
        print("Getting STUDENT role...")
        res = await session.execute(select(Role).filter_by(name="STUDENT"))
        student_role = res.scalar_one()

        print("Clearing old exam data (TRUNCATE)...")
        await session.execute(text("TRUNCATE TABLE exam CASCADE"))
        await session.commit()
        
        # Get Matrix
        res = await session.execute(select(Matrix).limit(1))
        matrix = res.scalar_one_or_none()
        if not matrix:
            matrix = Matrix(name="Default Matrix")
            session.add(matrix)
            await session.flush()
        
        print("Getting questions...")
        res = await session.execute(select(Question).filter(Question.passage_id.isnot(None)))
        passages = res.scalars().all()
        res = await session.execute(select(Question).filter(Question.type == QuestionType.COMPOSITE))
        composites = res.scalars().all()
        
        all_qs = passages[:3] + composites[:3]
        if len(all_qs) < 6:
            print("Not enough questions!")
            return
            
        print("Creating exam...")
        exam = Exam(
            name="Đề thi thử Ngữ liệu & Câu chùm",
            description="Bài thi gồm 3 câu ngữ liệu và 3 câu chùm",
            matrix_id=matrix.id,
            status=ExamStatus.PUBLISHED,
            duration_minutes=45,
            start_time=datetime.utcnow() - timedelta(days=1),
            end_time=datetime.utcnow() + timedelta(days=7),
            max_attempts=3,
            allow_omr=False
        )
        session.add(exam)
        await session.flush()
        
        print("Creating 20 forms...")
        forms = []
        for i in range(1, 21):
            form = ExamForm(
                exam_id=exam.id,
                code=f"1{i:02d}"
            )
            session.add(form)
            forms.append(form)
        await session.flush()
        
        print("Assigning questions to forms (shuffled)...")
        for form in forms:
            shuffled_qs = list(all_qs)
            random.shuffle(shuffled_qs)
            for idx, q in enumerate(shuffled_qs):
                form_q = ExamFormQuestion(
                    exam_form_id=form.id,
                    question_id=q.id,
                    position=idx + 1,
                    part=1
                )
                session.add(form_q)
        
        print("Creating test user account...")
        test_email = "thi_sinh_test@example.com"
        res = await session.execute(select(User).filter_by(email=test_email))
        test_user = res.scalar_one_or_none()
        if not test_user:
            test_user = User(
                email=test_email,
                username="TS9999",
                full_name="Thí sinh Test",
                hashed_password=get_password_hash("password"),
                role_id=student_role.id,
                is_active=True
            )
            session.add(test_user)
            await session.flush()
        else:
            test_user.hashed_password = get_password_hash("password")
            
        print("Generating 1000 participants...")
        res = await session.execute(select(User).filter_by(role_id=student_role.id))
        students = res.scalars().all()
        needed = 1000 - len(students)
        if needed > 0:
            print(f"Creating {needed} mock students...")
            for i in range(needed):
                u = User(
                    email=f"mock_{uuid.uuid4().hex[:8]}@example.com",
                    username=f"TS{i:05d}",
                    full_name=f"Mock Student {i}",
                    hashed_password=get_password_hash("mock"),
                    role_id=student_role.id,
                    is_active=True
                )
                session.add(u)
            await session.flush()
            res = await session.execute(select(User).filter_by(role_id=student_role.id))
            students = res.scalars().all()
            
        print("Assigning 1000 students to exam...")
        participants = []
        for i, s in enumerate(students[:1000]):
            form = random.choice(forms)
            p = ExamParticipant(
                exam_id=exam.id,
                user_id=s.id,
                exam_form_id=form.id,
                status=ParticipantStatus.NOT_STARTED
            )
            session.add(p)
            participants.append(p)
            
        if test_user not in students[:1000]:
            p = ExamParticipant(
                exam_id=exam.id,
                user_id=test_user.id,
                exam_form_id=random.choice(forms).id,
                status=ParticipantStatus.NOT_STARTED
            )
            session.add(p)
            
        await session.commit()
        
        print(f"Done! Test account: {test_email} / password")

asyncio.run(setup())
