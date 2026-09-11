"""
API endpoints cho Hồ sơ tiến độ V-ACT & Mạng lưới kiến thức học sinh.

Tất cả read-only — dữ liệu đã được precompute qua background job trong scorer.
Auth: ADMIN/TEACHER xem bất kỳ, STUDENT chỉ xem chính mình.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import date, timedelta

from app.db.database import get_db
from app.api.dependencies import get_current_active_user
from app.models.user import User
from app.models.exam import ExamSubmission, ExamParticipant
from app.models.grading import ExamResult
from app.models.student_profile import StudentActivityDaily, StudentTopicMastery
from app.models.question import KnowledgeNode
from app.core.constants import SUBJECT_PARTS, SUBJECT_LABELS
from app.models.question import Question
from app.services.student_profile_service import can_view_answers

router = APIRouter()


def _check_access(current_user: User, target_id: int):
    """
    STUDENT chỉ được xem chính mình.
    ADMIN/TEACHER hiện tại được xem bất kỳ ai.
    TODO: khi có model class/enrollment, scope TEACHER chỉ xem học sinh lớp mình.
    """
    if current_user.role.name == "STUDENT" and current_user.id != target_id:
        raise HTTPException(status_code=403, detail="Bạn chỉ được xem hồ sơ của chính mình")
    if current_user.role.name not in ("ADMIN", "TEACHER", "STUDENT"):
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")


# ─── 1. V-ACT Progress (Line/Area chart) ────────────────────────────────

@router.get("/students/{student_id}/vact-progress")
async def get_vact_progress(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Trả về chuỗi điểm IRT (0-1200) theo thời gian cho từng lượt thi.
    Gồm: điểm tổng + 4 phân môn + delta so với mốc đầu tiên.
    """
    _check_access(current_user, student_id)

    # Lấy tất cả ExamResult của student, sắp theo thời gian nộp bài
    result = await db.execute(
        select(ExamResult, ExamSubmission.submit_time)
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamParticipant.user_id == student_id)
        .order_by(ExamSubmission.submit_time.asc())
    )
    rows = result.all()

    series = []
    for exam_result, submit_time in rows:
        has_irt = exam_result.total_score is not None and exam_result.score_method == "IRT"
        entry = {
            "date": submit_time.isoformat() if submit_time else None,
            "total_score": exam_result.total_score if has_irt else None,
            "tieng_viet": exam_result.irt_score_part1 if has_irt else None,
            "tieng_anh": exam_result.irt_score_part2 if has_irt else None,
            "toan_hoc": exam_result.irt_score_part3 if has_irt else None,
            "tu_duy_khoa_hoc": exam_result.irt_score_part4 if has_irt else None,
            "has_irt_score": has_irt,
            # CTT raw luôn có — fallback cho chart khi chưa chạy IRT
            "raw_total_score": exam_result.raw_total_score,
        }
        series.append(entry)

    # Tính delta: so sánh entry cuối (gần nhất) với entry đầu (mốc đầu kỳ)
    first_irt = next((s for s in series if s["has_irt_score"]), None)
    last_irt = next((s for s in reversed(series) if s["has_irt_score"]), None)

    deltas = {}
    if first_irt and last_irt and first_irt is not last_irt:
        for key in ["total_score", "tieng_viet", "tieng_anh", "toan_hoc", "tu_duy_khoa_hoc"]:
            v_first = first_irt.get(key) or 0
            v_last = last_irt.get(key) or 0
            deltas[key] = round(v_last - v_first, 1)

    current_scores = {}
    if last_irt:
        for key in ["total_score", "tieng_viet", "tieng_anh", "toan_hoc", "tu_duy_khoa_hoc"]:
            current_scores[key] = last_irt.get(key)

    return {
        "series": series,
        "current": current_scores,
        "deltas": deltas,
        "total_submissions": len(series),
        "irt_submissions": sum(1 for s in series if s["has_irt_score"]),
        "first_date": series[0]["date"] if series else None,
    }


# ─── 2. V-ACT Radar (2 bộ điểm: gần nhất + lần trước) ──────────────────

