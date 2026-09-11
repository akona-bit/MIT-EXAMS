from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional
from datetime import datetime

from app.db.database import get_db
from app.models.exam import ExamSubmission, ExamParticipant, Exam
from app.models.user import User
from app.models.grading import ExamResult
from app.api.dependencies import RequireRole
from app.schemas.submission import SubmissionsListResponse

router = APIRouter()

@router.get("/", response_model=SubmissionsListResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def get_submissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    exam_id: Optional[int] = None,
    keyword: Optional[str] = None,
    gender: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    db: AsyncSession = Depends(get_db)
):
    # Join ExamSubmission -> ExamParticipant -> User
    # Join ExamSubmission -> ExamResult
    # Join ExamParticipant -> Exam
    
    stmt = (
        select(
            ExamSubmission.id,
            Exam.id.label("exam_id"),
            Exam.name.label("exam_name"),
            ExamParticipant.id.label("participant_id"),
            User.id.label("user_id"),
            User.full_name,
            User.registration_number,
            User.gender,
            ExamSubmission.submit_time,
            ExamSubmission.omr_image_url,
            ExamResult.total_score,
            ExamResult.raw_total_score
        )
        .join(ExamParticipant, ExamSubmission.exam_participant_id == ExamParticipant.id)
        .join(User, ExamParticipant.user_id == User.id)
        .join(Exam, ExamParticipant.exam_id == Exam.id)
        .outerjoin(ExamResult, ExamResult.exam_submission_id == ExamSubmission.id)
    )
    
    filters = []
    
    if exam_id is not None:
        filters.append(Exam.id == exam_id)
        
    if keyword:
        filters.append(
            or_(
                User.full_name.ilike(f"%{keyword}%"),
                User.registration_number.ilike(f"%{keyword}%")
            )
        )
        
    if gender:
        filters.append(User.gender == gender)
        
    if date_from:
        filters.append(ExamSubmission.submit_time >= date_from)
        
    if date_to:
        filters.append(ExamSubmission.submit_time <= date_to)
        
    if min_score is not None:
        filters.append(
            or_(
                ExamResult.total_score >= min_score,
                and_(ExamResult.total_score.is_(None), ExamResult.raw_total_score >= min_score)
            )
        )
        
    if max_score is not None:
        filters.append(
            or_(
                ExamResult.total_score <= max_score,
                and_(ExamResult.total_score.is_(None), ExamResult.raw_total_score <= max_score)
            )
        )
        
    if filters:
        stmt = stmt.where(and_(*filters))
        
    # Get total count
    count_stmt = select(func.count()).select_from(
        ExamSubmission
    ).join(ExamParticipant, ExamSubmission.exam_participant_id == ExamParticipant.id)\
     .join(User, ExamParticipant.user_id == User.id)\
     .join(Exam, ExamParticipant.exam_id == Exam.id)\
     .outerjoin(ExamResult, ExamResult.exam_submission_id == ExamSubmission.id)
     
    if filters:
        count_stmt = count_stmt.where(and_(*filters))
        
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0
    
    # Get paginated data
    stmt = stmt.order_by(ExamSubmission.submit_time.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()
    
    items = []
    for row in rows:
        if row.total_score is not None:
            score = row.total_score
            max_score = 1200
        else:
            score = row.raw_total_score
            max_score = 1200
            
        items.append({
            "id": row.id,
            "exam_id": row.exam_id,
            "exam_name": row.exam_name,
            "participant_id": row.participant_id,
            "user_id": row.user_id,
            "full_name": row.full_name,
            "registration_number": row.registration_number,
            "gender": row.gender,
            "submit_time": row.submit_time,
            "score": score,
            "total_score": max_score,
            "omr_image_url": row.omr_image_url
        })
        
    return {
        "items": items,
        "total": total,
        "page": (skip // limit) + 1 if limit else 1,
        "size": limit
    }
