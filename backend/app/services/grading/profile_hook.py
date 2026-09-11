"""
Post-grading hook: cập nhật StudentActivityDaily + StudentKnowledgeMastery
sau khi một bài làm được chấm điểm (CTT hoặc IRT).

Được gọi từ grade_submission_ctt() — không phải Celery task riêng.
"""

from datetime import date, timedelta, datetime, timezone
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam import (
    ExamSubmission, ExamParticipant, ExamFormQuestion, ExamSubmissionAnswer,
)
from app.models.grading import ExamResult
from app.models.student_profile import StudentActivityDaily, StudentTopicMastery
from app.models.question import Question, KnowledgeNode


def _classify_mastery_status(
    correct: int, wrong: int, blank: int, total: int,
    last_wrong_date: datetime | None = None,
) -> str:
    """Phân loại trạng thái mastery."""
    if total == 0:
        return "at_level"

    err_rate = (wrong + blank) / total
    
    if err_rate > 0.5:
        return "on_prereq_review"
    elif err_rate > 0.2:
        return "upcoming_review"
    else:
        return "at_level"


async def update_student_profile_after_grading(
    db: AsyncSession,
    submission_id: int,
) -> None:
    """
    Gọi sau khi grade_submission_ctt() commit xong.
    1. Cập nhật StudentActivityDaily (tăng submissions_count)
    2. Cập nhật StudentKnowledgeMastery (correct/wrong/blank theo knowledge_node)
    """
    # ─── Load submission + participant ──────────────────────────────────
    sub_result = await db.execute(
        select(ExamSubmission, ExamParticipant)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamSubmission.id == submission_id)
    )
    row = sub_result.first()
    if not row:
        return
    submission, participant = row
    user_id = participant.user_id
    submit_date = (submission.submit_time or datetime.now(timezone.utc)).date()

    # ─── 1. Update activity daily ──────────────────────────────────────
    activity_result = await db.execute(
        select(StudentActivityDaily).where(
            StudentActivityDaily.user_id == user_id,
            StudentActivityDaily.activity_date == submit_date,
        )
    )
    activity = activity_result.scalars().first()
    if activity:
        activity.submissions_count += 1
    else:
        activity = StudentActivityDaily(
            user_id=user_id,
            activity_date=submit_date,
            submissions_count=1,
        )
        db.add(activity)

    # Kiểm tra is_strengthened_day: so sánh raw_total với lượt liền trước
    current_result = await db.execute(
        select(ExamResult.raw_total_score)
        .where(ExamResult.exam_submission_id == submission_id)
    )
    current_raw = current_result.scalar_one_or_none()

    if current_raw is not None:
        prev_result = await db.execute(
            select(ExamResult.raw_total_score)
            .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
            .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
            .where(
                ExamParticipant.user_id == user_id,
                ExamResult.exam_submission_id != submission_id,
            )
            .order_by(ExamSubmission.submit_time.desc())
            .limit(1)
        )
        prev_raw = prev_result.scalar_one_or_none()
        if prev_raw is not None and current_raw > prev_raw:
            activity.is_strengthened_day = True

    # ─── 2. Update knowledge mastery ───────────────────────────────────
    # Load ExamResult.item_scores to get per-question scores
    exam_result_row = await db.execute(
        select(ExamResult).where(ExamResult.exam_submission_id == submission_id)
    )
    exam_result = exam_result_row.scalars().first()
    if not exam_result or not exam_result.item_scores:
        await db.commit()
        return

    item_scores = exam_result.item_scores  # {str(question_id): score}

    # Get question_ids and their knowledge_node_ids
    question_ids = []
    for qid_str in item_scores.keys():
        try:
            question_ids.append(int(qid_str))
        except ValueError:
            continue

    if not question_ids:
        await db.commit()
        return

    # Load questions with their knowledge_node references
    q_result = await db.execute(
        select(Question.id, Question.knowledge_node_id)
        .where(Question.id.in_(question_ids))
    )
    q_to_node = {row[0]: row[1] for row in q_result.all() if row[1] is not None}

    # Load exam label for "last wrong" tracking
    exam_result2 = await db.execute(
        select(ExamParticipant.exam_id)
        .where(ExamParticipant.id == submission.exam_participant_id)
    )
    exam_id = exam_result2.scalar_one_or_none()
    exam_label = f"Kỳ thi #{exam_id}" if exam_id else None

    # Get form question positions for question_number tracking
    if participant.exam_form_id:
        fq_result = await db.execute(
            select(ExamFormQuestion.question_id, ExamFormQuestion.position)
            .where(ExamFormQuestion.exam_form_id == participant.exam_form_id)
        )
        q_to_position = {row[0]: row[1] for row in fq_result.all()}
    else:
        q_to_position = {}

    # Aggregate per knowledge_node
    node_updates: dict[int, dict] = {}  # node_id -> {correct, wrong, blank}
    for qid_str, score in item_scores.items():
        try:
            qid = int(qid_str)
        except ValueError:
            continue
        node_id = q_to_node.get(qid)
        if node_id is None:
            continue

        if node_id not in node_updates:
            node_updates[node_id] = {
                "correct": 0, "wrong": 0, "blank": 0,
                "last_wrong_qid": None, "last_wrong_pos": None,
            }
        entry = node_updates[node_id]
        # score == -1 → blank, score == 0 → wrong, score > 0 → correct
        if score < 0:
            entry["blank"] += 1
        elif score == 0:
            entry["wrong"] += 1
            entry["last_wrong_qid"] = qid
            entry["last_wrong_pos"] = q_to_position.get(qid)
        else:
            entry["correct"] += 1

    # Upsert mastery records
    knowledge_node_ids = list(node_updates.keys())
    if knowledge_node_ids:
        mastery_result = await db.execute(
            select(StudentTopicMastery).where(
                StudentTopicMastery.user_id == user_id,
                StudentTopicMastery.knowledge_node_id.in_(knowledge_node_ids),
            )
        )
        mastery_records = mastery_result.scalars().all()
    else:
        mastery_records = []

    for node_id, counts in node_updates.items():
        mastery = next((m for m in mastery_records if m.knowledge_node_id == node_id), None)
        if not mastery:
            mastery = StudentTopicMastery(
                user_id=user_id,
                knowledge_node_id=node_id,
                wrong_count=0,
                blank_count=0,
                attempt_count=0,
            )
            db.add(mastery)

        # Cập nhật số đếm
        mastery.attempt_count += (counts["correct"] + counts["wrong"] + counts["blank"])
        mastery.wrong_count += counts["wrong"]
        mastery.blank_count += counts["blank"]

        # Cập nhật câu sai gần nhất
        if counts["last_wrong_qid"]:
            mastery.last_wrong_question_id = counts["last_wrong_qid"]
            mastery.last_wrong_exam_id = exam_id

        # Đánh giá lại trạng thái
        mastery.status = _classify_mastery_status(
            correct=mastery.attempt_count - mastery.wrong_count - mastery.blank_count,
            wrong=mastery.wrong_count,
            blank=mastery.blank_count,
            total=mastery.attempt_count,
        )

    await db.commit()