@router.get("/students/{student_id}/vact-radar")
async def get_vact_radar(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    2 bộ điểm 4 phân môn (gần nhất/liền trước) + theta tổng.
    """
    _check_access(current_user, student_id)

    result = await db.execute(
        select(ExamResult, ExamSubmission.submit_time)
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(
            ExamParticipant.user_id == student_id,
            ExamResult.score_method == "IRT",
        )
        .order_by(ExamSubmission.submit_time.desc())
        .limit(2)
    )
    rows = result.all()

    def _to_subject_scores(er: ExamResult):
        return {
            "tieng_viet": er.irt_score_part1,
            "tieng_anh": er.irt_score_part2,
            "toan_hoc": er.irt_score_part3,
            "tu_duy_khoa_hoc": er.irt_score_part4,
            "total": er.total_score,
        }

    latest = _to_subject_scores(rows[0][0]) if len(rows) >= 1 else None
    previous = _to_subject_scores(rows[1][0]) if len(rows) >= 2 else None

    # Tính delta cho mỗi phân môn
    deltas = {}
    if latest and previous:
        for key in ["tieng_viet", "tieng_anh", "toan_hoc", "tu_duy_khoa_hoc", "total"]:
            v_now = latest.get(key) or 0
            v_prev = previous.get(key) or 0
            deltas[key] = round(v_now - v_prev, 1)

    return {
        "latest": latest,
        "previous": previous,
        "deltas": deltas,
        "subject_labels": SUBJECT_LABELS,
    }


# ─── 3. Activity Heatmap ────────────────────────────────────────────────

@router.get("/students/{student_id}/activity-heatmap")
async def get_activity_heatmap(
    student_id: int,
    weeks: int = Query(default=8, ge=1, le=52),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Heatmap hoạt động N tuần gần đây (mặc định 8).
    Mỗi ô = 1 ngày, chứa chi tiết hoạt động (không chỉ intensity).
    """
    _check_access(current_user, student_id)

    since = date.today() - timedelta(weeks=weeks)
    result = await db.execute(
        select(StudentActivityDaily)
        .where(
            StudentActivityDaily.user_id == student_id,
            StudentActivityDaily.activity_date >= since,
        )
        .order_by(StudentActivityDaily.activity_date.asc())
    )
    activities = result.scalars().all()

    days = []
    total_active_days = 0
    total_strengthened = 0
    total_watch_minutes = 0

    for a in activities:
        total_activity = a.submissions_count + a.lessons_watched_count + a.forum_posts_count
        is_active = total_activity > 0
        if is_active:
            total_active_days += 1
        if a.is_strengthened_day:
            total_strengthened += 1
        total_watch_minutes += a.watch_minutes

        days.append({
            "date": a.activity_date.isoformat(),
            "submissions": a.submissions_count,
            "lessons": a.lessons_watched_count,
            "forum": a.forum_posts_count,
            "watch_minutes": a.watch_minutes,
            "is_strengthened": a.is_strengthened_day,
            "total_activity": total_activity,
        })

    total_possible = weeks * 7

    return {
        "days": days,
        "summary": {
            "active_days": total_active_days,
            "total_days": total_possible,
            "strengthened_days": total_strengthened,
            "total_watch_minutes": total_watch_minutes,
        },
    }


# ─── 4. Knowledge Network ───────────────────────────────────────────────

@router.get("/students/{student_id}/knowledge-network")
async def get_knowledge_network(
    student_id: int,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=6, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Danh sách chủ đề kiến thức + tỉ lệ đúng/sai/trống + câu sai gần nhất.
    """
    _check_access(current_user, student_id)

    # Đếm theo status
    count_result = await db.execute(
        select(
            StudentTopicMastery.status,
            func.count(StudentTopicMastery.id),
        )
        .where(StudentTopicMastery.user_id == student_id)
        .group_by(StudentTopicMastery.status)
    )
    status_counts = {row[0]: row[1] for row in count_result.all()}

    total = sum(status_counts.values())
    overdue = status_counts.get("overdue_review", 0)
    upcoming = status_counts.get("upcoming_review", 0)
    on_track = status_counts.get("on_track", 0)

    # Query danh sách mastery
    query = (
        select(StudentTopicMastery)
        .options(selectinload(StudentTopicMastery.knowledge_node))
        .where(StudentTopicMastery.user_id == student_id)
    )
    if status_filter:
        query = query.where(StudentTopicMastery.status == status_filter)
    query = query.order_by(StudentTopicMastery.updated_at.desc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    masteries = result.scalars().all()

    items = []
    for m in masteries:
        node = m.knowledge_node
        items.append({
            "id": m.id,
            "knowledge_node_id": m.knowledge_node_id,
            "topic_name": node.name if node else "Unknown",
            "topic_subject": node.subject if node else None,
            "status": m.status,
            "correct_count": m.correct_count,
            "wrong_count": m.wrong_count,
            "blank_count": m.blank_count,
            "total_attempts": m.total_attempts,
            "accuracy_pct": round(m.correct_count / m.total_attempts * 100, 1)
            if m.total_attempts > 0
            else 0,
            "last_wrong": {
                "question_id": m.last_wrong_question_id,
                "exam_label": m.last_wrong_exam_label,
                "question_number": m.last_wrong_question_number,
            }
            if m.last_wrong_question_id
            else None,
        })

    return {
        "summary": {
            "total": total,
            "overdue_review": overdue,
            "upcoming_review": upcoming,
            "on_track": on_track,
        },
        "items": items,
        "has_more": len(items) == limit,
    }
# ─── 4. Profile Summary ────────────────────────────────
@router.get("/students/{student_id}/profile-summary")
async def get_profile_summary(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _check_access(current_user, student_id)
    
    # Get student info
    result = await db.execute(select(User).where(User.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy học sinh")

    # Get VACT progress
    progress = await get_vact_progress(student_id, db, current_user)
    # Get VACT radar
    radar = await get_vact_radar(student_id, db, current_user)
    
    # Mock Activity heatmap for now if StudentActivityDaily is empty
    # In a real app, query StudentActivityDaily
    heatmap = {
        "weeks": 8,
        "days_active": 0,
        "total_days": 56,
        "strong_up_days": 0,
        "watch_minutes_total": 0,
        "cells": []
    }
    
    can_view = await can_view_answers(db, current_user, student_id)

    return {
        "student": {
            "id": student.id,
            "name": student.full_name or student.username,
            "class_label": "GIAIDOAN2"  # placeholder
        },
        "vact_progress": progress,
        "irt_radar": radar,
        "activity_heatmap": heatmap,
        "can_view_answers_default": can_view
    }

# ─── 5. Knowledge Network ────────────────────────────────
@router.get("/students/{student_id}/knowledge-network")
async def get_knowledge_network(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _check_access(current_user, student_id)
    
    # query StudentTopicMastery
    from app.models.student_profile import StudentTopicMastery
    from app.models.exam import Exam
    
    result = await db.execute(
        select(StudentTopicMastery, KnowledgeNode, Exam.name)
        .join(KnowledgeNode, KnowledgeNode.id == StudentTopicMastery.knowledge_node_id)
        .outerjoin(Exam, Exam.id == StudentTopicMastery.last_wrong_exam_id)
        .where(StudentTopicMastery.user_id == student_id)
    )
    rows = result.all()
    
    counts = {
        "tracked": len(rows),
        "on_prereq_review": 0,
        "upcoming_review": 0,
        "at_level": 0
    }
    
    items = []
    for mastery, node, exam_name in rows:
        counts[mastery.status] = counts.get(mastery.status, 0) + 1
        items.append({
            "knowledge_node_id": node.id,
            "label": node.name,
            "status": mastery.status,
            "wrong_count": mastery.wrong_count,
            "blank_count": mastery.blank_count,
            "attempt_count": mastery.attempt_count,
            "last_wrong_ref": {
                "question_id": mastery.last_wrong_question_id,
                "exam_label": exam_name
            } if mastery.last_wrong_question_id else None
        })
        
    return {
        "counts": counts,
        "items": items
    }

@router.get("/students/{student_id}/knowledge-network/{knowledge_node_id}/detail")
async def get_knowledge_node_detail(
    student_id: int,
    knowledge_node_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _check_access(current_user, student_id)
    
    # Get node
    result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == knowledge_node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề")

    # Access control
    # Here we don't have exam_id context for the overall node, but for each question we do.
    # However, to simplify, if they have global access, it's unlocked.
    # For exam-specific access, we will check per question.
    
    # To find questions wrong/blank in this node by this student:
    # Query ExamSubmissionAnswer -> Question
    from app.models.exam import ExamSubmission, ExamParticipant, ExamSubmissionAnswer, ExamFormQuestion, Exam
    result = await db.execute(
        select(ExamSubmissionAnswer, Question, Exam.id, Exam.name)
        .join(ExamFormQuestion, ExamFormQuestion.id == ExamSubmissionAnswer.exam_form_question_id)
        .join(Question, Question.id == ExamFormQuestion.question_id)
        .join(ExamSubmission, ExamSubmission.id == ExamSubmissionAnswer.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .join(Exam, Exam.id == ExamParticipant.exam_id)
        .where(
            ExamParticipant.user_id == student_id,
            Question.knowledge_node_id == knowledge_node_id,
            ExamSubmissionAnswer.is_correct == False
        )
        .order_by(ExamSubmission.submit_time.desc())
        .limit(20) # Limit to recent 20
    )
    rows = result.all()
    
    questions_list = []
    has_locked = False
    
    for ans, q, exam_id, exam_name in rows:
        can_view = await can_view_answers(db, current_user, student_id, exam_id)
        
        q_dict = {
            "question_id": q.id,
            "question_public_code": q.public_code,
            "exam_label": exam_name,
            "content_markdown": q.content,
            "student_answer": ans.selected_answer,
            "is_correct": False,
            "correct_answer": None,
            "explanation_markdown": None,
            "answer_locked": not can_view
        }
        
        if can_view:
            q_dict["correct_answer"] = q.correct_answer
            q_dict["explanation_markdown"] = q.explanation
        else:
            has_locked = True
            
        questions_list.append(q_dict)
        
    return {
        "knowledge_node_id": knowledge_node_id,
        "label": node.name,
        "answer_locked": has_locked,
        "questions": questions_list,
        "unlock_hint": "Liên hệ quản trị viên hoặc hoàn tất đăng ký để xem đáp án và lời giải chi tiết." if has_locked else None
    }
