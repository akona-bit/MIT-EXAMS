from sqlalchemy import String, Boolean, ForeignKey, Integer, DateTime, Text, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional
from app.models.base import Base

class ExamResult(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_submission_id: Mapped[int] = mapped_column(ForeignKey("exam_submission.id"), unique=True)
    
    # CTT Raw score (số câu đúng)
    ctt_score_part1: Mapped[float] = mapped_column(Float, default=0.0)
    ctt_score_part2: Mapped[float] = mapped_column(Float, default=0.0)
    ctt_score_part3: Mapped[float] = mapped_column(Float, default=0.0)
    ctt_score_part4: Mapped[float] = mapped_column(Float, default=0.0)
    
    # IRT Scaled score (0-300 each part)
    irt_score_part1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    irt_score_part2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    irt_score_part3: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    irt_score_part4: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Total scaled score (0-1200)
    total_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    raw_total_score: Mapped[float] = mapped_column(Float, default=0.0)
    item_scores: Mapped[dict] = mapped_column(JSON, default=dict)
    score_method: Mapped[str] = mapped_column(String(20), default="CTT")
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    submission = relationship("ExamSubmission")

class IrtTask(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exam.id"))
    celery_task_id: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50)) # PENDING, STARTED, SUCCESS, FAILURE
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    exam = relationship("Exam")
