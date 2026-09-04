import enum
from sqlalchemy import String, Boolean, ForeignKey, Integer, DateTime, Text, Enum, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import List, Optional

from .base import Base
from .user import User

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

    questions: Mapped[List["Question"]] = relationship(
        "Question",
        secondary="question_skill_tag",
        back_populates="knowledge_nodes",
        overlaps="skill_tags"
    )

class KnowledgeNodeParent(Base):
    """DAG relation: 1 node can have multiple parents, 1 must be primary"""
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("knowledge_node.id"), index=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("knowledge_node.id"), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    child: Mapped["KnowledgeNode"] = relationship("KnowledgeNode", foreign_keys=[child_id], backref="parents")
    parent: Mapped["KnowledgeNode"] = relationship("KnowledgeNode", foreign_keys=[parent_id], backref="children")

class QuestionSkillTag(Base):
    """Link between a question and its skills (KnowledgeNodes). Replaces single knowledge_node_id."""
    __tablename__ = "question_skill_tag"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("question.id"), index=True)
    knowledge_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_node.id"), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    question: Mapped["Question"] = relationship("Question", back_populates="skill_tags", overlaps="questions")
    knowledge_node: Mapped["KnowledgeNode"] = relationship("KnowledgeNode", overlaps="questions")

class KnowledgeNodeLink(Base):
    """Manual link between two knowledge nodes (non-hierarchical)"""
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("knowledge_node.id"))
    target_id: Mapped[int] = mapped_column(ForeignKey("knowledge_node.id"))
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    source: Mapped["KnowledgeNode"] = relationship("KnowledgeNode", foreign_keys=[source_id])
    target: Mapped["KnowledgeNode"] = relationship("KnowledgeNode", foreign_keys=[target_id])

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
    status: Mapped[QuestionStatus] = mapped_column(Enum(QuestionStatus), default=QuestionStatus.DRAFT)
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    resource_id: Mapped[Optional[int]] = mapped_column(ForeignKey("resource.id"), nullable=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    passage_id: Mapped[Optional[int]] = mapped_column(ForeignKey("passage.id"), nullable=True)
    
    source_author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Versioning
    parent_question_id: Mapped[Optional[int]] = mapped_column(ForeignKey("question.id"), nullable=True)

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

    knowledge_nodes: Mapped[List["KnowledgeNode"]] = relationship(
        "KnowledgeNode",
        secondary="question_skill_tag",
        back_populates="questions",
        viewonly=True,
        overlaps="skill_tags"
    )

    @property
    def primary_knowledge_node_id(self) -> int:
        for tag in self.skill_tags:
            if tag.is_primary:
                return tag.knowledge_node_id
        if self.skill_tags:
            return self.skill_tags[0].knowledge_node_id
        return 0

    @property
    def secondary_knowledge_node_ids(self) -> List[int]:
        return [tag.knowledge_node_id for tag in self.skill_tags if not tag.is_primary]

    skill_tags: Mapped[List["QuestionSkillTag"]] = relationship(
        "QuestionSkillTag",
        back_populates="question",
        cascade="all, delete-orphan",
        overlaps="knowledge_nodes"
    )
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



