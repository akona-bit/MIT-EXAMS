from typing import Any
import asyncio

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import AsyncSessionLocal
from app.models.exam import ExamForm, ExamFormQuestion, ExamSubmission, ExamParticipant
from app.models.grading import ExamResult, IrtTask
from app.models.question import Answer, Question

import numpy as np
import pandas as pd
from sqlalchemy import update
from app.services.grading.irt_engine import mmle, theta_estimate, true_score
from datetime import datetime, timezone

async def grade_submission_ctt(db: AsyncSession, submission_id: int) -> ExamResult | None:
    result = await db.execute(
        select(ExamSubmission)
        .options(
            selectinload(ExamSubmission.answers),
            selectinload(ExamSubmission.participant),
        )
        .where(ExamSubmission.id == submission_id)
    )
    submission = result.scalars().first()
    if not submission or not submission.participant:
        return None

    participant = submission.participant
    if not participant.exam_form_id:
        return None

    form_questions_result = await db.execute(
        select(ExamFormQuestion)
        .options(selectinload(ExamFormQuestion.answers))
        .where(ExamFormQuestion.exam_form_id == participant.exam_form_id)
    )
    form_questions = form_questions_result.scalars().all()

    original_form_result = await db.execute(
        select(ExamForm.id).where(
            ExamForm.exam_id == participant.exam_id,
            ExamForm.is_original.is_(True),
        )
    )
    original_form_id = original_form_result.scalar_one_or_none()
    original_positions: dict[int, int] = {}
    if original_form_id:
        original_questions_result = await db.execute(
            select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == original_form_id)
        )
        original_positions = {
            question.question_id: question.position
            for question in original_questions_result.scalars().all()
        }

    selected_by_form_question = {
        answer.exam_form_question_id: answer.selected_answer_id
        for answer in submission.answers
    }
    selected_ids = [value for value in selected_by_form_question.values() if value]
    answer_lookup: dict[int, Answer] = {}
    if selected_ids:
        answers_result = await db.execute(select(Answer).where(Answer.id.in_(selected_ids)))
        answer_lookup = {answer.id: answer for answer in answers_result.scalars().all()}

    item_scores: dict[str, int] = {str(position): -1 for position in range(1, 121)}
    part_scores = {1: 0, 2: 0, 3: 0, 4: 0}
    for form_question in form_questions:
        original_position = original_positions.get(form_question.question_id, form_question.position)
        if not 1 <= original_position <= 120:
            continue

        selected_id = selected_by_form_question.get(form_question.id)
        if not selected_id:
            score = -1
        else:
            score = 1 if answer_lookup.get(selected_id, None) and answer_lookup[selected_id].is_correct else 0

        item_scores[str(original_position)] = score
        if score == 1 and form_question.part in part_scores:
            part_scores[form_question.part] += 1

    result_query = await db.execute(
        select(ExamResult).where(ExamResult.exam_submission_id == submission_id)
    )
    exam_result = result_query.scalars().first()
    if not exam_result:
        exam_result = ExamResult(exam_submission_id=submission_id)
        db.add(exam_result)

    exam_result.ctt_score_part1 = part_scores[1]
    exam_result.ctt_score_part2 = part_scores[2]
    exam_result.ctt_score_part3 = part_scores[3]
    exam_result.ctt_score_part4 = part_scores[4]
    exam_result.raw_total_score = sum(part_scores.values())
    exam_result.item_scores = item_scores
    exam_result.score_method = "CTT"

    await db.commit()
    await db.refresh(exam_result)
    return exam_result


