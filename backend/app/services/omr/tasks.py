"""
Celery tasks cho OMR processing.
Xử lý async qua queue, hỗ trợ batch hàng loạt phiếu.
"""

import asyncio
import json
import time
from typing import Dict, List, Optional

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import async_session_maker
from app.models.omr import OmrSheet, OmrSheetStatus, OmrJob, OmrJobStatus
from app.models.exam import (
    ExamForm, ExamFormQuestion, ExamFormAnswer,
    ExamParticipant, ExamSubmission, ExamSubmissionAnswer,
    ParticipantStatus,
)
from app.models.question import Answer
from app.models.user import User
from app.services.omr.hybrid_omr import HybridOMREngine, HybridOMRResult
from app.services.omr.layout_config import SheetLayout


async def _process_sheet_async(sheet_id: int, enable_gemini: bool = True):
    """Async handler cho việc xử lý 1 phiếu OMR."""
    async with async_session_maker() as db:
        # Load sheet
        result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
        sheet = result.scalars().first()
        if not sheet:
            return

        try:
            sheet.status = OmrSheetStatus.PROCESSING
            await db.commit()

            # Load layout (có thể custom per exam)
            layout = SheetLayout()  # TODO: load từ DB nếu có custom layout

            # Tạo engine
            engine = HybridOMREngine(
                layout=layout,
                enable_gemini=enable_gemini,
            )

            # Process
            omr_result = engine.process_file(sheet.image_path)
            result_dict = engine.to_dict(omr_result)

            # Update sheet
            sheet.student_id_raw = omr_result.sbd
            sheet.form_code_raw = omr_result.ma_de
            sheet.answers_raw = json.dumps(result_dict)
            sheet.confidence_score = _calculate_overall_confidence(omr_result)

            if omr_result.needs_review_count > 0:
                sheet.status = OmrSheetStatus.NEEDS_REVIEW
            else:
                sheet.status = OmrSheetStatus.COMPLETED

        except Exception as e:
            sheet.status = OmrSheetStatus.FAILED
            sheet.error_message = str(e)

        await db.commit()

        # Update job processed count
        job_result = await db.execute(select(OmrJob).where(OmrJob.id == sheet.job_id))
        job = job_result.scalars().first()
        if job:
            job.processed_files += 1
            if job.processed_files >= job.total_files:
                job.status = OmrJobStatus.COMPLETED
                job.completed_at = time.time()
            await db.commit()


def _calculate_overall_confidence(result: HybridOMRResult) -> float:
    """Tính điểm confidence tổng thể cho phiếu."""
    if not result.questions:
        return 0.0

    total_confidence = sum(q.get("confidence", 0) for q in result.questions)
    avg_confidence = total_confidence / len(result.questions)

    # Giảm confidence nếu có needs_review
    review_penalty = result.needs_review_count / len(result.questions) * 0.3
    return max(0.0, min(1.0, avg_confidence - review_penalty))


@shared_task(bind=True)
def process_omr_sheet_task(self, sheet_id: int, enable_gemini: bool = True):
    """
    Celery task xử lý 1 phiếu OMR.
    
    Args:
        sheet_id: ID của OmrSheet
        enable_gemini: Bật/tắt Gemini layer
    """
    asyncio.run(_process_sheet_async(sheet_id, enable_gemini))
    return {"status": "SUCCESS", "sheet_id": sheet_id}


@shared_task(bind=True)
def process_omr_batch_task(self, job_id: int, enable_gemini: bool = True):
    """
    Celery task xử lý batch nhiều phiếu OMR.
    """
    async def _process_batch():
        async with async_session_maker() as db:
            # Get all pending sheets for this job
            result = await db.execute(
                select(OmrSheet).where(
                    OmrSheet.job_id == job_id,
                    OmrSheet.status == OmrSheetStatus.PENDING,
                )
            )
            sheets = result.scalars().all()

            for sheet in sheets:
                try:
                    await _process_sheet_async(sheet.id, enable_gemini)
                except Exception as e:
                    print(f"Failed to process sheet {sheet.id}: {e}")

    asyncio.run(_process_batch())
    return {"status": "SUCCESS", "job_id": job_id}


