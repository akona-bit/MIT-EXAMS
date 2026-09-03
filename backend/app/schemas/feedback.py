from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from app.models.feedback import FeedbackCategory, FeedbackStatus
from app.schemas.user import UserResponse

class FeedbackCreate(BaseModel):
    category: FeedbackCategory
    content: str = Field(..., max_length=2000)
    context_data: Optional[Dict[str, Any]] = None

class FeedbackResponse(BaseModel):
    id: int
    user_id: int
    category: FeedbackCategory
    content: str
    status: FeedbackStatus
    context_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class FeedbackStatusUpdate(BaseModel):
    status: FeedbackStatus
