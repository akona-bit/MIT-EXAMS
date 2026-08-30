from sqlalchemy import String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, List

from .base import Base
from .user import User

class Passage(Base):
    __tablename__ = "passage"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    public_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    source_author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    creator_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    questions: Mapped[List["Question"]] = relationship("Question", back_populates="passage")
