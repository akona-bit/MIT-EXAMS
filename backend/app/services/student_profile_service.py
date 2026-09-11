from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import Optional
from datetime import datetime, timezone

from app.models.user import User
from app.models.access import AnswerAccessGrant

async def can_view_answers(
    db: AsyncSession,
    requester: User,
    student_id: int,
    exam_id: Optional[int] = None,
) -> bool:
    """
    Kiểm tra xem requester có quyền xem đáp án của student_id trong kỳ thi exam_id hay không.
    """
    if requester.role.name in ("ADMIN", "TEACHER", "SUPERADMIN"):
        return True
        
    if requester.id != student_id:
        return False  # Học sinh không được xem của người khác
    now = datetime.now(timezone.utc)
    
    # get active grant
    stmt = select(AnswerAccessGrant).where(
        AnswerAccessGrant.student_id == student_id,
        AnswerAccessGrant.granted == True,
        AnswerAccessGrant.granted_at <= now,
        or_(
            AnswerAccessGrant.expires_at == None,
            AnswerAccessGrant.expires_at > now
        ),
        or_(
            AnswerAccessGrant.exam_id == None,
            AnswerAccessGrant.exam_id == exam_id if exam_id else False
        )
    )
    
    result = await db.execute(stmt)
    grant = result.scalars().first()
    
    return grant is not None

async def update_student_topic_mastery(db: AsyncSession, submission_id: int):
    """
    Cập nhật bảng student_topic_mastery sau khi chấm bài xong.
    """
    from app.models.student_profile import StudentTopicMastery
    from app.models.exam import ExamSubmission, ExamParticipant, ExamSubmissionAnswer, ExamFormQuestion, Exam
    from app.models.question import Question
    from sqlalchemy.dialects.postgresql import insert

    # Get user_id and exam_id
    res = await db.execute(
        select(ExamParticipant.user_id, ExamParticipant.exam_id)
        .join(ExamSubmission, ExamSubmission.exam_participant_id == ExamParticipant.id)
        .where(ExamSubmission.id == submission_id)
    )
    part = res.first()
    if not part:
        return
    user_id, exam_id = part

    # Query all answers for this submission
    res2 = await db.execute(
        select(Question.knowledge_node_id, ExamSubmissionAnswer.score, ExamSubmissionAnswer.selected_answer_id, Question.id)
        .join(ExamFormQuestion, ExamFormQuestion.id == ExamSubmissionAnswer.exam_form_question_id)
        .join(Question, Question.id == ExamFormQuestion.question_id)
        .where(ExamSubmissionAnswer.exam_submission_id == submission_id, Question.knowledge_node_id != None)
    )
    answers = res2.all()
    
    node_stats = {}
    last_wrongs = {}
    
    for kn_id, score, sel_ans_id, q_id in answers:
        if kn_id not in node_stats:
            node_stats[kn_id] = {"correct": 0, "wrong": 0, "blank": 0, "attempt": 0}
            
        node_stats[kn_id]["attempt"] += 1
        is_correct = score is not None and score > 0
        if is_correct:
            node_stats[kn_id]["correct"] += 1
        elif sel_ans_id is None:
            node_stats[kn_id]["blank"] += 1
        else:
            node_stats[kn_id]["wrong"] += 1
            last_wrongs[kn_id] = q_id

    # Upsert logic
    for kn_id, stats in node_stats.items():
        # Get existing
        existing = (await db.execute(select(StudentTopicMastery).where(
            StudentTopicMastery.user_id == user_id, 
            StudentTopicMastery.knowledge_node_id == kn_id
        ))).scalar_one_or_none()
        
        if existing:
            existing.wrong_count += stats["wrong"]
            existing.blank_count += stats["blank"]
            existing.attempt_count += stats["attempt"]
            if kn_id in last_wrongs:
                existing.last_wrong_question_id = last_wrongs[kn_id]
                existing.last_wrong_exam_id = exam_id
                
            # Compute new status based on error rate
            err_rate = (existing.wrong_count + existing.blank_count) / existing.attempt_count if existing.attempt_count > 0 else 0
            if err_rate > 0.5:
                existing.status = "overdue_review"
            elif err_rate > 0.2:
                existing.status = "upcoming_review"
            else:
                existing.status = "on_track"
        else:
            err_rate = (stats["wrong"] + stats["blank"]) / stats["attempt"] if stats["attempt"] > 0 else 0
            status = "on_track"
            if err_rate > 0.5:
                status = "overdue_review"
            elif err_rate > 0.2:
                status = "upcoming_review"
                
            new_record = StudentTopicMastery(
                user_id=user_id,
                knowledge_node_id=kn_id,
                status=status,
                wrong_count=stats["wrong"],
                blank_count=stats["blank"],
                attempt_count=stats["attempt"],
                last_wrong_question_id=last_wrongs.get(kn_id),
                last_wrong_exam_id=exam_id if kn_id in last_wrongs else None
            )
            db.add(new_record)
            
    await db.commit()
