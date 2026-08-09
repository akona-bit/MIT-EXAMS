import random
from typing import List
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.exam import Exam, ExamParticipant, ExamForm, ExamStatus, ParticipantStatus
from app.schemas.exam import ExamPublishRequest

async def publish_exam(db: AsyncSession, exam_id: int, config: ExamPublishRequest) -> Exam:
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalars().first()
    
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
        
    exam.start_time = config.start_time
    exam.end_time = config.end_time
    exam.duration_minutes = config.duration_minutes
    exam.show_score_mode = config.show_score_mode
    exam.show_answer_mode = config.show_answer_mode
    exam.status = ExamStatus.PUBLISHED
    
    await db.commit()
    await db.refresh(exam)
    return exam

async def assign_participants(db: AsyncSession, exam_id: int, user_ids: List[int]) -> List[ExamParticipant]:
    participants = []
    for user_id in set(user_ids):
        # Check if already exists
        result = await db.execute(select(ExamParticipant).where(
            ExamParticipant.exam_id == exam_id,
            ExamParticipant.user_id == user_id
        ))
        if not result.scalars().first():
            p = ExamParticipant(
                exam_id=exam_id,
                user_id=user_id,
                status=ParticipantStatus.NOT_STARTED
            )
            db.add(p)
            participants.append(p)
            
    await db.commit()
    return participants

async def get_or_assign_exam_form(db: AsyncSession, exam_id: int, user_id: int) -> ExamForm:
    # Get participant
    result = await db.execute(select(ExamParticipant).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    ))
    participant = result.scalars().first()
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant of this exam")
        
    if participant.exam_form_id:
        result = await db.execute(select(ExamForm).options(
            selectinload(ExamForm.questions)
        ).where(ExamForm.id == participant.exam_form_id))
        return result.scalars().first()
        
    # Assign new form (excluding original)
    result = await db.execute(select(ExamForm).where(
        ExamForm.exam_id == exam_id,
        ExamForm.is_original == False
    ))
    forms = result.scalars().all()
    
    if not forms:
        raise HTTPException(status_code=500, detail="No shuffled forms available for this exam")
        
    selected_form = random.choice(forms)
    participant.exam_form_id = selected_form.id
    participant.status = ParticipantStatus.IN_PROGRESS
    participant.start_time = datetime.now(timezone.utc)
    
    await db.commit()
    
    # Reload with questions
    result = await db.execute(select(ExamForm).options(
        selectinload(ExamForm.questions)
    ).where(ExamForm.id == selected_form.id))
    return result.scalars().first()

from app.models.exam import ExamSubmission, ExamSubmissionAnswer, ExamTrackingLog
from app.schemas.exam_session import AutosaveRequest, TrackingEventRequest

async def get_exam_session_info(db: AsyncSession, exam_id: int, user_id: int):
    stmt = select(ExamParticipant).options(
        selectinload(ExamParticipant.exam),
        selectinload(ExamParticipant.exam_form)
    ).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    )
    result = await db.execute(stmt)
    participant = result.scalars().first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")
        
    if participant.is_banned:
        raise HTTPException(status_code=403, detail="You are banned from this exam")
        
    exam = participant.exam
    if exam.status != ExamStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Exam is not published")
        
    now = datetime.now(timezone.utc)
    
    if participant.status == ParticipantStatus.SUBMITTED:
        remaining_seconds = 0
    elif participant.start_time:
        # Nếu exam.end_time có giá trị, giới hạn thời gian nộp bài tại end_time
        end_time_limit = exam.end_time if exam.end_time else None
        
        elapsed = (now - participant.start_time.replace(tzinfo=timezone.utc)).total_seconds()
        remaining = (exam.duration_minutes * 60) - elapsed
        
        if end_time_limit:
            time_to_deadline = (end_time_limit.replace(tzinfo=timezone.utc) - now).total_seconds()
            remaining = min(remaining, time_to_deadline)
            
        remaining_seconds = max(0, int(remaining))
    else:
        remaining_seconds = exam.duration_minutes * 60
        
    return {
        "exam_id": exam.id,
        "exam_name": exam.name,
        "form_code": participant.exam_form.code if participant.exam_form else "",
        "remaining_seconds": remaining_seconds,
        "server_time": now,
        "participant_status": participant.status.value
    }

async def autosave_answers(db: AsyncSession, exam_id: int, user_id: int, req: AutosaveRequest):
    result = await db.execute(select(ExamParticipant).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    ))
    participant = result.scalars().first()
    if not participant or participant.status == ParticipantStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Cannot save answers")
        
    if participant.is_banned:
        raise HTTPException(status_code=403, detail="You are banned from this exam")
        
    result = await db.execute(select(ExamSubmission).where(ExamSubmission.exam_participant_id == participant.id))
    submission = result.scalars().first()
    
    if not submission:
        submission = ExamSubmission(exam_participant_id=participant.id)
        db.add(submission)
        await db.flush()
        
    saved_count = 0
    for ans in req.answers:
        result = await db.execute(select(ExamSubmissionAnswer).where(
            ExamSubmissionAnswer.exam_submission_id == submission.id,
            ExamSubmissionAnswer.exam_form_question_id == ans.exam_form_question_id
        ))
        existing_ans = result.scalars().first()
        if existing_ans:
            existing_ans.selected_answer_id = ans.selected_answer_id
        else:
            new_ans = ExamSubmissionAnswer(
                exam_submission_id=submission.id,
                exam_form_question_id=ans.exam_form_question_id,
                selected_answer_id=ans.selected_answer_id
            )
            db.add(new_ans)
        saved_count += 1
        
    await db.commit()
    return saved_count

async def submit_exam(db: AsyncSession, exam_id: int, user_id: int):
    result = await db.execute(select(ExamParticipant).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    ))
    participant = result.scalars().first()
    if not participant or participant.status == ParticipantStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Cannot submit")
        
    if participant.is_banned:
        raise HTTPException(status_code=403, detail="You are banned from this exam")
        
    participant.status = ParticipantStatus.SUBMITTED
    participant.submit_time = datetime.now(timezone.utc)
    
    await db.commit()
    return True

async def log_tracking_event(db: AsyncSession, exam_id: int, user_id: int, req: TrackingEventRequest):
    result = await db.execute(select(ExamParticipant).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    ))
    participant = result.scalars().first()
    if not participant:
        raise HTTPException(status_code=400, detail="Invalid participant")
        
    if participant.is_banned:
        raise HTTPException(status_code=403, detail="You are banned from this exam")
        
    log = ExamTrackingLog(
        exam_participant_id=participant.id,
        action_type=req.action_type
    )
    db.add(log)
    await db.commit()
    return True
