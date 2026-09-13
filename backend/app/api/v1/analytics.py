"""
Analytics API — reads from database (ExamResult, ExamSubmission, ItemAnalysisResult).
Previously read from static CSV files; migrated to DB queries 2026-09-13.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_, desc
from app.db.database import get_db
from app.api.dependencies import RequireRole
from app.models.user import User
from app.models.exam import (
    ExamParticipant, ExamSubmission, ExamSubmissionAnswer,
    ExamFormQuestion, ExamForm, Exam,
)
from app.models.grading import ExamResult, ItemAnalysisResult
from app.models.question import Question, Answer

router = APIRouter(dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])


@router.get("/students")
async def get_students(
    search: str = Query("", description="Tìm kiếm theo tên, SBD hoặc email"),
    exam_id: int = Query(None, description="Lọc theo kỳ thi (optional)"),
    db: AsyncSession = Depends(get_db),
):
    """Tra cứu thí sinh — replaced CSV-based endpoint."""
    query = (
        select(
            User.id,
            User.full_name,
            User.username,
            User.email,
            ExamParticipant.sbd,
            ExamParticipant.exam_id,
            ExamResult.raw_total_score,
            ExamResult.irt_score_part1,
            ExamResult.irt_score_part2,
            ExamResult.irt_score_part3,
            ExamResult.irt_score_part4,
            ExamResult.total_score,
            ExamResult.score_method,
        )
        .join(ExamParticipant, ExamParticipant.user_id == User.id)
        .outerjoin(ExamSubmission, ExamSubmission.exam_participant_id == ExamParticipant.id)
        .outerjoin(ExamResult, ExamResult.exam_submission_id == ExamSubmission.id)
    )

    if exam_id:
        query = query.where(ExamParticipant.exam_id == exam_id)

    if search:
        like_pattern = f"%{search}%"
        query = query.where(
            (User.full_name.ilike(like_pattern))
            | (User.username.ilike(like_pattern))
            | (User.email.ilike(like_pattern))
            | (ExamParticipant.sbd.ilike(like_pattern))
        )

    query = query.order_by(User.full_name)
    result = await db.execute(query)
    rows = result.all()

    students = []
    for row in rows:
        students.append({
            "id": row.id,
            "name": row.full_name or row.username,
            "sbd": row.sbd,
            "email": row.email,
            "exam_id": row.exam_id,
            "raw_total": row.raw_total_score,
            "irt_part1": row.irt_score_part1,
            "irt_part2": row.irt_score_part2,
            "irt_part3": row.irt_score_part3,
            "irt_part4": row.irt_score_part4,
            "total_irt": row.total_score,
            "score_method": row.score_method,
        })

    return {"items": students}


@router.get("/class-summary")
async def get_class_summary(
    exam_id: int = Query(None, description="Lọc theo kỳ thi (optional)"),
    db: AsyncSession = Depends(get_db),
):
    """Summary stats — replaced CSV-based endpoint."""
    base_filter = []
    if exam_id:
        base_filter.append(ExamParticipant.exam_id == exam_id)

    # Total students with submissions
    total_q = (
        select(func.count(func.distinct(ExamParticipant.user_id)))
        .join(ExamSubmission, ExamSubmission.exam_participant_id == ExamParticipant.id)
    )
    if base_filter:
        total_q = total_q.where(and_(*base_filter))
    total_result = await db.execute(total_q)
    total_students = total_result.scalar() or 0

    # Average scores from ExamResult (IRT scores if available, else CTT)
    avg_q = select(
        func.avg(
            case(
                (ExamResult.score_method == "IRT", ExamResult.irt_score_part3),
                else_=ExamResult.ctt_score_part3,
            )
        ),
        func.avg(
            case(
                (ExamResult.score_method == "IRT", ExamResult.irt_score_part4),
                else_=ExamResult.ctt_score_part4,
            )
        ),
    ).join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
    avg_q = avg_q.join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
    if base_filter:
        avg_q = avg_q.where(and_(*base_filter))

    avg_result = await db.execute(avg_q)
    avg_row = avg_result.one()
    avg_toan = round(float(avg_row[0] or 0), 2)
    avg_tdkh = round(float(avg_row[1] or 0), 2)

    # Top 2 students
    top_q = (
        select(
            User.full_name,
            User.username,
            ExamResult.total_score,
            ExamResult.irt_score_part3,
            ExamResult.irt_score_part4,
        )
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .join(User, User.id == ExamParticipant.user_id)
        .where(ExamResult.score_method == "IRT")
    )
    if base_filter:
        top_q = top_q.where(and_(*base_filter))
    top_q = top_q.order_by(desc(ExamResult.total_score)).limit(2)
    top_result = await db.execute(top_q)
    top_rows = top_result.all()

    def _make_student(row, rank):
        if not row:
            return None
        return {
            "name": row.full_name or row.username,
            "irt_toan": float(row.irt_score_part3 or 0),
            "irt_tdkh": float(row.irt_score_part4 or 0),
            "total": float(row.total_score or 0),
            "rank": rank,
        }

    return {
        "total_students": total_students,
        "avg_toan": avg_toan,
        "avg_tdkh": avg_tdkh,
        "valedictorian": _make_student(top_rows[0] if top_rows else None, 1),
        "salutatorian": _make_student(top_rows[1] if len(top_rows) > 1 else None, 2),
    }


@router.get("/item-analysis")
async def get_item_analysis(
    exam_id: int = Query(None, description="Lọc theo kỳ thi"),
    db: AsyncSession = Depends(get_db),
):
    """
    Item analysis per question — reads from ItemAnalysisResult (DB) instead of CSV.
    Supports up to 120 questions (was hardcoded to 60).
    """
    if not exam_id:
        # Get most recent exam with results
        latest_q = (
            select(Exam.id)
            .join(ExamParticipant, ExamParticipant.exam_id == Exam.id)
            .join(ExamSubmission, ExamSubmission.exam_participant_id == ExamParticipant.id)
            .join(ExamResult, ExamResult.exam_submission_id == ExamSubmission.id)
            .order_by(desc(Exam.created_at))
            .limit(1)
        )
        latest_result = await db.execute(latest_q)
        exam_id = latest_result.scalar_one_or_none()
        if not exam_id:
            return {"items": []}

    # Query ItemAnalysisResult for this exam
    query = (
        select(
            ItemAnalysisResult,
            Question.public_code,
            Question.content,
        )
        .join(Question, Question.id == ItemAnalysisResult.question_id)
        .where(ItemAnalysisResult.exam_id == exam_id)
        .order_by(ItemAnalysisResult.question_id)
    )
    result = await db.execute(query)
    rows = result.all()

    if not rows:
        # Fallback: compute basic stats from submissions if no ItemAnalysisResult
        return await _compute_basic_item_analysis(exam_id, db)

    analysis = []
    for iar, public_code, content in rows:
        analysis.append({
            "question": public_code or f"Q{iar.question_id}",
            "question_id": iar.question_id,
            "correct_percent": round((iar.ctt_difficulty or 0) * 100, 1),
            "wrong_percent": round((1 - (iar.ctt_difficulty or 0)) * 100, 1),
            "empty_percent": 0,
            "correct_count": 0,
            "wrong_count": 0,
            "empty_count": 0,
            "difficulty": iar.ctt_difficulty,
            "discrimination": iar.ctt_discrimination,
            "irt_a": iar.irt_a,
            "irt_b": iar.irt_b,
            "chi_square_p": iar.chi_square_p,
        })

    return {"items": analysis, "exam_id": exam_id}


async def _compute_basic_item_analysis(exam_id: int, db: AsyncSession):
    """Fallback: compute item analysis directly from submissions when no ItemAnalysisResult exists."""
    # Get all submissions for this exam
    sub_ids_q = (
        select(ExamSubmission.id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamParticipant.exam_id == exam_id)
    )
    sub_result = await db.execute(sub_ids_q)
    submission_ids = [r[0] for r in sub_result.all()]

    if not submission_ids:
        return {"items": [], "exam_id": exam_id}

    # Get form questions for this exam
    form_q = (
        select(ExamFormQuestion, Question.public_code)
        .join(ExamForm, ExamForm.id == ExamFormQuestion.exam_form_id)
        .join(Question, Question.id == ExamFormQuestion.question_id)
        .where(ExamForm.exam_id == exam_id)
    )
    form_result = await db.execute(form_q)
    form_questions = form_result.all()

    analysis = []
    for fq, public_code in form_questions:
        # Count correct/wrong/empty for this question across all submissions
        ans_q = (
            select(
                func.count(ExamSubmissionAnswer.id).label("total"),
                func.sum(case((ExamSubmissionAnswer.is_correct == True, 1), else_=0)).label("correct_count"),
            )
            .where(
                ExamSubmissionAnswer.exam_form_question_id == fq.id,
                ExamSubmissionAnswer.exam_submission_id.in_(submission_ids),
            )
        )
        ans_result = await db.execute(ans_q)
        row = ans_result.one()
        total = row.total or 0
        correct_count = row.correct_count or 0
        wrong_count = total - correct_count

        analysis.append({
            "question": public_code or f"Q{fq.question_id}",
            "question_id": fq.question_id,
            "correct_percent": round(correct_count / total * 100, 1) if total > 0 else 0,
            "wrong_percent": round(wrong_count / total * 100, 1) if total > 0 else 0,
            "empty_percent": 0,
            "correct_count": int(correct_count),
            "wrong_count": int(wrong_count),
            "empty_count": 0,
        })

    return {"items": analysis, "exam_id": exam_id}


@router.get("/responses/{name_or_email}")
async def get_student_responses(
    name_or_email: str,
    exam_id: int = Query(None, description="Lọc theo kỳ thi"),
    db: AsyncSession = Depends(get_db),
):
    """Student response detail — replaced CSV-based endpoint."""
    query = name_or_email.lower().strip()

    # Find student by name, email, or SBD
    user_q = select(User).where(
        (User.full_name.ilike(f"%{query}%"))
        | (User.email.ilike(f"%{query}%"))
        | (User.username.ilike(f"%{query}%"))
    )
    user_result = await db.execute(user_q)
    user = user_result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    # Get participant's submissions
    sub_q = (
        select(ExamSubmission, ExamParticipant, ExamForm)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .outerjoin(ExamForm, ExamForm.id == ExamParticipant.exam_form_id)
        .where(ExamParticipant.user_id == user.id)
    )
    if exam_id:
        sub_q = sub_q.where(ExamParticipant.exam_id == exam_id)
    sub_q = sub_q.order_by(ExamSubmission.submit_time.desc()).limit(1)

    sub_result = await db.execute(sub_q)
    sub_row = sub_result.first()

    if not sub_row:
        raise HTTPException(status_code=404, detail="No submissions found for this student")

    submission, participant, exam_form = sub_row

    # Get answers for this submission
    ans_q = (
        select(
            ExamSubmissionAnswer,
            ExamFormQuestion.position,
            Question.public_code,
        )
        .join(ExamFormQuestion, ExamFormQuestion.id == ExamSubmissionAnswer.exam_form_question_id)
        .join(Question, Question.id == ExamFormQuestion.question_id)
        .where(ExamSubmissionAnswer.exam_submission_id == submission.id)
        .order_by(ExamFormQuestion.position)
    )
    ans_result = await db.execute(ans_q)
    answer_rows = ans_result.all()

    responses = {}
    for ans, position, public_code in answer_rows:
        label = public_code or f"Câu {position}"
        if ans.selected_answer_id is None:
            status = "empty"
        elif ans.is_correct:
            status = "correct"
        else:
            status = "wrong"
        responses[label] = status

    return {
        "name": user.full_name or user.username,
        "email": user.email,
        "sbd": participant.sbd,
        "form_code": exam_form.code if exam_form else None,
        "responses": responses,
    }
