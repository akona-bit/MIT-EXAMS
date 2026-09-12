import random
from typing import List
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.exam import Exam, ExamParticipant, ExamForm, ExamFormQuestion, ExamFormAnswer, ExamStatus, ParticipantStatus
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

async def _generate_unique_sbd(db: AsyncSession) -> str:
    while True:
        sbd = f"{random.randint(1, 999999):06d}"
        res = await db.execute(select(ExamParticipant).where(ExamParticipant.sbd == sbd))
        if not res.scalars().first():
            return sbd

async def assign_participants(db: AsyncSession, exam_id: int, user_ids: List[int]) -> List[ExamParticipant]:
    participants = []
    for user_id in set(user_ids):
        # Check if already exists
        result = await db.execute(select(ExamParticipant).where(
            ExamParticipant.exam_id == exam_id,
            ExamParticipant.user_id == user_id
        ))
        if not result.scalars().first():
            sbd = await _generate_unique_sbd(db)
            p = ExamParticipant(
                exam_id=exam_id,
                user_id=user_id,
                sbd=sbd,
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
        # Self-enrollment: học sinh bấm "Bắt đầu thi" từ trang chủ có thể tự
        # ghi danh vào kỳ thi đã PUBLISHED mà không cần Admin gán trước.
        exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
        exam = exam_result.scalars().first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        if exam.status != ExamStatus.PUBLISHED:
            raise HTTPException(status_code=403, detail="Not a participant of this exam")

        sbd = await _generate_unique_sbd(db)
        participant = ExamParticipant(
            exam_id=exam_id,
            user_id=user_id,
            sbd=sbd,
            status=ParticipantStatus.NOT_STARTED
        )
        db.add(participant)
        await db.flush()

    if participant.exam_form_id:
        if participant.status == ParticipantStatus.NOT_STARTED:
            participant.status = ParticipantStatus.IN_PROGRESS
            participant.start_time = datetime.now(timezone.utc)
            await db.commit()
            
        result = await db.execute(select(ExamForm).options(
            selectinload(ExamForm.questions)
        ).where(ExamForm.id == participant.exam_form_id))
        return result.scalars().first()
        
    # Assign new form (excluding original if shuffled ones exist)
    result = await db.execute(select(ExamForm).where(
        ExamForm.exam_id == exam_id,
        ExamForm.is_original == False
    ))
    forms = result.scalars().all()
    
    if not forms:
        # Fallback to original form if no shuffled forms were generated
        result = await db.execute(select(ExamForm).where(
            ExamForm.exam_id == exam_id
        ))
        forms = result.scalars().all()
        
    if not forms:
        raise HTTPException(status_code=500, detail="No forms available for this exam")
        
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
from app.models.question import Question
from app.schemas.exam_session import AutosaveRequest, TrackingEventRequest

async def get_exam_session_info(db: AsyncSession, exam_id: int, user_id: int):
    stmt = select(ExamParticipant).options(
        selectinload(ExamParticipant.exam),
        selectinload(ExamParticipant.submission).selectinload(ExamSubmission.answers),
        selectinload(ExamParticipant.exam_form)
        .selectinload(ExamForm.questions)
        .selectinload(ExamFormQuestion.question_ref)
        .selectinload(Question.sub_items),
        selectinload(ExamParticipant.exam_form)
        .selectinload(ExamForm.questions)
        .selectinload(ExamFormQuestion.answers)
        .selectinload(ExamFormAnswer.answer_ref)
    ).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    )
    result = await db.execute(stmt)
    participant = result.scalars().first()
    
    if not participant:
        # Self-enrollment: học sinh vào thẳng phòng thi mà chưa được ghi danh —
        # tạo participant + gán mã đề (chỉ áp dụng cho kỳ thi đã PUBLISHED),
        # sau đó load lại session info với dữ liệu đầy đủ.
        await get_or_assign_exam_form(db, exam_id, user_id)
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
    elif exam.duration_minutes is None:
        remaining_seconds = None
    elif participant.start_time:
        # Nếu exam.end_time có giá trị, giới hạn thời gian nộp bài tại end_time
        end_time_limit = exam.end_time if exam.end_time else None
        
        elapsed = (now - participant.start_time.astimezone(timezone.utc)).total_seconds()
        remaining = (exam.duration_minutes * 60) - elapsed
        
        if end_time_limit:
            time_to_deadline = (end_time_limit.astimezone(timezone.utc) - now).total_seconds()
            remaining = min(remaining, time_to_deadline)
            
        remaining_seconds = max(0, int(remaining))
    else:
        remaining_seconds = exam.duration_minutes * 60
        
    saved_answers = []
    if participant.submission:
        for sa in participant.submission.answers:
            saved_answers.append({
                "exam_form_question_id": sa.exam_form_question_id,
                "selected_answer_id": sa.selected_answer_id,
                "selected_answer_ids": sa.selected_answer_ids,
                "selected_subitem_answers": sa.selected_subitem_answers,
                "text_answer": sa.text_answer,
            })
            
    questions = []
    if participant.exam_form:
        for fq in participant.exam_form.questions:
            q = fq.question_ref
            # Tách đáp án gốc (không thuộc ý con) và đáp án theo ý con,
            # giữ đúng vị trí đã xáo (new_position). KHÔNG gửi is_correct.
            direct_options = []
            subitem_options: dict[int, list] = {}
            for fa in sorted(fq.answers, key=lambda x: x.new_position):
                ans = fa.answer_ref
                if ans is None:
                    continue
                opt = {"id": ans.id, "content": ans.content, "position": fa.new_position}
                if ans.sub_item_id:
                    subitem_options.setdefault(ans.sub_item_id, []).append(opt)
                else:
                    direct_options.append(opt)
            sub_items = []
            for si in sorted(q.sub_items, key=lambda x: x.position):
                sub_items.append({
                    "id": si.id,
                    "label": si.label,
                    "prompt": si.prompt,
                    "kind": si.kind or "tf",
                    "options": subitem_options.get(si.id, []),
                })
            questions.append({
                "exam_form_question_id": fq.id,
                "question_id": q.id,
                "public_code": q.public_code,
                "content": q.content,
                "type": q.type.value,
                "part": fq.part,
                "position": fq.position,
                "passage_id": q.passage_id,
                "options": direct_options,
                "sub_items": sub_items
            })
            
    # Sort questions by position
    questions.sort(key=lambda x: x["position"])

    return {
        "exam_id": exam.id,
        "exam_name": exam.name,
        "form_code": participant.exam_form.code if participant.exam_form else "",
        "remaining_seconds": remaining_seconds,
        "exam_end_time": exam.end_time,
        "exam_pdf_url": exam.exam_pdf_url,
        "server_time": now,
        "participant_status": participant.status.value,
        "questions": questions,
        "saved_answers": saved_answers,
        "exam_mode": participant.exam_mode.value if participant.exam_mode else None,
        "exam_mode_changed": participant.exam_mode_changed,
        "sbd": participant.sbd
    }

