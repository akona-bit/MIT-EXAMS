from sqlalchemy import String, Boolean, ForeignKey, Integer, DateTime, Text, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional
from app.models.base import Base

class ExamResult(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_submission_id: Mapped[int] = mapped_column(ForeignKey("exam_submission.id"), unique=True)

    # CTT Raw score (số câu đúng / điểm cộng dồn)
    ctt_score_part1: Mapped[float] = mapped_column(Float, default=0.0)
    ctt_score_part2: Mapped[float] = mapped_column(Float, default=0.0)
    ctt_score_part3: Mapped[float] = mapped_column(Float, default=0.0)
    ctt_score_part4: Mapped[float] = mapped_column(Float, default=0.0)

    # IRT Scaled score (0-300 each part)
    irt_score_part1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    irt_score_part2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    irt_score_part3: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    irt_score_part4: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Total scaled score (0-1200)
    total_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    raw_total_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Điểm từng câu (key = str(position) 1..120, value = float)
    # SINGLE_CHOICE / MULTIPLE_CHOICE: 1 / 0 / -1
    # TRUE_FALSE: 1 / 0.5 / 0.25 / 0.1 / -1 (rule 0.1/0.25/0.5/1 theo số ý đúng)
    # COMPOSITE: tổng điểm cộng dồn các sub-item
    item_scores: Mapped[dict] = mapped_column(JSON, default=dict)

    # Điểm chi tiết từng ý con (chỉ dùng cho TRUE_FALSE / COMPOSITE)
    # key = "q_<question_id>_sub_<sub_item_id>" hoặc "p<position>_<label>" cho backward compat
    # value = float (0, 0.25, 0.5, 0.75, 1, ...)
    item_subitem_scores: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    # Loại câu hỏi từng câu (để xuất Excel)
    # key = "q_<question_id>" hoặc str(position); value = QuestionType.value
    item_types: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    # Đáp án đúng: key = "q_<question_id>"; value = list[int] (answer_id)
    correct_answers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    # Đáp án thí sinh chọn: key = "q_<question_id>"; value = list[int] (answer_id) hoặc dict {sub_item_id: answer_id}
    selected_answers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    # Điểm tối đa mỗi câu: key = "q_<question_id>"; value = float
    item_points: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    # Tổng điểm tối đa đề thi (= 120 cho trắc nghiệm 1 điểm/câu, hoặc khác nếu có TRUE_FALSE/COMPOSITE)
    total_points: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    score_method: Mapped[str] = mapped_column(String(20), default="CTT")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    submission = relationship("ExamSubmission")

class IrtTask(Base):
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exam.id"))
    celery_task_id: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50))  # PENDING, STARTED, SUCCESS, FAILURE
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    exam = relationship("Exam")
