from sqlalchemy import String, Boolean, ForeignKey, Integer, DateTime, Text, Enum as SQLAlchemyEnum, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional
import enum

from app.models.base import Base

class OmrJobStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class OmrSheetStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class OmrJob(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exam.id"))
    uploader_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    
    status: Mapped[OmrJobStatus] = mapped_column(SQLAlchemyEnum(OmrJobStatus), default=OmrJobStatus.PENDING)
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    processed_files: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

class OmrSheet(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("omr_job.id"))
    
    image_path: Mapped[str] = mapped_column(String(500))
    
    # Dữ liệu OpenCV nhận diện được
    student_id_raw: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    form_code_raw: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    answers_raw: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON fill_ratios
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True) # % tin cậy
    
    status: Mapped[OmrSheetStatus] = mapped_column(SQLAlchemyEnum(OmrSheetStatus), default=OmrSheetStatus.PENDING)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Kết quả mapping
    exam_submission_id: Mapped[Optional[int]] = mapped_column(ForeignKey("exam_submission.id"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