async def autosave_answers(db: AsyncSession, exam_id: int, user_id: int, req: AutosaveRequest):
    result = await db.execute(select(ExamParticipant).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    ).with_for_update())
    participant = result.scalars().first()
    if not participant or participant.status != ParticipantStatus.IN_PROGRESS:
        raise HTTPException(status_code=403, detail="Session is not active (may be submitted or suspended)")
        
    if participant.is_banned:
        raise HTTPException(status_code=403, detail="You are banned from this exam")

    # Explicitly block suspended sessions (defensive - status != IN_PROGRESS already covers this in most cases)
    if participant.status == ParticipantStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="This exam session has been suspended")

    # Also block autosave if already submitted (defensive)
    if participant.status == ParticipantStatus.SUBMITTED:
        raise HTTPException(status_code=403, detail="You have already submitted this exam")
        
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
            existing_ans.selected_answer_ids = ans.selected_answer_ids
            existing_ans.selected_subitem_answers = ans.selected_subitem_answers
            existing_ans.text_answer = ans.text_answer
        else:
            new_ans = ExamSubmissionAnswer(
                exam_submission_id=submission.id,
                exam_form_question_id=ans.exam_form_question_id,
                selected_answer_id=ans.selected_answer_id,
                selected_answer_ids=ans.selected_answer_ids,
                selected_subitem_answers=ans.selected_subitem_answers,
                text_answer=ans.text_answer
            )
            db.add(new_ans)
        saved_count += 1
        
    await db.commit()
    return saved_count

