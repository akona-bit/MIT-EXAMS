import asyncio
import os
import sys
import pandas as pd
from datetime import datetime, timezone

# Add app to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import AsyncSessionLocal
from app.models.exam import Exam, ExamStatus, ExamForm, ExamFormQuestion, ExamParticipant, ExamSubmission, ExamSubmissionAnswer
from app.models.question import Question, Answer
from app.models.passage import Passage
from app.models.grading import ExamResult
from sqlalchemy import select
from app.services.grading.scorer import run_irt_calibration_task
from app.models.grading import IrtTask

DATA_DIR = r"d:\MIT\data"

def safe_float(val):
    try:
        if pd.isna(val) or val == "":
            return None
        return float(val)
    except:
        return None

async def seed_demo():
    print("Seeding demo exam from CSV...")
    
    # 1. Read CSV
    students_df = pd.read_csv(os.path.join(DATA_DIR, "raw_students.csv"), header=None)
    data_rows = students_df.iloc[2:]
    
    resp_df = pd.read_csv(os.path.join(DATA_DIR, "raw_student_responses.csv"))
    
        # 0. Ensure user exists
        from app.models.user import User
        from app.models.exam import Matrix
        user = await db.get(User, 1)
        if not user:
            user = User(id=1, username="demo_user", email="demo@example.com", hashed_password="pw")
            db.add(user)
            await db.flush()
            
        matrix = await db.get(Matrix, 1)
        if not matrix:
            matrix = Matrix(id=1, name="Ma trận Demo", description="")
            db.add(matrix)
            await db.flush()
            
        # Create a Demo Exam
        exam = Exam(
            name="[Demo] Kỳ thi Đánh giá Năng lực - Dữ liệu Mẫu",
            description="Kỳ thi được seed từ bộ dữ liệu 703 thí sinh để demo màn hình Phân tích.",
            matrix_id=1,
            duration_minutes=150,
            status=ExamStatus.DRAFT
        )
        db.add(exam)
        await db.flush()
        
        exam_form = ExamForm(exam_id=exam.id, code="DEMO_101", is_original=True)
        db.add(exam_form)
        await db.flush()
        
        # We need 120 questions. Let's fetch 120 existing questions or create dummies
        q_result = await db.execute(select(Question).limit(120))
        questions = q_result.scalars().all()
        
        while len(questions) < 120:
            q = Question(content=f"Câu hỏi Demo {len(questions)+1}", level=1)
            db.add(q)
            await db.flush()
            
            # 4 answers
            for idx in range(4):
                a = Answer(question_id=q.id, content=f"Đáp án {idx+1}", is_correct=(idx==0))
                db.add(a)
            questions.append(q)
            await db.flush()
            
        # Create form questions
        form_questions = []
        for i in range(120):
            part = 1
            if i >= 30: part = 2
            if i >= 60: part = 3
            if i >= 90: part = 4
            fq = ExamFormQuestion(exam_form_id=exam_form.id, question_id=questions[i].id, position=i+1, part=part)
            db.add(fq)
            form_questions.append(fq)
        
        await db.flush()
        
        print(f"Created Exam {exam.id} with Form {exam_form.id}")
        
        # 2. Add Participants & Submissions
        participants_count = 0
        for idx, row in data_rows.iterrows():
            stt = str(row[0])
            name = str(row[1]).strip()
            if pd.isna(name) or name == "nan" or name == "None":
                continue
                
            participant = ExamParticipant(
                exam_id=exam.id,
                user_id=1, # Mock user id
                sbd=f"SBD_{stt}",
                exam_form_id=exam_form.id,
                status="SUBMITTED",
                start_time=datetime.now(timezone.utc),
                submit_time=datetime.now(timezone.utc)
            )
            db.add(participant)
            await db.flush()
            
            submission = ExamSubmission(
                exam_participant_id=participant.id,
                submit_time=participant.submit_time
            )
            db.add(submission)
            await db.flush()
            
            # Add ExamResult (CTT scores)
            tho_toan = safe_float(row[2]) or 0
            tho_tdkh = safe_float(row[3]) or 0
            
            # Extract responses if available
            resp_row = resp_df[resp_df['STT'] == float(stt)]
            item_scores = {}
            for i in range(1, 121):
                col_name = f"Cau{i}"
                if not resp_row.empty and col_name in resp_row.columns:
                    val = resp_row.iloc[0][col_name]
                    if pd.isna(val):
                        item_scores[str(i)] = -1
                    else:
                        item_scores[str(i)] = int(val)
                else:
                    item_scores[str(i)] = -1
                    
            exam_result = ExamResult(
                exam_submission_id=submission.id,
                ctt_score_part1=tho_toan,
                ctt_score_part2=tho_tdkh,
                raw_total_score=tho_toan + tho_tdkh,
                item_scores=item_scores,
                score_method="CTT"
            )
            db.add(exam_result)
            participants_count += 1
            
            if participants_count % 50 == 0:
                print(f"Inserted {participants_count} participants...")
                
        # 3. Mark exam as COMPLETED to trigger IRT
        exam.status = ExamStatus.COMPLETED
        await db.commit()
        
        print(f"Finished inserting {participants_count} participants. Triggering Celery Task...")
        task = run_irt_calibration_task.delay(exam.id)
        irt_task = IrtTask(exam_id=exam.id, celery_task_id=task.id, status="PENDING")
        db.add(irt_task)
        await db.commit()
        
        print(f"Task triggered! Task ID: {task.id}")

if __name__ == "__main__":
    asyncio.run(seed_demo())
