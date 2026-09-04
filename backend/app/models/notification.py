import enum
from sqlalchemy import String, ForeignKey, Integer, DateTime, Text, Enum as SQLAlchemyEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional

from .base import Base


class NotificationType(str, enum.Enum):
    SYSTEM = "SYSTEM"
    EXAM = "EXAM"
    GRADING = "GRADING"
    FEEDBACK = "FEEDBACK"
    OTHER = "OTHER"


class Notification(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)
    sender_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"), nullable=True)
    type: Mapped[NotificationType] = mapped_column(SQLAlchemyEnum(NotificationType), default=NotificationType.SYSTEM)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recipient = relationship("User", foreign_keys=[recipient_id])
    sender = relationship("User", foreign_keys=[sender_id])
