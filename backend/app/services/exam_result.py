"""Service phục vụ trang xem kết quả của thí sinh (Student Exam Result).

Quy tắc nghiệp vụ (xem AGENTS.md / progress-tracker):
- Chỉ xem kết quả khi participant.status là SUBMITTED hoặc SUSPENDED.
  Đang thi (IN_PROGRESS) → chặn ở tầng API, không chỉ ẩn link.
- Điểm thô (CTT) luôn hiển thị ngay sau khi nộp bài.
- Điểm thực (IRT 0-300/phần) CHỈ hiển thị khi:
  1) IrtTask mới nhất của kỳ thi có status = SUCCESS (tương đương
     "status = done" của module Phân tích DS), VÀ
  2) Số lượt làm bài (submission) đạt ngưỡng N >= IRT_MIN_N (200),
  và ExamResult đã được ghi điểm IRT. Ngược lại chỉ hiển thị trạng thái.
- Xem lại đáp án tuân theo permission "Quyền xem đáp án" hiện có
  (cờ user.can_view_answers, quản lý ở Admin → Quyền xem đáp án).
  Không tự tạo cơ chế phân quyền riêng.
"""
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exam import (
    Exam,
    ExamForm,
    ExamFormAnswer,
    ExamFormQuestion,
    ExamParticipant,
    ExamSubmission,
    ExamSubmissionAnswer,
    ParticipantStatus,
)
from app.models.grading import ExamResult, IrtTask
from app.models.question import Answer, Question
from app.services.grading.scorer import grade_submission_ctt

# Ngưỡng N tối thiểu để điểm IRT được coi là chính thức (đồng bộ
# IRT_THRESHOLD = 200 tại endpoint complete_exam).
IRT_MIN_N = 200

PART_LABELS = {
    1: "Tiếng Việt",
    2: "Tiếng Anh",
    3: "Toán học",
    4: "Tư duy khoa học",
}


def resolve_irt_state(
    irt_task_status: Optional[str],
    submission_count: int,
    threshold: int = IRT_MIN_N,
) -> dict[str, Any]:
    """Xác định trạng thái điểm thực (IRT) — hàm thuần, dễ test.

    Returns dict với:
    - state: "done" | "computing" | "failed" | "not_enough_data" | "no_data"
    - eligible: True nếu được phép hiển thị điểm IRT làm chính thức
    - message: thông báo tiếng Việt cho thí sinh
    """
    if irt_task_status is None:
        return {
            "state": "no_data",
            "eligible": False,
            "message": "Kỳ thi chưa có dữ liệu phân tích. Đang chờ kết thúc kỳ thi.",
        }
    if irt_task_status in ("PENDING", "STARTED"):
        return {
            "state": "computing",
            "eligible": False,
            "message": "Điểm thực đang chờ tính toán. Vui lòng quay lại sau.",
        }
    if irt_task_status == "FAILED":
        return {
            "state": "failed",
            "eligible": False,
            "message": "Chưa tính được điểm thực cho kỳ thi này. Hiển thị điểm theo CTT tạm thời.",
        }
    # IrtTask.status == "SUCCESS"
    if submission_count < threshold:
        return {
            "state": "not_enough_data",
            "eligible": False,
            "message": (
                f"Kỳ thi chưa đủ dữ liệu ({submission_count}/{threshold} lượt làm) "
                "để tính điểm chính thức — hiển thị điểm theo CTT tạm thời."
            ),
        }
    return {
        "state": "done",
        "eligible": True,
        "message": "Điểm thực (IRT) đã được tính toán chính thức.",
    }


async def _load_exam_result(db: AsyncSession, submission_id: int) -> Optional[ExamResult]:
    result = await db.execute(
        select(ExamResult).where(ExamResult.exam_submission_id == submission_id)
    )
    return result.scalars().first()


async def _resolve_raw_result(
    db: AsyncSession, submission: ExamSubmission
) -> Optional[ExamResult]:
    """Lấy ExamResult (điểm thô CTT). Nếu chưa có (thí sinh vừa nộp), chấm ngay.

    grade_submission_ctt là idempotent và nhẹ (CTT đơn giản), nên gọi trực tiếp
    tại đây để đảm bảo "Điểm thô hiển thị ngay sau khi nộp bài".
    """
    exam_result = await _load_exam_result(db, submission.id)
    if exam_result:
        return exam_result
    return await grade_submission_ctt(db, submission.id)


async def _count_submissions(db: AsyncSession, exam_id: int) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(ExamSubmission)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamParticipant.exam_id == exam_id)
    )
    return result.scalar() or 0


