from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import os
import uuid
import shutil
import json

from app.db.database import get_db
from app.api.dependencies import RequireRole, get_current_user
from app.core.analytics import capture
from app.core.supabase_client import supabase_client
from app.models.omr import OmrJob, OmrSheet, OmrJobStatus, OmrSheetStatus
from app.models.exam import Exam, ExamForm, ExamFormQuestion, ExamParticipant, ExamSubmission, ExamSubmissionAnswer, ParticipantStatus
from app.models.user import User
from app.services.omr.tasks import process_omr_sheet_task

router = APIRouter()

@router.post("/upload")
async def upload_omr_sheets(
    request: Request,
    exam_id: int, 
    files: List[UploadFile] = File(...), 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name not in ["ADMIN", "TEACHER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    job = OmrJob(
        exam_id=exam_id,
        uploader_id=current_user.id,
        total_files=len(files),
        status=OmrJobStatus.PROCESSING
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    for file in files:
        ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filename = f"{uuid.uuid4()}.{ext}"
        
        try:
            content = await file.read()
            supabase_client.storage.from_("omr-sheets").upload(
                file=content,
                path=filename,
                file_options={"content-type": file.content_type}
            )
            public_url = supabase_client.storage.from_("omr-sheets").get_public_url(filename)
        except Exception as e:
            import logging
            logging.error(f"Failed to upload OMR sheet: {e}")
            continue # Skip failed file
            
        sheet = OmrSheet(
            job_id=job.id,
            image_path=public_url,
            status=OmrSheetStatus.PENDING
        )
        db.add(sheet)
        await db.commit()
        await db.refresh(sheet)
        
        # Trigger Celery Task
        process_omr_sheet_task.delay(sheet.id)
        
    capture(request, "omr_upload_started", {"exam_id": exam_id, "job_id": job.id, "file_count": len(files)})
    return {"message": "Upload successful, processing started.", "job_id": job.id}

@router.get("/jobs/{job_id}")
async def get_omr_job(job_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OmrJob).where(OmrJob.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Also get all sheets for this job
    sheets_res = await db.execute(select(OmrSheet).where(OmrSheet.job_id == job_id))
    sheets = sheets_res.scalars().all()
    
    return {
        "job": job,
        "sheets": sheets
    }

@router.get("/sheets/{sheet_id}")
async def get_omr_sheet(sheet_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
    sheet = result.scalars().first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@router.post("/sheets/{sheet_id}/confirm")
async def confirm_omr_sheet(
    request: Request,
    sheet_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name not in ["ADMIN", "TEACHER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
    sheet = result.scalars().first()
    
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
        
    if sheet.status != OmrSheetStatus.NEEDS_REVIEW:
        raise HTTPException(status_code=400, detail="Sheet does not need review")
    
    if not sheet.student_id_raw or not sheet.form_code_raw:
        raise HTTPException(status_code=400, detail="Sheet chưa có student_id hoặc form_code")
    
    # 1. Find the exam from the job
    job_result = await db.execute(select(OmrJob).where(OmrJob.id == sheet.job_id))
    job = job_result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="OMR Job not found")
    
    # 2. Find the exam form by code
    form_result = await db.execute(
        select(ExamForm).where(ExamForm.exam_id == job.exam_id, ExamForm.code == sheet.form_code_raw)
    )
    exam_form = form_result.scalars().first()
    if not exam_form:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy mã đề '{sheet.form_code_raw}'")
    
    # 3. Find or create ExamParticipant
    # Try to find by user supabase_id or by student_id
    participant = None
    # First try to find by exam participant list
    participant_result = await db.execute(
        select(ExamParticipant).where(ExamParticipant.exam_id == job.exam_id)
    )
    all_participants = participant_result.scalars().all()
    
    # Try matching by user metadata or by student_id pattern
    for p in all_participants:
        user_res = await db.execute(select(User).where(User.id == p.user_id))
        user = user_res.scalars().first()
        if user and user.supabase_id == sheet.student_id_raw:
            participant = p
            break
    
    if not participant:
        # Create a temporary participant for OMR
        participant = ExamParticipant(
            exam_id=job.exam_id,
            user_id=current_user.id,  # fallback
            exam_form_id=exam_form.id,
            status=ParticipantStatus.COMPLETED
        )
        db.add(participant)
        await db.flush()
    
    # 4. Create ExamSubmission
    submission = ExamSubmission(exam_participant_id=participant.id)
    db.add(submission)
    await db.flush()
    
    # 5. Parse answers_raw and map to ExamFormQuestions
    answers_data = {}
    if sheet.answers_raw:
        try:
            answers_data = json.loads(sheet.answers_raw)
        except json.JSONDecodeError:
            pass
    
    # Get all questions for this form
    efq_result = await db.execute(
        select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == exam_form.id)
    )
    form_questions = {efq.position: efq for efq in efq_result.scalars().all()}
    
    # Map OMR answers to submission answers
    # answers_raw format: {"1": "A", "2": "B", ...} or {"1": 0, "2": 2, ...}
    ANSWER_MAP = {"A": 1, "B": 2, "C": 3, "D": 4, "a": 1, "b": 2, "c": 3, "d": 4}
    
    for pos_str, selected in answers_data.items():
        try:
            pos = int(pos_str)
        except (ValueError, TypeError):
            continue
        
        efq = form_questions.get(pos)
        if not efq:
            continue
        
        # Resolve selected_answer_id
        selected_answer_id = None
        if isinstance(selected, int):
            selected_answer_id = selected
        elif isinstance(selected, str) and selected.upper() in ["A", "B", "C", "D"]:
            letter = selected.upper()
            # Find the answer with matching position (A=0, B=1, C=2, D=3)
            ans_result = await db.execute(
                select(Answer.id, Answer.position).where(Answer.question_id == efq.question_id)
            )
            for ans_id, ans_pos in ans_result.all():
                if ans_pos == ord(letter) - ord("A"):
                    selected_answer_id = ans_id
                    break
        
        sub_answer = ExamSubmissionAnswer(
            exam_submission_id=submission.id,
            exam_form_question_id=efq.id,
            selected_answer_id=selected_answer_id,
        )
        db.add(sub_answer)
    
    # 6. Update sheet status
    sheet.status = OmrSheetStatus.COMPLETED
    sheet.exam_submission_id = submission.id
    
    # 7. Update participant status
    participant.status = ParticipantStatus.COMPLETED
    participant.exam_form_id = exam_form.id
    
    await db.commit()
    
    # 8. Grade the submission (CTT)
    try:
        from app.services.grading.scorer import grade_submission_ctt
        await grade_submission_ctt(db, submission.id)
    except Exception as e:
        import logging
        logging.warning(f"OMR grading failed for submission {submission.id}: {e}")
    
    capture(request, "omr_sheet_confirmed", {
        "sheet_id": sheet_id, 
        "job_id": sheet.job_id,
        "submission_id": submission.id,
        "student_id": sheet.student_id_raw,
        "form_code": sheet.form_code_raw,
    })
    return {"message": "Sheet confirmed and graded", "submission_id": submission.id}