async def _confirm_sheet_async(
    sheet_id: int,
    user_id: int,
    answers_override: Optional[Dict[int, str]] = None,
):
    """
    Async handler: xác nhận phiếu OMR sau review thủ công.
    Tạo ExamSubmission + ExamSubmissionAnswer.
    """
    async with async_session_maker() as db:
        # Load sheet
        result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
        sheet = result.scalars().first()
        if not sheet:
            raise ValueError(f"Sheet {sheet_id} not found")

        if sheet.status != OmrSheetStatus.NEEDS_REVIEW:
            raise ValueError(f"Sheet {sheet_id} is not in NEEDS_REVIEW status")

        # Parse answers từ OMR result
        omr_data = {}
        if sheet.answers_raw:
            try:
                omr_data = json.loads(sheet.answers_raw)
            except json.JSONDecodeError:
                pass

        questions = omr_data.get("questions", [])

        # Apply user overrides (nếu có)
        if answers_override:
            for q in questions:
                q_no = q["question_no"]
                if q_no in answers_override:
                    q["selected"] = answers_override[q_no]
                    q["needs_review"] = False
                    q["source"] = "manual"

        # Get exam from job
        job_result = await db.execute(select(OmrJob).where(OmrJob.id == sheet.job_id))
        job = job_result.scalars().first()
        if not job:
            raise ValueError("OMR Job not found")

        # Find exam form by code
        form_result = await db.execute(
            select(ExamForm).where(
                ExamForm.exam_id == job.exam_id,
                ExamForm.code == sheet.form_code_raw,
            )
        )
        exam_form = form_result.scalars().first()
        if not exam_form:
            raise ValueError(f"Không tìm thấy mã đề '{sheet.form_code_raw}'")

        # Find or create ExamParticipant
        participant = None
        participant_result = await db.execute(
            select(ExamParticipant).where(ExamParticipant.exam_id == job.exam_id)
        )
        all_participants = participant_result.scalars().all()

        for p in all_participants:
            if p.sbd == sheet.student_id_raw:
                participant = p
                break

        if not participant:
            participant = ExamParticipant(
                exam_id=job.exam_id,
                user_id=user_id,
                exam_form_id=exam_form.id,
                sbd=sheet.student_id_raw,
                status=ParticipantStatus.COMPLETED,
            )
            db.add(participant)
            await db.flush()

        # Create ExamSubmission
        submission = ExamSubmission(exam_participant_id=participant.id)
        db.add(submission)
        await db.flush()

        # Get form questions for mapping
        efq_result = await db.execute(
            select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == exam_form.id)
        )
        form_questions = {efq.position: efq for efq in efq_result.scalars().all()}

        # Get answer IDs for mapping letter → answer_id
        answer_map = {}  # {question_id: {letter: answer_id}}
        for fq in form_questions.values():
            ans_result = await db.execute(
                select(ExamFormAnswer, Answer)
                .join(Answer, Answer.id == ExamFormAnswer.answer_id)
                .where(ExamFormAnswer.exam_form_question_id == fq.id)
            )
            letter_to_id = {}
            for efa, ans in ans_result.all():
                letter = chr(ord("A") + efa.new_position - 1)
                letter_to_id[letter] = ans.id
            answer_map[fq.question_id] = letter_to_id

        # Map OMR answers → ExamSubmissionAnswer
        for q in questions:
            q_no = q.get("question_no")
            selected = q.get("selected")
            source = q.get("source", "opencv")

            if q_no is None or q_no not in form_questions:
                continue

            fq = form_questions[q_no]
            selected_answer_id = None

            if selected and selected.upper() in ("A", "B", "C", "D"):
                letter = selected.upper()
                letter_ids = answer_map.get(fq.question_id, {})
                selected_answer_id = letter_ids.get(letter)

            sub_answer = ExamSubmissionAnswer(
                exam_submission_id=submission.id,
                exam_form_question_id=fq.id,
                selected_answer_id=selected_answer_id,
                # TODO: thêm metadata source khi có column
            )
            db.add(sub_answer)

        # Update sheet status
        sheet.status = OmrSheetStatus.COMPLETED
        sheet.exam_submission_id = submission.id

        # Update participant
        participant.status = ParticipantStatus.COMPLETED
        participant.exam_form_id = exam_form.id

        await db.commit()
        await db.refresh(submission)

        # Grade the submission (CTT)
        try:
            from app.services.grading.scorer import grade_submission_ctt
            await grade_submission_ctt(db, submission.id)
        except Exception as e:
            import logging
            logging.warning(f"OMR grading failed for submission {submission.id}: {e}")

        return submission.id


@shared_task(bind=True)
def confirm_omr_sheet_task(
    self,
    sheet_id: int,
    user_id: int,
    answers_override: Optional[Dict[int, str]] = None,
):
    """
    Celery task xác nhận phiếu OMR sau review thủ công.
    """
    submission_id = asyncio.run(
        _confirm_sheet_async(sheet_id, user_id, answers_override)
    )
    return {"status": "SUCCESS", "sheet_id": sheet_id, "submission_id": submission_id}
