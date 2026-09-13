import os, sys, asyncio
sys.path.append(os.getcwd())
from app.db.database import async_session_maker
from sqlalchemy import select, text, delete
from sqlalchemy.orm import selectinload
from app.models.exam import Matrix, Exam, ExamForm, ExamParticipant, ExamSubmission, ExamSubmissionAnswer, ParticipantStatus, ExamFormQuestion
from app.models.question import Answer, QuestionType, Question
from app.services.generator import generate_original_exam, generate_shuffled_forms
from app.services.grading.scorer import grade_submission_ctt
from datetime import datetime, timezone
import random

async def test_full_flow():
    async with async_session_maker() as session:
        # 1. Setup a simple matrix
        print("Finding matrix...")
        res = await session.execute(select(Matrix).limit(1))
        matrix = res.scalar_one_or_none()
        if not matrix:
            print("No matrix found! Can't use real generator without matrix rules.")
            return
            
        print("Generating original exam...")
        try:
            exam = await generate_original_exam(
                session, 
                matrix=matrix, 
                exam_name="Test Generator Exam", 
                exam_description="Testing"
            )
        except Exception as e:
            print(f"Generator failed: {e}")
            return
            
        print(f"Created Exam {exam.id}. Generating 2 shuffled forms...")
        res = await session.execute(
            select(ExamForm).where(ExamForm.exam_id == exam.id, ExamForm.is_original == True)
        )
        orig_form = res.scalar_one()
        await generate_shuffled_forms(session, orig_form, 2)
        
        # Get one shuffled form
        res = await session.execute(
            select(ExamForm).where(ExamForm.exam_id == exam.id, ExamForm.is_original == False)
        )
        shuffled_form = res.scalars().first()
        
        print(f"Using shuffled form {shuffled_form.id}")
        
        # Create a mock participant
        p = ExamParticipant(
            exam_id=exam.id,
            user_id=1, # Assume user 1 exists, usually admin
            exam_form_id=shuffled_form.id,
            status=ParticipantStatus.NOT_STARTED
        )
        session.add(p)
        await session.flush()
        
        # Load form questions
        res = await session.execute(
            select(ExamFormQuestion)
            .options(
                selectinload(ExamFormQuestion.answers),
                selectinload(ExamFormQuestion.question_ref).selectinload(Question.sub_items)
            )
            .where(ExamFormQuestion.exam_form_id == shuffled_form.id)
        )
        fqs = res.scalars().unique().all()
        
        # Create submission
        sub = ExamSubmission(
            exam_participant_id=p.id,
            submit_time=datetime.now(timezone.utc)
        )
        session.add(sub)
        await session.flush()
        
        print("Submitting correct answers...")
        for fq in fqs:
            q = fq.question_ref
            qtype = q.type
            
            # Load original answers for this question
            res = await session.execute(
                select(Answer).where(Answer.question_id == q.id)
            )
            orig_answers = res.scalars().all()
            
            if qtype == QuestionType.SINGLE_CHOICE:
                correct_id = next((a.id for a in orig_answers if a.is_correct and a.sub_item_id is None), None)
                ans = ExamSubmissionAnswer(
                    exam_submission_id=sub.id,
                    exam_form_question_id=fq.id,
                    selected_answer_id=correct_id
                )
                session.add(ans)
                
            elif qtype == QuestionType.TRUE_FALSE or qtype == QuestionType.COMPOSITE:
                subitems = q.sub_items
                sel_dict = {}
                for si in subitems:
                    correct_id = next((a.id for a in orig_answers if a.is_correct and a.sub_item_id == si.id), None)
                    if correct_id:
                        sel_dict[str(si.id)] = correct_id
                
                ans = ExamSubmissionAnswer(
                    exam_submission_id=sub.id,
                    exam_form_question_id=fq.id,
                    selected_subitem_answers=sel_dict
                )
                session.add(ans)
        
        p.status = ParticipantStatus.SUBMITTED
        sub_id = sub.id
        await session.commit()
        
    print("Grading...")
    async with async_session_maker() as session:
        res = await grade_submission_ctt(session, sub_id)
        print(f"Total points: {res.total_points}")
        print(f"Raw Total Score: {res.raw_total_score}")
        print(f"Item points: {res.item_points}")
        print(f"Item scores: {res.item_scores}")

asyncio.run(test_full_flow())
