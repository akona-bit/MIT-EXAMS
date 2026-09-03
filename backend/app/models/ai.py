import enum
from sqlalchemy import String, ForeignKey, Integer, DateTime, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional

from .base import Base

class AiReviewStatus(str, enum.Enum):
    AI_SUGGESTED = "AI_SUGGESTED"
    HUMAN_EDITED = "HUMAN_EDITED"
    HUMAN_CONFIRMED = "HUMAN_CONFIRMED"
    HUMAN_REJECTED = "HUMAN_REJECTED"

class AiAnalysisCache(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    content_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    source_question_id: Mapped[Optional[int]] = mapped_column(ForeignKey("question.id"), nullable=True, index=True)
    
    analysis_result: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_model_used: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    review_status: Mapped[AiReviewStatus] = mapped_column(String(50), default=AiReviewStatus.AI_SUGGESTED, nullable=False)
    reviewed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    version: Mapped[int] = mapped_column(Integer, default=1)
    
    # Relationships
    question: Mapped[Optional["Question"]] = relationship("Question", foreign_keys=[source_question_id])
    reviewer: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewed_by])


class AiRequestLog(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    question_id: Mapped[Optional[int]] = mapped_column(ForeignKey("question.id"), nullable=True, index=True)
    
    token_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost_estimate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
