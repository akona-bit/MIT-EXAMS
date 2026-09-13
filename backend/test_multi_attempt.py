import os, sys, asyncio
sys.path.append(os.getcwd())
from app.db.database import async_session_maker
from sqlalchemy import select, delete
from app.models.exam import ExamParticipant, Exam, ExamStatus
from app.models.user import User
from app.services.exam_session import get_or_assign_exam_form

async def test_multi_attempt():
    async with async_session_maker() as session:
        # Find an exam that is published
        exam = (await session.execute(select(Exam).where(Exam.status == ExamStatus.PUBLISHED).limit(1))).scalars().first()
        if not exam:
            print("No published exam found")
            return
            
        # Ensure max attempts is set to 2
        exam.max_attempts = 2
        await session.commit()
        
        import random
        # Pick a random user id that likely doesn't have participants yet
        uid = random.randint(10000, 99999)
        user = User(id=uid, username=f"testuser_{uid}", email=f"test{uid}@test.com", hashed_password="hash", role_id=1)
        session.add(user)
        await session.flush()
        await session.commit()

        # --- ATTEMPT 1 ---
        print(f"Starting attempt 1 for user {user.id} on exam {exam.id}...")
        form1, p1 = await get_or_assign_exam_form(session, exam.id, user.id)
        print(f"Attempt 1 created. Participant ID: {p1.id}, Attempt Number: {p1.attempt_number}")
        
        # Mark attempt 1 as submitted
        p1.status = "SUBMITTED"
        await session.commit()
        
        # --- ATTEMPT 2 ---
        print(f"Starting attempt 2 for user {user.id} on exam {exam.id}...")
        form2, p2 = await get_or_assign_exam_form(session, exam.id, user.id)
        print(f"Attempt 2 created. Participant ID: {p2.id}, Attempt Number: {p2.attempt_number}")
        
        p2.status = "SUBMITTED"
        await session.commit()
        
        # --- ATTEMPT 3 ---
        print(f"Starting attempt 3 for user {user.id} on exam {exam.id}... (Should FAIL)")
        try:
            form3, p3 = await get_or_assign_exam_form(session, exam.id, user.id)
            print("Error: Attempt 3 succeeded when it should have failed!")
        except Exception as e:
            print(f"Success: Attempt 3 failed correctly with error: {e}")

asyncio.run(test_multi_attempt())