def _answer_label(position: int) -> str:
    return {1: "A", 2: "B", 3: "C", 4: "D"}.get(position, str(position))


async def _build_review(
    db: AsyncSession,
    participant: ExamParticipant,
    submission: ExamSubmission,
    exam_result: Optional[ExamResult],
) -> list[dict[str, Any]]:
    """Xây danh sách xem lại từng câu — CHỈ gọi khi có quyền xem đáp án."""
    form_questions_result = await db.execute(
        select(ExamFormQuestion)
        .options(
            selectinload(ExamFormQuestion.question_ref),
            selectinload(ExamFormQuestion.answers),
        )
        .where(ExamFormQuestion.exam_form_id == participant.exam_form_id)
        .order_by(ExamFormQuestion.position)
    )
    form_questions = form_questions_result.scalars().unique().all()

    submission_answers_result = await db.execute(
        select(ExamSubmissionAnswer).where(
            ExamSubmissionAnswer.exam_submission_id == submission.id
        )
    )
    submission_answers = {
        sa.exam_form_question_id: sa for sa in submission_answers_result.scalars().all()
    }

    # Map question_id -> vị trí trên đề GỐC (để tra item_scores/item_points)
    original_form_result = await db.execute(
        select(ExamForm.id).where(
            ExamForm.exam_id == participant.exam_id,
            ExamForm.is_original.is_(True),
        )
    )
    original_form_id = original_form_result.scalar_one_or_none()
    original_positions: dict[int, int] = {}
    if original_form_id:
        oq_result = await db.execute(
            select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == original_form_id)
        )
        original_positions = {
            fq.question_id: fq.position for fq in oq_result.scalars().all()
        }

    item_scores: dict[str, Any] = (exam_result.item_scores if exam_result else None) or {}
    item_points: dict[str, Any] = (exam_result.item_points if exam_result else None) or {}

    # Lấy toàn bộ Answer liên quan để biết nội dung + is_correct
    all_answer_ids: set[int] = set()
    for fq in form_questions:
        for fa in fq.answers:
            all_answer_ids.add(fa.answer_id)
    for sa in submission_answers.values():
        if sa.selected_answer_id:
            all_answer_ids.add(sa.selected_answer_id)
        for aid in (sa.selected_answer_ids or []):
            all_answer_ids.add(int(aid))

    answer_lookup: dict[int, Answer] = {}
    if all_answer_ids:
        answers_result = await db.execute(select(Answer).where(Answer.id.in_(all_answer_ids)))
        answer_lookup = {a.id: a for a in answers_result.scalars().all()}

    review: list[dict[str, Any]] = []
    for fq in form_questions:
        question: Optional[Question] = fq.question_ref
        sa = submission_answers.get(fq.id)
        original_position = original_positions.get(fq.question_id, fq.position)
        score = item_scores.get(str(original_position))
        max_points = item_points.get(f"q_{fq.question_id}") or item_points.get(
            str(original_position)
        )

        options = []
        for fa in sorted(fq.answers, key=lambda x: x.new_position):
            ans = answer_lookup.get(fa.answer_id)
            options.append(
                {
                    "answer_id": fa.answer_id,
                    "label": _answer_label(fa.new_position),
                    "content": ans.content if ans else None,
                    "is_correct": bool(ans.is_correct) if ans else False,
                }
            )

        selected_ids: list[int] = []
        if sa:
            if sa.selected_answer_id:
                selected_ids = [sa.selected_answer_id]
            elif sa.selected_answer_ids:
                selected_ids = [int(a) for a in sa.selected_answer_ids]

        has_answer = bool(selected_ids) or bool(
            sa and (sa.selected_subitem_answers or sa.text_answer)
        )

        if not has_answer:
            status = "skipped"
        elif score is not None and score > 0:
            status = "correct"
        elif score is not None and score < 0:
            status = "penalized"
        else:
            status = "wrong"

        review.append(
            {
                "position": fq.position,
                "part": fq.part,
                "part_label": PART_LABELS.get(fq.part, f"Phần {fq.part}"),
                "question_id": fq.question_id,
                "content": question.content if question else None,
                "question_type": (
                    question.question_type.value
                    if question and getattr(question.question_type, "value", None)
                    else None
                ),
                "options": options,
                "selected_answer_ids": selected_ids,
                "selected_subitem_answers": sa.selected_subitem_answers if sa else None,
                "text_answer": sa.text_answer if sa else None,
                "score": score,
                "max_points": max_points,
                "status": status,
            }
        )
    return review


