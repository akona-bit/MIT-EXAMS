from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.exam import Exam, Matrix, ExamForm, ExamParticipant
from app.schemas.exam import ExamResponse, GenerateExamRequest, ExamPublishRequest, ExamParticipantCreate, ExamParticipantResponse
from app.schemas.exam_session import AutosaveRequest, AutosaveResponse, TrackingEventRequest, TrackingEventResponse, ExamSessionInfoResponse
from app.api.dependencies import RequireRole, get_current_user
from app.models.user import User
from app.services.generator import generate_original_exam, generate_shuffled_forms
from app.services.exam_session import publish_exam, assign_participants, get_or_assign_exam_form, get_exam_session_info, autosave_answers, submit_exam, log_tracking_event

router = APIRouter()


@router.get("/")
async def get_exams(skip: int = 0, limit: int = 100, status: str | None = None, db: AsyncSession = Depends(get_db)):
    filters = []
    if status:
        filters.append(Exam.status == status)

    total_result = await db.execute(select(func.count()).select_from(Exam).where(*filters))
    total = total_result.scalar_one()
    result = await db.execute(
        select(Exam)
        .where(*filters)
        .order_by(Exam.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return {"items": result.scalars().all(), "total": total, "page": (skip // limit) + 1 if limit else 1, "size": limit}


@router.post("/generate", response_model=ExamResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def generate_exam(req: GenerateExamRequest, db: AsyncSession = Depends(get_db)):
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
    return result.scalars().first()


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


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


@router.post("/{exam_id}/publish", response_model=ExamResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def publish_exam_with_defaults(exam_id: int, db: AsyncSession = Depends(get_db)):
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
    return await publish_exam(db, exam_id, config)

@router.put("/{exam_id}/publish", response_model=ExamResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def config_and_publish_exam(exam_id: int, config: ExamPublishRequest, db: AsyncSession = Depends(get_db)):
    return await publish_exam(db, exam_id, config)

@router.post("/{exam_id}/participants", response_model=List[ExamParticipantResponse], dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def add_participants(exam_id: int, req: ExamParticipantCreate, db: AsyncSession = Depends(get_db)):
    return await assign_participants(db, exam_id, req.user_ids)


@router.post("/{exam_id}/assign", response_model=List[ExamParticipantResponse], dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def assign_participants_compat(exam_id: int, user_ids: List[int], db: AsyncSession = Depends(get_db)):
    return await assign_participants(db, exam_id, user_ids)

@router.post("/{exam_id}/start", dependencies=[Depends(RequireRole(["STUDENT"]))])
async def start_exam(exam_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Randomly assign a form if not assigned, and return it
    form = await get_or_assign_exam_form(db, exam_id, current_user.id)
    return {"message": "Exam started", "form_code": form.code, "form_id": form.id}



@router.get("/{exam_id}/session", response_model=ExamSessionInfoResponse, dependencies=[Depends(RequireRole(["STUDENT"]))])
async def get_session(exam_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await get_exam_session_info(db, exam_id, current_user.id)

@router.post("/{exam_id}/autosave", response_model=AutosaveResponse, dependencies=[Depends(RequireRole(["STUDENT"]))])
async def autosave(exam_id: int, req: AutosaveRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    saved_count = await autosave_answers(db, exam_id, current_user.id, req)
    from datetime import datetime, timezone
    return {"success": True, "saved_count": saved_count, "timestamp": datetime.now(timezone.utc)}

@router.post("/{exam_id}/submit", dependencies=[Depends(RequireRole(["STUDENT"]))])
@limiter.limit("5/minute")
async def submit(request: Request, exam_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await submit_exam(db, exam_id, current_user.id)
    return {"message": "Exam submitted successfully"}

@router.post("/{exam_id}/track", response_model=TrackingEventResponse, dependencies=[Depends(RequireRole(["STUDENT"]))])
async def track_event(exam_id: int, req: TrackingEventRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await log_tracking_event(db, exam_id, current_user.id, req)
    from datetime import datetime, timezone
    return {"success": True, "timestamp": datetime.now(timezone.utc)}
