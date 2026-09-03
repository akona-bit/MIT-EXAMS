from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.ai import AiReviewStatus

class AiAnalysisResponse(BaseModel):
    id: int
    content_hash: str
    source_question_id: Optional[int] = None
    analysis_result: Dict[str, Any]
    confidence: Optional[float] = None
    ai_model_used: Optional[str] = None
    review_status: AiReviewStatus
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    version: int

    model_config = ConfigDict(from_attributes=True)

class AiReviewRequest(BaseModel):
    review_status: AiReviewStatus
    updated_analysis_result: Optional[Dict[str, Any]] = None
