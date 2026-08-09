import enum
from sqlalchemy import String, Boolean, ForeignKey, Integer, DateTime, Text, Enum, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import List, Optional

from .base import Base
from .user import User

class QuestionType(str, enum.Enum):
    SINGLE_CHOICE = "SINGLE_CHOICE"
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    TRUE_FALSE = "TRUE_FALSE"
    FILL_IN_BLANK = "FILL_IN_BLANK"

class QuestionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class ResourceType(str, enum.Enum):
    IMAGE = "IMAGE"
    PDF = "PDF"
    TEXT = "TEXT"

class KnowledgeNode(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("knowledge_node.id"), nullable=True)
    
    sub_nodes: Mapped[List["KnowledgeNode"]] = relationship("KnowledgeNode", backref="parent", remote_side=[id])
    questions: Mapped[List["Question"]] = relationship(back_populates="knowledge_node")

class Resource(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    type: Mapped[ResourceType] = mapped_column(Enum(ResourceType))
    content_url: Mapped[str] = mapped_column(String(500))
    uploader_id: Mapped[int] = mapped_column(ForeignKey("user.id"))

class Question(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    level: Mapped[int] = mapped_column(Integer, default=1) # 1: Nhan biet, 2: Thong hieu, 3: Van dung
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), default=QuestionType.SINGLE_CHOICE)
    status: Mapped[QuestionStatus] = mapped_column(Enum(QuestionStatus), default=QuestionStatus.DRAFT)
    
    knowledge_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_node.id"))
    resource_id: Mapped[Optional[int]] = mapped_column(ForeignKey("resource.id"), nullable=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    
    # Versioning
    parent_question_id: Mapped[Optional[int]] = mapped_column(ForeignKey("question.id"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # IRT Parameters
    a_param: Mapped[float] = mapped_column(Float, default=1.0, server_default="1.0") # Discrimination
    b_param: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0") # Difficulty
    c_param: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0") # Guessing
    is_calibrated: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    
    knowledge_node: Mapped["KnowledgeNode"] = relationship(back_populates="questions")
    answers: Mapped[List["Answer"]] = relationship(back_populates="question", cascade="all, delete-orphan")

class Answer(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("question.id"))
    content: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    
    question: Mapped["Question"] = relationship(back_populates="answers")
