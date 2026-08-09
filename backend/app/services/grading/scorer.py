from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from celery import shared_task
import asyncio

from app.models.exam import ExamSubmission, ExamFormQuestion, ExamParticipant
from app.models.question import Answer
from app.models.grading import ExamResult, IrtTask
from app.db.database import get_db

async def grade_submission_ctt(db: AsyncSession, submission_id: int):
    # 1. Load submission and answers
    result = await db.execute(
        select(ExamSubmission)
        .options(selectinload(ExamSubmission.answers))
        .where(ExamSubmission.id == submission_id)
    )
    submission = result.scalars().first()
    if not submission:
        return None
        
    # 2. Map questions
    scores = {1: 0, 2: 0, 3: 0, 4: 0}
    
    for ans in submission.answers:
        # Load question details
        q_result = await db.execute(
            select(ExamFormQuestion)
            .where(ExamFormQuestion.id == ans.exam_form_question_id)
        )
        form_question = q_result.scalars().first()
        if not form_question:
            continue
            
        part_idx = form_question.part_indicator
        
        if ans.selected_answer_id:
            ans_result = await db.execute(
                select(Answer).where(Answer.id == ans.selected_answer_id)
            )
            answer_obj = ans_result.scalars().first()
            if answer_obj and answer_obj.is_correct:
                scores[part_idx] += 1
                
    # 3. Save or Update Result
    r_result = await db.execute(select(ExamResult).where(ExamResult.exam_submission_id == submission_id))
    exam_result = r_result.scalars().first()
    if not exam_result:
        exam_result = ExamResult(exam_submission_id=submission_id)
        db.add(exam_result)
        
    exam_result.ctt_score_part1 = scores[1]
    exam_result.ctt_score_part2 = scores[2]
    exam_result.ctt_score_part3 = scores[3]
    exam_result.ctt_score_part4 = scores[4]
    
    await db.commit()
    await db.refresh(exam_result)
    return exam_result

@shared_task(bind=True)
def run_irt_calibration_task(self, exam_id: int):
    # In Celery worker, we can't use AsyncSession easily unless we run event loop
    # This is a placeholder for the heavy IRT task.
    # In a real scenario, we would:
    # 1. Read all submissions for this exam_id and build 1/0/-1 matrix
    # 2. import irt from app.services.grading.irt
    # 3. irt.mmle()
    # 4. update Question models with a_param, b_param
    # 5. update ExamResult with scaled scores
    print(f"Starting IRT Calibration for Exam ID: {exam_id}")
    import time
    time.sleep(5) # Fake work
    print(f"Finished IRT Calibration for Exam ID: {exam_id}")
    return {"status": "SUCCESS", "exam_id": exam_id}