async def submit_exam(db: AsyncSession, exam_id: int, user_id: int, bypass_verification: bool = False, omr_image_url: str = None):
    result = await db.execute(select(ExamParticipant).options(selectinload(ExamParticipant.user)).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    ).with_for_update())
    participant = result.scalars().first()
    if not participant or participant.status != ParticipantStatus.IN_PROGRESS:
        raise HTTPException(status_code=403, detail="Session is not active (may be submitted or suspended)")
        
    if participant.is_banned:
        raise HTTPException(status_code=403, detail="You are banned from this exam")
        
    if not bypass_verification:
        if not participant.user.verification_status or participant.user.verification_status == "UNVERIFIED":
            return {"status": "needs_verification"}
            
    participant.status = ParticipantStatus.SUBMITTED
    participant.submit_time = datetime.now(timezone.utc)
    
    submission_id = None
    if omr_image_url:
        result_sub = await db.execute(select(ExamSubmission).where(ExamSubmission.exam_participant_id == participant.id))
        submission = result_sub.scalars().first()
        if not submission:
            submission = ExamSubmission(exam_participant_id=participant.id)
            db.add(submission)
            await db.flush()
        submission.omr_image_url = omr_image_url
        submission_id = submission.id
    
    await db.commit()
    
    # Auto-dispatch OMR grading task if student submitted OMR image
    if submission_id and omr_image_url:
        try:
            from app.services.omr.tasks import grade_student_omr_task
            grade_student_omr_task.delay(submission_id, enable_gemini=True)
        except Exception:
            pass  # Best-effort: don't fail the submission if Celery is unavailable
    
    return {"status": "success"}

async def log_tracking_event(db: AsyncSession, exam_id: int, user_id: int, req: TrackingEventRequest):
    result = await db.execute(select(ExamParticipant).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    ).with_for_update())
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
    
    try:
        from app.main import manager
        import asyncio
        asyncio.create_task(manager.broadcast_online_users())
    except Exception:
        pass
        
    return True

async def suspend_exam_session(db: AsyncSession, exam_id: int, user_id: int, admin_user_id: int):
    result = await db.execute(select(ExamParticipant).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    ).with_for_update())
    participant = result.scalars().first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
        
    if participant.status == ParticipantStatus.SUSPENDED:
        raise HTTPException(status_code=400, detail="Participant session already suspended")

    if participant.status == ParticipantStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Cannot suspend a submitted session")
        
    participant.status = ParticipantStatus.SUSPENDED
    participant.suspended_at = datetime.now(timezone.utc)
    participant.suspended_by_id = admin_user_id
    
    await db.commit()
    
    try:
        from app.main import manager
        import asyncio
        asyncio.create_task(manager.broadcast_online_users())
    except Exception:
        pass
        
    return True

async def update_exam_mode(db: AsyncSession, exam_id: int, user_id: int, exam_mode: str):
    """Update exam mode for a participant. Only allowed once."""
    from app.models.exam import ExamMode
    
    result = await db.execute(select(ExamParticipant).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == user_id
    ).with_for_update())
    participant = result.scalars().first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    if participant.status == ParticipantStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Cannot change mode after submission")
    
    if participant.status == ParticipantStatus.SUSPENDED:
        raise HTTPException(status_code=400, detail="Cannot change mode on suspended session")
    
    # Check if already changed once
    if participant.exam_mode_changed and participant.exam_mode is not None:
        raise HTTPException(status_code=400, detail="You can only change exam mode once")
    
    # Validate mode
    try:
        mode = ExamMode(exam_mode)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam mode. Must be ONLINE or PAPER")
    
    # If first time setting mode
    if participant.exam_mode is None:
        participant.exam_mode = mode
    else:
        # Second time: allow change but mark as changed
        participant.exam_mode = mode
        participant.exam_mode_changed = True
    
    await db.commit()
    await db.refresh(participant)
    
    return {
        "success": True,
        "exam_mode": participant.exam_mode.value,
        "exam_mode_changed": participant.exam_mode_changed,
        "message": "Exam mode updated successfully"
    }
