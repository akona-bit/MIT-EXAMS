from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.db.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse

router = APIRouter()

@router.post("/", response_model=FeedbackResponse)
async def create_feedback(
    req: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Rate limit check (1 minute per user)
    latest_feedback_result = await db.execute(
        select(Feedback)
        .where(Feedback.user_id == current_user.id)
        .order_by(Feedback.id.desc())
        .limit(1)
    )
    latest_feedback = latest_feedback_result.scalars().first()
    
    if latest_feedback and (datetime.now(timezone.utc) - latest_feedback.created_at.astimezone(timezone.utc)).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="Bạn thao tác quá nhanh. Vui lòng đợi 1 phút trước khi gửi góp ý tiếp theo.")
        
    feedback = Feedback(
        user_id=current_user.id,
        category=req.category,
        content=req.content,
        context_data=req.context_data
    )
    
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    
    return feedback