async def get_student_exam_result(
    db: AsyncSession, exam_id: int, user_id: int, current_user: Any
) -> dict[str, Any]:
    """Dữ liệu cho trang kết quả của thí sinh đối với 1 kỳ thi."""
    # 1. Thí sinh phải là participant của kỳ thi
    participant_result = await db.execute(
        select(ExamParticipant).options(selectinload(ExamParticipant.exam)).where(
            ExamParticipant.exam_id == exam_id,
            ExamParticipant.user_id == user_id,
        )
    )
    participant = participant_result.scalars().first()
    if not participant:
        raise HTTPException(status_code=404, detail="Bạn chưa tham gia kỳ thi này")

    # 2. CHẶN khi đang thi hoặc chưa bắt đầu — chặn cả route lẫn API
    if participant.status in (ParticipantStatus.IN_PROGRESS, ParticipantStatus.NOT_STARTED):
        raise HTTPException(
            status_code=403,
            detail="Bài thi chưa được nộp. Kết quả chỉ khả dụng sau khi bạn nộp bài.",
        )

    exam: Optional[Exam] = participant.exam

    # 3. Bài nộp
    submission_result = await db.execute(
        select(ExamSubmission).where(
            ExamSubmission.exam_participant_id == participant.id
        )
    )
    submission = submission_result.scalars().first()
    if not submission:
        raise HTTPException(status_code=404, detail="Bài nộp chưa được ghi nhận")

    # 4. Điểm thô (CTT) — luôn có ngay sau khi nộp
    exam_result = await _resolve_raw_result(db, submission)

    parts = [
        {
            "part": i + 1,
            "label": PART_LABELS[i + 1],
            "raw_score": getattr(exam_result, f"ctt_score_part{i + 1}", 0.0)
            if exam_result
            else 0.0,
            "max_raw_score": 30,
            "irt_score": (
                getattr(exam_result, f"irt_score_part{i + 1}", None)
                if exam_result
                else None
            ),
        }
        for i in range(4)
    ]

    raw_total = exam_result.raw_total_score if exam_result else 0.0

    # 5. Điều kiện hiển thị điểm thực (IRT)
    latest_task_result = await db.execute(
        select(IrtTask)
        .where(IrtTask.exam_id == exam_id)
        .order_by(IrtTask.id.desc())
    )
    latest_task = latest_task_result.scalars().first()
    submission_count = await _count_submissions(db, exam_id)
    irt_state = resolve_irt_state(
        latest_task.status if latest_task else None,
        submission_count,
    )

    # Điểm IRT chỉ hiển thị khi đủ cả 3 điều kiện:
    # task SUCCESS + đủ ngưỡng N + ExamResult đã ghi điểm IRT.
    irt_scores_available = False
    if irt_state["eligible"] and exam_result:
        irt_scores_available = (
            exam_result.score_method == "IRT"
            and exam_result.irt_score_part1 is not None
            and exam_result.irt_score_part2 is not None
            and exam_result.irt_score_part3 is not None
            and exam_result.irt_score_part4 is not None
        )
        if not irt_scores_available and irt_state["state"] == "done":
            irt_state = {
                "state": "computing",
                "eligible": False,
                "message": "Điểm thực đang chờ tính toán cho bài làm của bạn. Vui lòng quay lại sau.",
            }

    # 6. Xem lại đáp án — theo đúng permission "Quyền xem đáp án" hiện có
    can_view_answers = bool(getattr(current_user, "can_view_answers", False))
    review: Optional[list[dict[str, Any]]] = None
    if can_view_answers:
        review = await _build_review(db, participant, submission, exam_result)

    answered_count = 0
    if exam_result:
        item_scores = exam_result.item_scores or {}
        answered_count = sum(
            1 for v in item_scores.values() if v is not None and v != -1
        )

    return {
        "exam_id": exam_id,
        "exam_name": exam.name if exam else None,
        "submission_id": submission.id,
        "submit_time": submission.submit_time,
        "participant_status": participant.status.value,
        "is_suspended": participant.status == ParticipantStatus.SUSPENDED,
        "raw_scores": {
            "parts": parts,
            "total": raw_total,
            "max_total": 120,
            "answered_count": answered_count,
            "total_questions": 120,
            "method": exam_result.score_method if exam_result else "CTT",
        },
        "true_score": {
            "state": irt_state["state"],
            "eligible": irt_state["eligible"],
            "message": irt_state["message"],
            "available": irt_scores_available,
            "irt_total": (
                exam_result.total_score if irt_scores_available and exam_result else None
            ),
        },
        "can_view_answers": can_view_answers,
        "review": review,
    }

