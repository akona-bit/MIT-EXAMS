from sqlalchemy import String, Boolean, ForeignKey, Integer, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional

from app.models.base import Base


class AnswerAccessGrant(Base):
    __tablename__ = "answer_access_grant"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    exam_id: Mapped[Optional[int]] = mapped_column(ForeignKey("exam.id", ondelete="CASCADE"), index=True, nullable=True)
    
    granted: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    source: Mapped[str] = mapped_column(String(50), default="manual", server_default="manual")  # 'manual' | 'payment'
    granted_by: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    payment_ref: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    student = relationship("User", foreign_keys=[student_id])
    granted_by_user = relationship("User", foreign_keys=[granted_by])
    exam = relationship("Exam")
