import asyncio
import os
import sys
import pandas as pd
from datetime import datetime

# Setup path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from app.db.database import AsyncSessionLocal, engine
from app.models.user import User, Role
from app.models.question import Question, Answer, QuestionType, QuestionStatus, KnowledgeNode, KnowledgeNodeType
from app.models.exam import (
    Exam, ExamForm, ExamFormQuestion, Matrix, MatrixRule, 
    ExamParticipant, ExamSubmission, ParticipantStatus, ExamStatus
)
from sqlalchemy import text, select

DATA_DIR = os.path.join(parent_dir, "..", "data")

async def truncate_tables(session):
    print("Clearing existing test data...")
    # Using CASCADE to clear dependencies
    tables = [
        "exam_submission",
        "exam_tracking_log",
        "exam_participant",
        "exam_form_question",
        "exam_form",
        "exam",
        "matrix_rule",
        "matrix",
        "answer",
        "question",
        "knowledge_node"
    ]
    for table in tables:
        await session.execute(text(f'TRUNCATE TABLE "{table}" CASCADE;'))
    
    # Delete all users except ADMIN
    await session.execute(text("DELETE FROM \"user\" WHERE role_id != 1;"))
    await session.commit()
    print("Test data cleared.")

def safe_float(val):
    try:
        if pd.isna(val) or val == "":
            return None
        return float(val)
    except:
        return None

async def import_data():
    async with AsyncSessionLocal() as session:
        await truncate_tables(session)
        
        print("Importing standard setup (Roles, Knowledge Nodes, Matrix, Exam)...")
        # Ensure Roles
        student_role = (await session.execute(select(Role).where(Role.name == "STUDENT"))).scalars().first()
        if not student_role:
            student_role = Role(name="STUDENT", description="Student Role")
            session.add(student_role)
            await session.commit()
            
        admin_user = (await session.execute(select(User).where(User.role_id == 1))).scalars().first()
        admin_id = admin_user.id if admin_user else 1

        # Knowledge Node
        node = KnowledgeNode(name="Kiến thức chung", node_type=KnowledgeNodeType.TOPIC, subject="Tổng hợp")
        session.add(node)
        await session.commit()
        await session.refresh(node)
        
        # Matrix
        matrix = Matrix(name="Ma trận ĐGNL ĐHQG-HCM 120 câu", subject="Tổng hợp")
        session.add(matrix)
        await session.commit()
        await session.refresh(matrix)
        
        # Create 60 rules for 60 questions
        for i in range(1, 61):
            rule = MatrixRule(
                matrix_id=matrix.id,
                knowledge_node_id=node.id,
                question_type=QuestionType.SINGLE_CHOICE,
                level=2,
                count=1,
                part=1 if i <= 30 else 2, # Assuming 1-30 Math, 31-60 Sci
                position=i
            )
            session.add(rule)
        await session.commit()
        
        # Exam
        exam = Exam(
            name="Kỳ thi ĐGNL Khảo sát Chất lượng",
            description="Imported from raw data",
            matrix_id=matrix.id,
            duration_minutes=150,
            status=ExamStatus.COMPLETED,
            start_time=datetime.now(),
            end_time=datetime.now()
        )
        session.add(exam)
        await session.commit()
        await session.refresh(exam)
        
        # ExamForm
        form = ExamForm(exam_id=exam.id, code="101", is_original=True)
        session.add(form)
        await session.commit()
        await session.refresh(form)
        
        print("Importing 60 Questions...")
        # Create 60 questions and answers
        questions = []
        for i in range(1, 61):
            subject = "Toán" if i <= 30 else "Khoa học Tự nhiên"
            q = Question(
                content=f"Nội dung câu {i} ({subject})",
                level=2,
                type=QuestionType.SINGLE_CHOICE,
                status=QuestionStatus.APPROVED,
                knowledge_node_id=node.id,
                creator_id=admin_id
            )
            session.add(q)
            await session.commit()
            await session.refresh(q)
            questions.append(q)
            
            # Map to ExamForm
            efq = ExamFormQuestion(
                exam_form_id=form.id,
                question_id=q.id,
                position=i,
                part=1 if i <= 30 else 2
            )
            session.add(efq)
            
            # 4 Answers
            for j in range(1, 5):
                ans = Answer(
                    question_id=q.id,
                    content=f"Đáp án {['A','B','C','D'][j-1]}",
                    is_correct=(j==1), # just make A correct
                    position=j
                )
                session.add(ans)
        
        await session.commit()
        
        print("Importing Students from CSV...")
        raw_students_path = os.path.join(DATA_DIR, "raw_students.csv")
        responses_path = os.path.join(DATA_DIR, "raw_student_responses.csv")
        
        df_resp = pd.read_csv(responses_path)
        # map name to email
        email_map = {}
        for _, row in df_resp.iterrows():
            name = str(row.get('Họ và tên', '')).strip()
            email = str(row.get('Email', '')).strip()
            if name and email and email != 'nan':
                email_map[name.lower()] = email
        
        df_students = pd.read_csv(raw_students_path, header=None).iloc[2:]
        users_added = 0
        seen_emails = {}
        
        for idx, row in df_students.iterrows():
            name = str(row[1]).strip()
            if pd.isna(name) or name == "nan" or name == "None":
                continue
                
            tho_toan = safe_float(row[2])
            tho_tdkh = safe_float(row[3])
            irt_toan = safe_float(row[4])
            irt_tdkh = safe_float(row[5])
            
            # Find email or generate dummy
            email = email_map.get(name.lower(), f"student_{idx}@example.com")
            
            if email in seen_emails:
                user_id = seen_emails[email]
            else:
                # Create user
                user = User(
                    full_name=name,
                    username=email.split('@')[0] + str(idx),
                    email=email,
                    role_id=student_role.id,
                    is_active=True
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
                user_id = user.id
                seen_emails[email] = user.id
                users_added += 1
            
            # Create Participant
            participant = ExamParticipant(
                exam_id=exam.id,
                user_id=user_id,
                sbd=f"SBD{idx:04d}",
                exam_form_id=form.id,
                status=ParticipantStatus.SUBMITTED,
                target_score=None
            )
            session.add(participant)
            await session.commit()
            await session.refresh(participant)
            
            # Create Submission
            submission = ExamSubmission(
                exam_participant_id=participant.id,
                submit_time=datetime.now()
            )
            session.add(submission)
            await session.commit()
            users_added += 1
            
        print(f"Successfully imported {users_added} students and their attempts.")
        print("Data migration complete!")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(import_data())
