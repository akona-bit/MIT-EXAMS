from typing import Any
import asyncio

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import AsyncSessionLocal
from app.models.exam import ExamForm, ExamFormQuestion, ExamSubmission
from app.models.grading import ExamResult, IrtTask
from app.models.question import Answer


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
    async def mark_started() -> None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(IrtTask).where(IrtTask.celery_task_id == self.request.id)
            )
            task = result.scalars().first()
            if task:
                task.status = "STARTED"
                await db.commit()

    asyncio.run(mark_started())
    return {"status": "PENDING_MMLE_INTEGRATION", "exam_id": exam_id}
