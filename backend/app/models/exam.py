from sqlalchemy import String, Boolean, ForeignKey, Integer, DateTime, Text, Float, Enum as SQLAlchemyEnum, JSON
from sqlalchemy.dialects.postgresql import JSONB
import enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import List, Optional

from .base import Base
from .question import QuestionType

class Matrix(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rules: Mapped[List["MatrixRule"]] = relationship(back_populates="matrix", cascade="all, delete-orphan")
    groups: Mapped[List["MatrixRuleGroup"]] = relationship(back_populates="matrix", cascade="all, delete-orphan")

class MatrixRuleGroup(Base):
    __tablename__ = "matrix_rule_group"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    matrix_id: Mapped[int] = mapped_column(ForeignKey("matrix.id"))
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    required_passage_id: Mapped[Optional[int]] = mapped_column(ForeignKey("passage.id"), nullable=True)

    matrix: Mapped["Matrix"] = relationship(back_populates="groups")
    rules: Mapped[List["MatrixRule"]] = relationship(back_populates="group")


class MatrixRule(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    matrix_id: Mapped[int] = mapped_column(ForeignKey("matrix.id"))
    knowledge_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_node.id"))
    # Nullable từ Matrix 2.1: rule "đơn giản" chỉ cần node + count, engine tự cân bằng
    # dạng câu/mức độ theo phân bố thực tế của ngân hàng câu hỏi trong node
    question_type: Mapped[Optional[QuestionType]] = mapped_column(SQLAlchemyEnum(QuestionType), nullable=True)
    level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Advanced mode: target tỷ lệ mức độ, vd {"NB": 0.4, "TH": 0.3, "VD": 0.2, "VDC": 0.1}
    # Khi null → engine tự tính từ phân bố thực tế trong ngân hàng
    level_distribution: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    count: Mapped[int] = mapped_column(Integer, default=1)
    # Part indicator: 1 (TV), 2 (TA), 3 (Toan), 4 (TDKH)
    part: Mapped[int] = mapped_column(Integer, default=1)
    target_irt_b: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("matrix_rule_group.id"), nullable=True)

    matrix: Mapped["Matrix"] = relationship(back_populates="rules")
    group: Mapped[Optional["MatrixRuleGroup"]] = relationship(back_populates="rules")

class ExamGenerationStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class ExamGenerationRun(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    matrix_id: Mapped[int] = mapped_column(ForeignKey("matrix.id"))
    num_forms: Mapped[int] = mapped_column(Integer, default=1)
    distinct_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[ExamGenerationStatus] = mapped_column(SQLAlchemyEnum(ExamGenerationStatus))
    error_details: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExamStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    COMPLETED = "COMPLETED"

class ParticipantStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    SUSPENDED = "SUSPENDED"

class Exam(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    matrix_id: Mapped[int] = mapped_column(ForeignKey("matrix.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=150)
    show_score_mode: Mapped[str] = mapped_column(String(50), default="NONE")
    show_answer_mode: Mapped[str] = mapped_column(String(50), default="NONE")
    status: Mapped[ExamStatus] = mapped_column(SQLAlchemyEnum(ExamStatus), default=ExamStatus.DRAFT)

    forms: Mapped[List["ExamForm"]] = relationship(back_populates="exam", cascade="all, delete-orphan")
    participants: Mapped[List["ExamParticipant"]] = relationship(back_populates="exam", cascade="all, delete-orphan")

class ExamParticipant(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exam.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    sbd: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exam_form_id: Mapped[Optional[int]] = mapped_column(ForeignKey("exam_form.id"), nullable=True)
    status: Mapped[ParticipantStatus] = mapped_column(SQLAlchemyEnum(ParticipantStatus), default=ParticipantStatus.NOT_STARTED)
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submit_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"), nullable=True)
    device_fingerprint: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    exam: Mapped["Exam"] = relationship(back_populates="participants")
    user = relationship("User", foreign_keys=[user_id])
    suspended_by = relationship("User", foreign_keys=[suspended_by_id])
    exam_form = relationship("ExamForm")

    submission: Mapped[Optional["ExamSubmission"]] = relationship(back_populates="participant", cascade="all, delete-orphan", uselist=False)
    tracking_logs: Mapped[List["ExamTrackingLog"]] = relationship(back_populates="participant", cascade="all, delete-orphan")

class ExamForm(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exam.id"))
    code: Mapped[str] = mapped_column(String(50)) # Mã đề, e.g. 101, 102
    is_original: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    exam: Mapped["Exam"] = relationship(back_populates="forms")
    questions: Mapped[List["ExamFormQuestion"]] = relationship(back_populates="exam_form", cascade="all, delete-orphan")

class ExamFormQuestion(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_form_id: Mapped[int] = mapped_column(ForeignKey("exam_form.id"))
    question_id: Mapped[int] = mapped_column(ForeignKey("question.id"))
    position: Mapped[int] = mapped_column(Integer) # Vị trí 1-120
    part: Mapped[int] = mapped_column(Integer) # 1, 2, 3, 4
    matrix_rule_id: Mapped[Optional[int]] = mapped_column(ForeignKey("matrix_rule.id"), nullable=True)
    exam_generation_run_id: Mapped[Optional[int]] = mapped_column(ForeignKey("exam_generation_run.id"), nullable=True)

    exam_form: Mapped["ExamForm"] = relationship(back_populates="questions")
    answers: Mapped[List["ExamFormAnswer"]] = relationship(back_populates="exam_form_question", cascade="all, delete-orphan")
    question_ref = relationship("Question")

class ExamFormAnswer(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_form_question_id: Mapped[int] = mapped_column(ForeignKey("exam_form_question.id"))
    answer_id: Mapped[int] = mapped_column(ForeignKey("answer.id"))
    new_position: Mapped[int] = mapped_column(Integer) # 1 (A), 2 (B), 3 (C), 4 (D)

    exam_form_question: Mapped["ExamFormQuestion"] = relationship(back_populates="answers")

class ExamSubmission(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_participant_id: Mapped[int] = mapped_column(ForeignKey("exam_participant.id"))
    submit_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    participant: Mapped["ExamParticipant"] = relationship(back_populates="submission")
    answers: Mapped[List["ExamSubmissionAnswer"]] = relationship(back_populates="submission", cascade="all, delete-orphan")

class ExamSubmissionAnswer(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_submission_id: Mapped[int] = mapped_column(ForeignKey("exam_submission.id"))
    exam_form_question_id: Mapped[int] = mapped_column(ForeignKey("exam_form_question.id"))
    # SINGLE_CHOICE: dùng selected_answer_id
    selected_answer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("answer.id"), nullable=True)  # None nếu bỏ trống
    # MULTIPLE_CHOICE: danh sách ID các answer được chọn
    selected_answer_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    # TRUE_FALSE / COMPOSITE: dict { sub_item_id: selected_answer_id }
    selected_subitem_answers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    # Điểm của riêng câu này (do scorer ghi, vd 0.25 cho 1 ý đúng/sai đúng)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    submission: Mapped["ExamSubmission"] = relationship(back_populates="answers")

class ExamTrackingLog(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_participant_id: Mapped[int] = mapped_column(ForeignKey("exam_participant.id"))
    action_type: Mapped[str] = mapped_column(String(50)) # e.g. TAB_CHANGED, BLUR_WINDOW
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    participant: Mapped["ExamParticipant"] = relationship(back_populates="tracking_logs")
