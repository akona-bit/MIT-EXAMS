"""
Models cho tính năng Hồ sơ tiến độ V-ACT & Mạng lưới kiến thức học sinh.

Lưu ý kiến trúc:
- ExamResult đã lưu irt_score_part1..4 (0-300 mỗi phần) và total_score (0-1200).
  → KHÔNG cần bảng exam_submission_section_score riêng.
  → API vact-progress/radar query thẳng ExamResult.

- 2 bảng mới dưới đây chỉ lưu dữ liệu aggregate/precompute:
  1. StudentActivityDaily: nhật ký hoạt động theo ngày (heatmap)
  2. StudentKnowledgeMastery: thống kê đúng/sai/trống theo knowledge_node (mạng lưới)
"""

from sqlalchemy import String, Boolean, ForeignKey, Integer, DateTime, Date, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime, date
from typing import Optional

from app.models.base import Base


class StudentActivityDaily(Base):
    """Nhật ký hoạt động hàng ngày — nguồn dữ liệu cho heatmap 8 tuần."""
    __tablename__ = "student_activity_daily"
    __table_args__ = (
        UniqueConstraint("user_id", "activity_date", name="uq_student_activity_daily"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # FK tới user.id (không dùng "students" vì bảng thực tế là "user")
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    activity_date: Mapped[date] = mapped_column(Date, index=True)

    submissions_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    lessons_watched_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    watch_minutes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    forum_posts_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_strengthened_day: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User")


class StudentTopicMastery(Base):
    """Trạng thái nắm vững kiến thức theo chủ đề — tính lại sau mỗi lần chấm bài."""
    __tablename__ = "student_topic_mastery"
    __table_args__ = (
        UniqueConstraint("user_id", "knowledge_node_id", name="uq_student_topic_mastery"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    knowledge_node_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_node.id", ondelete="CASCADE"), index=True
    )

    # 'on_prereq_review' | 'upcoming_review' | 'at_level' | 'not_tracked'
    status: Mapped[str] = mapped_column(String(30), default="not_tracked", server_default="not_tracked")

    wrong_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    blank_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Câu sai gần nhất — để hiển thị "Sai câu N, [tên đề thi]"
    last_wrong_question_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("question.id"), nullable=True
    )
    last_wrong_exam_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("exam.id"), nullable=True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User")
    knowledge_node = relationship("KnowledgeNode")
    last_wrong_question = relationship("Question", foreign_keys=[last_wrong_question_id])
    last_wrong_exam = relationship("Exam", foreign_keys=[last_wrong_exam_id])