@shared_task(bind=True)
def run_irt_calibration_task(self: Any, exam_id: int) -> dict[str, Any]:
    async def process_irt() -> dict[str, Any]:
        async with AsyncSessionLocal() as db:
            # 1. Mark as started
            result = await db.execute(
                select(IrtTask).where(IrtTask.celery_task_id == self.request.id)
            )
            task = result.scalars().first()
            if task:
                task.status = "STARTED"
                await db.commit()
            
            # 2. Get original form
            original_form_result = await db.execute(
                select(ExamForm.id).where(
                    ExamForm.exam_id == exam_id,
                    ExamForm.is_original.is_(True),
                )
            )
            original_form_id = original_form_result.scalar_one_or_none()
            if not original_form_id:
                if task:
                    task.status = "FAILED"
                    await db.commit()
                return {"status": "FAILED", "reason": "No original form found"}
            
            # Get original form questions to map position -> question_id
            form_q_result = await db.execute(
                select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == original_form_id)
            )
            form_questions = form_q_result.scalars().all()
            position_to_qid = {q.position: q.question_id for q in form_questions}
            
            # 3. Get all submissions and their results for this exam
            sub_res = await db.execute(
                select(ExamResult, ExamSubmission)
                .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
                .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
                .where(ExamParticipant.exam_id == exam_id)
            )
            records = sub_res.all()
            if not records:
                if task:
                    task.status = "SUCCESS" # No data to run
                    await db.commit()
                return {"status": "SUCCESS", "message": "No submissions found"}
                
            N = len(records)
            J = 120
            
            # 4. Build response matrix U
            U = np.full((N, J), -1, dtype=int)
            for i, (exam_result, submission) in enumerate(records):
                item_scores = exam_result.item_scores or {}
                for pos_str, score in item_scores.items():
                    try:
                        pos = int(pos_str)
                        if 1 <= pos <= J:
                            U[i, pos - 1] = int(score) if score != -1 else -1
                    except ValueError:
                        pass
            
            # 5. Run MMLE to get a, b parameters
            try:
                # K=41 to speed up, max_iter=30
                a_est, b_est = mmle(U, name=f"IRT_Exam_{exam_id}", max_iter=30, K=41, verbose=False)
            except Exception as e:
                if task:
                    task.status = "FAILED"
                    await db.commit()
                return {"status": "FAILED", "reason": f"MMLE failed: {str(e)}"}
            
            # 6. Update Question parameters in DB
            item_params_list = []
            for j in range(J):
                pos = j + 1
                qid = position_to_qid.get(pos)
                a_val, b_val = float(a_est[j]), float(b_est[j])
                item_params_list.append((a_val, b_val))
                if qid:
                    await db.execute(
                        update(Question)
                        .where(Question.id == qid)
                        .values(a_param=a_val, b_param=b_val, is_calibrated=True)
                    )
            
            # 7. Estimate Theta for all students
            # Prepare clean responses for theta estimation (replace -1 with 0)
            clean_responses = []
            for i in range(N):
                row = U[i, :].copy()
                row[row == -1] = 0
                clean_responses.append(row)
                
            try:
                theta_est = theta_estimate(clean_responses, item_params_list)
            except Exception as e:
                if task:
                    task.status = "FAILED"
                    await db.commit()
                return {"status": "FAILED", "reason": f"Theta estimation failed: {str(e)}"}
            
            # 8. Calculate true scores and update ExamResult
            cau_names = [f"Cau{i}" for i in range(1, J+1)]
            item_params_df = pd.DataFrame(item_params_list, columns=["a", "b"], index=cau_names)
            
            for i, (exam_result, submission) in enumerate(records):
                theta = float(theta_est[i])
                student_responses = clean_responses[i]
                student_data = pd.Series(student_responses, index=cau_names)
                
                # Split into 4 parts (30 items each)
                parts_scores = []
                for p in range(4):
                    start_idx = p * 30
                    end_idx = (p + 1) * 30
                    part_data = student_data.iloc[start_idx:end_idx]
                    part_params = item_params_df.iloc[start_idx:end_idx]
                    part_raw = int(part_data.sum())
                    
                    p_score = true_score(theta, part_raw, part_data, part_params)
                    parts_scores.append(p_score)
                    
                exam_result.irt_score_part1 = parts_scores[0]
                exam_result.irt_score_part2 = parts_scores[1]
                exam_result.irt_score_part3 = parts_scores[2]
                exam_result.irt_score_part4 = parts_scores[3]
                exam_result.total_score = sum(parts_scores)
                exam_result.score_method = "IRT"
                
                db.add(exam_result)
                
            # 9. Mark success
            if task:
                task.status = "SUCCESS"
                task.completed_at = datetime.now(timezone.utc)
            
            await db.commit()
            
            return {
                "status": "SUCCESS", 
                "exam_id": exam_id, 
                "participants_scored": N
            }

    # Run the async logic synchronously in Celery
    return asyncio.run(process_irt())
