from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.db.database import get_db
from app.models.user import User
from app.models.exam import Exam, ExamForm, ExamParticipant, ExamSubmission, ExamStatus, ParticipantStatus
from app.models.grading import ExamResult

router = APIRouter()


@router.get("/")
async def search_exams(
    q: str = Query(..., min_length=1, description="Search by name or email"),
    db: AsyncSession = Depends(get_db),
):
    """
    Search exams and students by name or email.
    Returns:
    - Exams matching the query
    - Student results with scores and rankings
    """
    search_term = f"%{q}%"

    # 1. Search exams by name
    exam_stmt = (
        select(Exam)
        .where(
            Exam.name.ilike(search_term),
            Exam.status.in_([ExamStatus.PUBLISHED, ExamStatus.COMPLETED])
        )
        .order_by(Exam.created_at.desc())
        .limit(10)
    )
    exam_result = await db.execute(exam_stmt)
    exams = exam_result.scalars().all()

    # 2. Search students by name or email
    user_stmt = (
        select(User)
        .where(
            or_(
                User.full_name.ilike(search_term),
                User.email.ilike(search_term)
            ),
            User.is_active == True
        )
        .limit(10)
    )
    user_result = await db.execute(user_stmt)
    users = user_result.scalars().all()

    # 3. Get exam results for found users
    student_results = []
    if users:
        user_ids = [u.id for u in users]

        # Get all exam participations for these users
        participation_stmt = (
            select(
                ExamParticipant,
                Exam,
                ExamResult,
                ExamForm
            )
            .join(Exam, Exam.id == ExamParticipant.exam_id)
            .outerjoin(ExamSubmission, ExamSubmission.exam_participant_id == ExamParticipant.id)
            .outerjoin(ExamResult, ExamResult.exam_submission_id == ExamSubmission.id)
            .outerjoin(ExamForm, ExamForm.id == ExamParticipant.exam_form_id)
            .where(
                ExamParticipant.user_id.in_(user_ids),
                ExamParticipant.status.in_([ParticipantStatus.SUBMITTED, ParticipantStatus.IN_PROGRESS])
            )
            .order_by(Exam.created_at.desc())
        )
        part_result = await db.execute(participation_stmt)
        participations = part_result.all()

        # Group by user
        from collections import defaultdict
        user_exams = defaultdict(list)

        for participant, exam, exam_result, exam_form in participations:
            score = None
            if exam_result:
                if exam_result.total_score is not None:
                    score = exam_result.total_score
                else:
                    score = (exam_result.ctt_score_part1 or 0) + (exam_result.ctt_score_part2 or 0) + \
                            (exam_result.ctt_score_part3 or 0) + (exam_result.ctt_score_part4 or 0)

            user_exams[participant.user_id].append({
                "exam_id": exam.id,
                "exam_name": exam.name,
                "exam_code": exam_form.code if exam_form else None,
                "attempt_number": participant.attempt_number,
                "status": participant.status.value,
                "score": round(score, 2) if score else None,
                "max_score": 1200,
                "date": (participant.submit_time or exam.created_at).isoformat() if participant.submit_time else exam.created_at.isoformat(),
            })

        # Calculate rankings for each exam
        exam_rankings = {}
        all_exam_ids = set()
        for user_exam_list in user_exams.values():
            for exam_data in user_exam_list:
                all_exam_ids.add(exam_data["exam_id"])

        for exam_id in all_exam_ids:
            rank_stmt = (
                select(
                    ExamParticipant.user_id,
                    func.coalesce(ExamResult.total_score,
                        (ExamResult.ctt_score_part1 + ExamResult.ctt_score_part2 +
                         ExamResult.ctt_score_part3 + ExamResult.ctt_score_part4)
                    ).label("score")
                )
                .join(ExamSubmission, ExamSubmission.exam_participant_id == ExamParticipant.id)
                .join(ExamResult, ExamResult.exam_submission_id == ExamSubmission.id)
                .where(
                    ExamParticipant.exam_id == exam_id,
                    ExamParticipant.status == ParticipantStatus.SUBMITTED
                )
                .order_by(func.coalesce(ExamResult.total_score,
                    (ExamResult.ctt_score_part1 + ExamResult.ctt_score_part2 +
                     ExamResult.ctt_score_part3 + ExamResult.ctt_score_part4)
                ).desc())
            )
            rank_result = await db.execute(rank_stmt)
            all_scores = rank_result.all()

            rankings = {}
            current_rank = 1
            prev_score = None
            for i, (uid, score) in enumerate(all_scores):
                if score != prev_score:
                    current_rank = i + 1
                rankings[uid] = current_rank
                prev_score = score

            exam_rankings[exam_id] = rankings

        # Add rank to each exam data
        for user_exam_list in user_exams.values():
            for exam_data in user_exam_list:
                exam_id = exam_data["exam_id"]
                uid = [k for k, v in user_exams.items() if exam_data in v][0]
                exam_data["rank"] = exam_rankings.get(exam_id, {}).get(uid, None)

        # Build student results
        for user in users:
            student_results.append({
                "user_id": user.id,
                "full_name": user.full_name,
                "exams": user_exams.get(user.id, [])
            })

    # 4. Format exam results
    exam_results = []
    for exam in exams:
        # Get submission count
        sub_count_stmt = (
            select(func.count(ExamSubmission.id))
            .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
            .where(ExamParticipant.exam_id == exam.id)
        )
        sub_count_result = await db.execute(sub_count_stmt)
        submission_count = sub_count_result.scalar() or 0

        # Get form codes
        forms_stmt = select(ExamForm.code).where(ExamForm.exam_id == exam.id)
        forms_result = await db.execute(forms_stmt)
        form_codes = [row[0] for row in forms_result.all()]

        exam_results.append({
            "id": exam.id,
            "name": exam.name,
            "status": exam.status.value,
            "start_time": exam.start_time.isoformat() if exam.start_time else None,
            "end_time": exam.end_time.isoformat() if exam.end_time else None,
            "duration_minutes": exam.duration_minutes,
            "submission_count": submission_count,
            "form_codes": form_codes,
        })

    return {
        "exams": exam_results,
        "students": student_results,
        "query": q
    }
