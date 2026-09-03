from datetime import datetime
import enum
from sqlalchemy import Integer, String, Text, ForeignKey, DateTime, Enum as SQLAlchemyEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base

class FeedbackCategory(str, enum.Enum):
    BUG = "BUG"
    EXAM_CONTENT = "EXAM_CONTENT"
    OTHER = "OTHER"

class FeedbackStatus(str, enum.Enum):
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"
    IGNORED = "IGNORED"

class Feedback(Base):
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True, nullable=False)
    category: Mapped[FeedbackCategory] = mapped_column(SQLAlchemyEnum(FeedbackCategory), default=FeedbackCategory.OTHER)
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[FeedbackStatus] = mapped_column(SQLAlchemyEnum(FeedbackStatus), default=FeedbackStatus.PENDING)
    context_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    user = relationship("User")
