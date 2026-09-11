from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.user import UserResponse

class SubmissionListItemResponse(BaseModel):
    id: int
    exam_id: int
    exam_name: str
    participant_id: int
    user_id: int
    full_name: Optional[str] = None
    registration_number: Optional[str] = None
    gender: Optional[str] = None
    submit_time: Optional[datetime] = None
    score: Optional[float] = None
    total_score: Optional[float] = None
    omr_image_url: Optional[str] = None
    
    class Config:
        from_attributes = True

class SubmissionsListResponse(BaseModel):
    items: List[SubmissionListItemResponse]
    total: int
    page: int
    size: int
