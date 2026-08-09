from sqlalchemy import String, ForeignKey, Integer, DateTime, Text, Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional
import enum

from app.models.base import Base

class AuditAction(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    BAN_STUDENT = "BAN_STUDENT"
    UNBAN_STUDENT = "UNBAN_STUDENT"
    RUN_IRT = "RUN_IRT"
    BACKUP_DB = "BACKUP_DB"
    OTHER = "OTHER"

class AuditLog(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    action: Mapped[AuditAction] = mapped_column(SQLAlchemyEnum(AuditAction))
    target_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # e.g. "Question", "ExamParticipant"
    target_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User")
