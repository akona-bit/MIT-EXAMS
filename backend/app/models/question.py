import enum
from sqlalchemy import String, Boolean, ForeignKey, Integer, DateTime, Text, Enum, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import List, Optional

from .base import Base
from .user import User
from .passage import Passage

class Resource(Base):
    """Stub model for Supabase Storage metadata. Files are in Supabase Storage, not in this table."""
    __tablename__ = "resource"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class QuestionType(str, enum.Enum):
    SINGLE_CHOICE = "SINGLE_CHOICE"
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    TRUE_FALSE = "TRUE_FALSE"
    FILL_IN_BLANK = "FILL_IN_BLANK"
    COMPOSITE = "COMPOSITE"

class QuestionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class ResourceType(str, enum.Enum):
    TEXT = "TEXT"           # bucket: van-ban
    IMAGE = "IMAGE"        # bucket: hinh-anh
    PDF = "PDF"            # bucket: pdf
    HANDWRITING = "HANDWRITING"  # bucket: viet-tay
    CHART = "CHART"        # bucket: bang-bieu

class KnowledgeNodeType(str, enum.Enum):
    TOPIC = "TOPIC"
    CONCEPT = "CONCEPT"
    SKILL = "SKILL"
    SUB_SKILL = "SUB_SKILL"

class KnowledgeNode(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    node_type: Mapped[KnowledgeNodeType] = mapped_column(Enum(KnowledgeNodeType), default=KnowledgeNodeType.SKILL)
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_leaf: Mapped[bool] = mapped_column(Boolean, default=True)

    short_code: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    path_code: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)

    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("knowledge_node.id"), nullable=True, index=True)
    parent: Mapped[Optional["KnowledgeNode"]] = relationship("KnowledgeNode", remote_side=[id], back_populates="children")
    children: Mapped[List["KnowledgeNode"]] = relationship("KnowledgeNode", back_populates="parent", cascade="all, delete-orphan")



class QuestionEmbedding(Base):
    """Vector embedding for semantic search of questions."""
    __tablename__ = "question_embedding"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("question.id", ondelete="CASCADE"), unique=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # stored as JSON string, pgvector handles vector type
    model_name: Mapped[str] = mapped_column(String(50), default="text-embedding-3-small")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    question: Mapped["Question"] = relationship("Question", foreign_keys=[question_id])


class Question(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    public_code: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True) # made nullable for migration, backfill later
    content: Mapped[str] = mapped_column(Text)
    level: Mapped[int] = mapped_column(Integer, default=1) # 1: Nhan biet, 2: Thong hieu, 3: Van dung
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), default=QuestionType.SINGLE_CHOICE)
    render_style: Mapped[str] = mapped_column(String(50), default="standard", server_default="standard")
    status: Mapped[QuestionStatus] = mapped_column(Enum(QuestionStatus), default=QuestionStatus.DRAFT)
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    resource_id: Mapped[Optional[int]] = mapped_column(ForeignKey("resource.id"), nullable=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    passage_id: Mapped[Optional[int]] = mapped_column(ForeignKey("passage.id"), nullable=True)
    
    source_author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Versioning
    parent_question_id: Mapped[Optional[int]] = mapped_column(ForeignKey("question.id"), nullable=True)

    knowledge_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_node.id"), index=True, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # IRT Parameters
    a_param: Mapped[float] = mapped_column(Float, default=1.0, server_default="1.0") # Discrimination
    b_param: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0") # Difficulty
    c_param: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0") # Guessing
    is_calibrated: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    # Cấu hình chấm riêng cho từng dạng câu
    # Ví dụ: TRUE_FALSE có thể cấu hình "0.1/0.25/0.5/1" tùy số ý đúng
    scoring_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    knowledge_node: Mapped["KnowledgeNode"] = relationship("KnowledgeNode")

    passage: Mapped[Optional["Passage"]] = relationship("Passage", back_populates="questions")
    answers: Mapped[List["Answer"]] = relationship(back_populates="question", cascade="all, delete-orphan")
    sub_items: Mapped[List["QuestionSubItem"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="QuestionSubItem.position"
    )


class QuestionSubItem(Base):
    """Một ý con trong câu hỏi (TRUE_FALSE nhiều ý, COMPOSITE).

    - Với câu TRUE_FALSE: mỗi ý con có prompt riêng ("a) Hà Nội là thủ đô"), 2 Answer (Đúng/Sai).
    - Với câu COMPOSITE: mỗi ý con có prompt riêng và có thể có Answer riêng (1 lựa chọn, nhiều lựa chọn, đúng/sai...).
    - Với câu SINGLE_CHOICE / MULTIPLE_CHOICE: KHÔNG dùng sub-items, đáp án nằm trực tiếp trên Question.answers.
    """

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("question.id"))
    label: Mapped[str] = mapped_column(String(20))  # "a", "b", "c", "d" hoặc "1", "2"
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)  # thứ tự hiển thị
    point_weight: Mapped[float] = mapped_column(Float, default=0.25)  # điểm tối đa ý này
    # kind cho biết ý con chấm theo kiểu nào (single / multi / tf). Mặc định 'tf' cho TRUE_FALSE, 'single' cho COMPOSITE.
    kind: Mapped[str] = mapped_column(String(20), default="tf")

    question: Mapped["Question"] = relationship(back_populates="sub_items")
    answers: Mapped[List["Answer"]] = relationship(
        "Answer", back_populates="sub_item", cascade="all, delete-orphan",
        primaryjoin="and_(Answer.sub_item_id==QuestionSubItem.id, Answer.sub_item_id.isnot(None))",
    )


class Answer(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("question.id"))
    content: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Mở rộng: gắn đáp án vào một sub-item nếu có
    sub_item_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("question_sub_item.id"), nullable=True
    )
    sub_item: Mapped[Optional["QuestionSubItem"]] = relationship(
        "QuestionSubItem", back_populates="answers", foreign_keys=[sub_item_id]
    )
    # Vẫn giữ relationship "question" mặc định trỏ về Question gốc
    question: Mapped["Question"] = relationship(back_populates="answers", foreign_keys=[question_id])



