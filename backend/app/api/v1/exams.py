from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.exam import Exam, ExamStatus, Matrix, ExamForm, ExamParticipant
from app.schemas.exam import ExamResponse, GenerateExamRequest, ExamPublishRequest, ExamUpdateRequest, ExamParticipantCreate, ExamParticipantResponse
from app.schemas.exam_session import AutosaveRequest, AutosaveResponse, TrackingEventRequest, TrackingEventResponse, ExamSessionInfoResponse, SubmitExamRequest
from app.api.dependencies import RequireRole, get_current_user
from app.models.user import User
from app.services.generator import generate_original_exam, generate_shuffled_forms
from app.services.exam_session import publish_exam, assign_participants, get_or_assign_exam_form, get_exam_session_info, autosave_answers, submit_exam, log_tracking_event, suspend_exam_session
from app.core.analytics import capture

router = APIRouter()


@router.get("/")
async def get_exams(skip: int = 0, limit: int = 100, status: str | None = None, db: AsyncSession = Depends(get_db)):
    filters = []
    if status:
        filters.append(Exam.status == status)

    total_result = await db.execute(select(func.count()).select_from(Exam).where(*filters))
    total = total_result.scalar_one()
    from app.models.exam import ExamSubmission, ExamParticipant
    subq = (
        select(ExamParticipant.exam_id, func.count(ExamSubmission.id).label("submission_count"))
        .join(ExamSubmission, ExamSubmission.exam_participant_id == ExamParticipant.id)
        .group_by(ExamParticipant.exam_id)
        .subquery()
    )

    stmt = (
        select(Exam, func.coalesce(subq.c.submission_count, 0).label("submission_count"))
        .outerjoin(subq, Exam.id == subq.c.exam_id)
        .where(*filters)
        .order_by(Exam.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    items = []
    for exam, count in rows:
        exam.submission_count = count
        items.append(ExamResponse.model_validate(exam))

    return {"items": items, "total": total, "page": (skip // limit) + 1 if limit else 1, "size": limit}


@router.get("/my-history", dependencies=[Depends(RequireRole(["STUDENT"]))])
async def get_my_history(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.exam import ExamSubmission, ExamParticipant
    from app.models.grading import ExamResult

    stmt = (
        select(ExamParticipant, Exam, ExamSubmission, ExamResult)
        .join(Exam, Exam.id == ExamParticipant.exam_id)
        .outerjoin(ExamSubmission, ExamSubmission.exam_participant_id == ExamParticipant.id)
        .outerjoin(ExamResult, ExamResult.exam_submission_id == ExamSubmission.id)
        .where(ExamParticipant.user_id == current_user.id)
        .where(ExamParticipant.status.in_(["SUBMITTED", "IN_PROGRESS"]))
        .order_by(Exam.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    history = []
    for participant, exam, submission, exam_result in rows:
        score = None
        max_score = 1200
        if exam_result and exam_result.total_score is not None:
            score = exam_result.total_score
            max_score = 1200
        elif exam_result:
            score = (exam_result.ctt_score_part1 or 0) + (exam_result.ctt_score_part2 or 0) + (exam_result.ctt_score_part3 or 0) + (exam_result.ctt_score_part4 or 0)
            max_score = 1200
        else:
            score = None
            max_score = 1200

        history.append({
            "id": exam.id,
            "name": exam.name,
            "date": (participant.submit_time or exam.created_at).isoformat() if participant.submit_time else exam.created_at.isoformat(),
            "score": score,
            "max_score": max_score,
            "time_spent": round((participant.submit_time - participant.start_time).total_seconds() / 60) if participant.submit_time and participant.start_time else 0,
            "status": participant.status.value if participant.status else "NOT_STARTED",
        })

    return {"items": history}


@router.post("/generate", response_model=ExamResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def generate_exam(request: Request, req: GenerateExamRequest, db: AsyncSession = Depends(get_db)):
    # 1. Lấy Ma trận
    result = await db.execute(select(Matrix).options(selectinload(Matrix.rules)).where(Matrix.id == req.matrix_id))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")
        
    # 2. Sinh đề gốc
    exam = await generate_original_exam(db, matrix, req.exam_name, req.exam_description or "")
    
    # 3. Lấy đề gốc vừa tạo
    result = await db.execute(select(ExamForm).where(ExamForm.exam_id == exam.id, ExamForm.is_original == True))
    original_form = result.scalars().first()
    
    # 4. Sinh các mã đề xáo trộn
    if req.number_of_forms > 0:
        await generate_shuffled_forms(db, original_form, req.number_of_forms)
        
    # Tải lại exam để trả về đúng format
    result = await db.execute(select(Exam).where(Exam.id == exam.id))
    generated_exam = result.scalars().first()
    capture(
        request,
        "exam_generated",
        {"exam_id": exam.id, "requested_form_count": req.number_of_forms},
    )
    return generated_exam


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@router.put("/{exam_id}", response_model=ExamResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def update_exam(request: Request, exam_id: int, exam_in: ExamUpdateRequest, db: AsyncSession = Depends(get_db)):
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.status == ExamStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Không thể chỉnh sửa exam đã hoàn thành")
    if exam_in.name is not None:
        exam.name = exam_in.name
    if exam_in.description is not None:
        exam.description = exam_in.description
    if exam_in.duration_minutes is not None:
        exam.duration_minutes = exam_in.duration_minutes
    if exam_in.show_score_mode is not None:
        exam.show_score_mode = exam_in.show_score_mode
    if exam_in.show_answer_mode is not None:
        exam.show_answer_mode = exam_in.show_answer_mode
    if exam_in.allow_omr is not None:
        exam.allow_omr = exam_in.allow_omr
    await db.commit()
    await db.refresh(exam)
    capture(request, "exam_updated", {"exam_id": exam_id})
    return exam


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(RequireRole(["ADMIN"]))])
async def delete_exam(request: Request, exam_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import delete as sa_delete
    from app.models.exam import ExamFormQuestion, ExamParticipant as ExamParticipantModel
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.status == ExamStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Không thể xóa exam đã phát hành")
    # Delete related data
    form_ids = [f.id for f in (await db.execute(select(ExamForm).where(ExamForm.exam_id == exam_id))).scalars().all()]
    if form_ids:
        await db.execute(sa_delete(ExamFormQuestion).where(ExamFormQuestion.exam_form_id.in_(form_ids)))
    await db.execute(sa_delete(ExamForm).where(ExamForm.exam_id == exam_id))
    await db.execute(sa_delete(ExamParticipantModel).where(ExamParticipantModel.exam_id == exam_id))
    await db.delete(exam)
    await db.commit()
    capture(request, "exam_deleted", {"exam_id": exam_id})
    return None


@router.post("/{exam_id}/generate", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def generate_forms_for_exam(exam_id: int, form_count: int = 4, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExamForm).where(
        ExamForm.exam_id == exam_id,
        ExamForm.is_original == True
    ))
    original_form = result.scalars().first()
    if not original_form:
        raise HTTPException(status_code=404, detail="Original exam form not found")

    await generate_shuffled_forms(db, original_form, form_count)
    forms_result = await db.execute(select(ExamForm).where(ExamForm.exam_id == exam_id))
    return forms_result.scalars().all()

@router.get("/{exam_id}/forms", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def get_exam_forms(exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExamForm).where(ExamForm.exam_id == exam_id))
    forms = result.scalars().all()
    return [{"id": f.id, "code": f.code, "is_original": f.is_original, "created_at": f.created_at} for f in forms]


@router.put("/{exam_id}/publish", response_model=ExamResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def publish_exam_route(request: Request, exam_id: int, db: AsyncSession = Depends(get_db)):
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam.status = ExamStatus.PUBLISHED
    await db.commit()
    await db.refresh(exam)
    capture(request, "exam_published", {"exam_id": exam_id})
    return exam

@router.put("/{exam_id}/complete", response_model=ExamResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def complete_exam(request: Request, exam_id: int, db: AsyncSession = Depends(get_db)):
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam.status = ExamStatus.COMPLETED
    await db.commit()
    await db.refresh(exam)
    
    # Count submissions for IRT threshold check
    from app.models.exam import ExamSubmission, ExamParticipant
    sub_count_result = await db.execute(
        select(func.count()).select_from(ExamSubmission)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamParticipant.exam_id == exam_id)
    )
    submission_count = sub_count_result.scalar() or 0
    
    IRT_THRESHOLD = 200
    
    # Trigger grading + IRT calibration background task
    from app.services.grading.scorer import run_irt_calibration_task
    from app.models.grading import IrtTask
    
    if submission_count >= IRT_THRESHOLD:
        # Enough data — run full IRT calibration
        task = run_irt_calibration_task.delay(exam_id)
        irt_task = IrtTask(exam_id=exam_id, celery_task_id=task.id, status="PENDING")
        db.add(irt_task)
        await db.commit()
    else:
        # Below threshold — CTT only, skip IRT
        import logging
        logging.info(f"Exam {exam_id}: {submission_count} submissions < {IRT_THRESHOLD} threshold, IRT skipped (CTT only)")
    
    capture(request, "exam_completed", {"exam_id": exam_id, "submission_count": submission_count, "irt_ran": submission_count >= IRT_THRESHOLD})
    return exam

@router.post("/{exam_id}/publish", response_model=ExamResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def publish_exam_with_defaults(request: Request, exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    start_time = datetime.now(timezone.utc)
    config = ExamPublishRequest(
        start_time=start_time,
        end_time=start_time + timedelta(minutes=exam.duration_minutes),
        duration_minutes=exam.duration_minutes,
        show_score_mode=exam.show_score_mode,
        show_answer_mode=exam.show_answer_mode,
    )
    published_exam = await publish_exam(db, exam_id, config)
    capture(request, "exam_published", {"exam_id": exam_id, "publish_mode": "default"})
    return published_exam

@router.put("/{exam_id}/config-publish", response_model=ExamResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def config_and_publish_exam(request: Request, exam_id: int, config: ExamPublishRequest, db: AsyncSession = Depends(get_db)):
    published_exam = await publish_exam(db, exam_id, config)
    capture(request, "exam_published", {"exam_id": exam_id, "publish_mode": "configured"})
    return published_exam

@router.post("/{exam_id}/participants", response_model=List[ExamParticipantResponse], dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def add_participants(request: Request, exam_id: int, req: ExamParticipantCreate, db: AsyncSession = Depends(get_db)):
    participants = await assign_participants(db, exam_id, req.user_ids)
    capture(request, "exam_participants_assigned", {"exam_id": exam_id, "participant_count": len(req.user_ids)})
    return participants


@router.post("/{exam_id}/assign", response_model=List[ExamParticipantResponse], dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def assign_participants_compat(request: Request, exam_id: int, user_ids: List[int], db: AsyncSession = Depends(get_db)):
    participants = await assign_participants(db, exam_id, user_ids)
    capture(request, "exam_participants_assigned", {"exam_id": exam_id, "participant_count": len(user_ids)})
    return participants

@router.post("/{exam_id}/start", dependencies=[Depends(RequireRole(["STUDENT"]))])
async def start_exam(request: Request, exam_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    form = await get_or_assign_exam_form(db, exam_id, current_user.id)
    capture(request, "exam_started", {"exam_id": exam_id, "form_code": form.code})
    return {"message": "Exam started", "form_code": form.code, "form_id": form.id}

from app.core.supabase_client import supabase_client
from app.core.security import generate_complex_password, get_password_hash

@router.post("/{exam_id}/credentials", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def generate_credentials(exam_id: int, db: AsyncSession = Depends(get_db)):
    """
    Ensure all participants have an SBD.
    For participants using default passwords (or without passwords), generate new complex password.
    Return the list of participants with SBD and generated clear-text passwords (if newly generated),
    so Admin can export them.
    """
    result = await db.execute(
        select(ExamParticipant)
        .options(selectinload(ExamParticipant.user))
        .where(ExamParticipant.exam_id == exam_id)
    )
    participants = result.scalars().all()
    
    from app.services.exam_session import _generate_unique_sbd
    
    export_data = []
    
    for p in participants:
        user = p.user
        
        # 1. Ensure SBD exists
        if not p.sbd:
            p.sbd = await _generate_unique_sbd(db)
            
        # 2. Check if password needs to be generated
        # Assume 'student123' is default password. If hashed_password is None, also generate.
        needs_password = False
        if not user.hashed_password:
            needs_password = True
        else:
            from app.core.security import verify_password
            if verify_password("student123", user.hashed_password):
                needs_password = True
                
        new_password = None
        if needs_password:
            new_password = generate_complex_password(8)
            user.hashed_password = get_password_hash(new_password)
            
            # Update Supabase if user exists there
            if user.supabase_id:
                try:
                    supabase_client.auth.admin.update_user_by_id(
                        user.supabase_id,
                        attributes={"password": new_password}
                    )
                except Exception as e:
                    print(f"Failed to update Supabase password for {user.email}: {e}")
                    
        export_data.append({
            "full_name": user.full_name,
            "email": user.email,
            "sbd": p.sbd,
            "password": new_password or "Dùng mật khẩu cá nhân"
        })
        
    await db.commit()
    
    return export_data

@router.get("/{exam_id}/session", dependencies=[Depends(RequireRole(["STUDENT"]))])
async def get_session(exam_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    import traceback
    try:
        result = await get_exam_session_info(db, exam_id, current_user.id)
        # Manually validate against schema to get detailed error
        try:
            ExamSessionInfoResponse(**result)
        except Exception as val_err:
            logger.error(f"Schema validation error: {val_err}")
            # Return raw dict without validation
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session endpoint error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{exam_id}/autosave", response_model=AutosaveResponse, dependencies=[Depends(RequireRole(["STUDENT"]))])
async def autosave(exam_id: int, req: AutosaveRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    saved_count = await autosave_answers(db, exam_id, current_user.id, req)
    from datetime import datetime, timezone
    return {"success": True, "saved_count": saved_count, "timestamp": datetime.now(timezone.utc)}

@router.post("/{exam_id}/submit", dependencies=[Depends(RequireRole(["STUDENT"]))])
@limiter.limit("5/minute")
async def submit(request: Request, exam_id: int, req: SubmitExamRequest = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    omr_url = req.omr_image_url if req else None
    res = await submit_exam(db, exam_id, current_user.id, omr_image_url=omr_url)
    if res.get("status") == "needs_verification":
        return {"status": "needs_verification", "message": "Bạn cần chứng thực học sinh trước khi nộp bài."}
        
    capture(request, "exam_submitted", {"exam_id": exam_id, "omr": bool(omr_url)})
    return {"status": "success", "message": "Exam submitted successfully"}

@router.post("/{exam_id}/finalize-submission", dependencies=[Depends(RequireRole(["STUDENT"]))])
@limiter.limit("5/minute")
async def finalize_submission(request: Request, exam_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # User calls this after uploading their verification. We bypass the check to enforce submission.
    res = await submit_exam(db, exam_id, current_user.id, bypass_verification=True)
    capture(request, "exam_submitted", {"exam_id": exam_id, "finalized_after_verification": True})
    return {"status": "success", "message": "Exam submitted successfully"}

@router.post("/{exam_id}/track", response_model=TrackingEventResponse, dependencies=[Depends(RequireRole(["STUDENT"]))])
async def track_event(exam_id: int, req: TrackingEventRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await log_tracking_event(db, exam_id, current_user.id, req)
    from datetime import datetime, timezone
    return {"success": True, "timestamp": datetime.now(timezone.utc)}

@router.post("/{exam_id}/suspend", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def suspend(request: Request, exam_id: int, user_id: int = Query(..., description="The user_id of the participant to suspend"), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await suspend_exam_session(db, exam_id, user_id, current_user.id)
    capture(request, "exam_suspended", {"exam_id": exam_id, "suspended_user_id": user_id})
    return {"message": "Exam session suspended successfully"}


@router.get("/{exam_id}/result", dependencies=[Depends(RequireRole(["STUDENT"]))])
async def get_student_exam_result_route(exam_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Student views their own exam result after submission.

    Business rules enforced in app/services/exam_result.py:
    - Chặn khi đang thi (IN_PROGRESS) hoặc chưa bắt đầu (NOT_STARTED).
    - Điểm thô (CTT) luôn có ngay sau khi nộp bài.
    - Điểm thực (IRT) chỉ hiển thị khi đủ ngưỡng N và đã tính xong.
    - Xem lại đáp án theo permission "Quyền xem đáp án" (user.can_view_answers).
    """
    from app.services.exam_result import get_student_exam_result

    return await get_student_exam_result(db, exam_id, current_user.id, current_user)
@router.get("/{exam_id}/export/latex", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def export_exam_latex(exam_id: int, form_code: str | None = None, db: AsyncSession = Depends(get_db)):
    from app.services.latex_service import LatexService
    from fastapi.responses import Response
    try:
        zip_bytes = await LatexService.generate_latex_zip(db, exam_id, form_code)
        
        # Determine filename
        filename = f"Exam_{exam_id}"
        if form_code:
            filename += f"_Form_{form_code}"
        filename += ".zip"
            
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{exam_id}/leaderboard", dependencies=[Depends(RequireRole(["STUDENT"]))])
async def get_student_leaderboard(exam_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.exam import ExamParticipant, ExamSubmission
    from app.models.grading import ExamResult
    
    # 1. Get current student's participant record to find assigned_form_id
    stmt = select(ExamParticipant).where(
        ExamParticipant.exam_id == exam_id,
        ExamParticipant.user_id == current_user.id
    )
    result = await db.execute(stmt)
    participant = result.scalars().first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Chưa tham gia kỳ thi này")
        
    form_id = participant.assigned_form_id
    if not form_id:
        raise HTTPException(status_code=400, detail="Chưa được gán mã đề")
        
    # 2. Query all participants who took the same form_id and have submitted
    stmt_lb = (
        select(ExamResult, User)
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .join(User, User.id == ExamParticipant.user_id)
        .where(
            ExamParticipant.exam_id == exam_id,
            ExamParticipant.assigned_form_id == form_id,
            ExamParticipant.status == "SUBMITTED"
        )
    )
    res_lb = await db.execute(stmt_lb)
    records = res_lb.all()
    
    if not records:
        return {"status": "no_data"}
        
    # 3. Sort by total_score (IRT) or raw_total_score if IRT not available
    students = []
    for r, u in records:
        # User total score: use total_score if available (IRT), else fallback to CTT parts
        if r.total_score is not None:
            score = r.total_score
        else:
            score = (r.ctt_score_part1 or 0) + (r.ctt_score_part2 or 0) + (r.ctt_score_part3 or 0) + (r.ctt_score_part4 or 0)
            
        students.append({
            "user_id": u.id,
            "name": u.full_name or u.username,
            "score": round(score, 2),
            "submit_time": r.created_at.isoformat() if r.created_at else None
        })
        
    # Sort by score descending
    students.sort(key=lambda x: x["score"], reverse=True)
    
    # Calculate rank for current_user
    current_user_rank = -1
    for i, s in enumerate(students):
        if s["user_id"] == current_user.id:
            current_user_rank = i + 1
            break
            
    # Return top 10
    top_10 = students[:10]
    for i, s in enumerate(top_10):
        s["rank"] = i + 1
        
    return {
        "status": "success",
        "top_10": top_10,
        "current_user_rank": current_user_rank,
        "total_participants_in_form": len(students)
    }
