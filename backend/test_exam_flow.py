import os, sys, asyncio
sys.path.append(os.getcwd())
from app.db.database import async_session_maker
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.models.exam import ExamParticipant, ExamSubmission, ExamSubmissionAnswer, ExamFormQuestion, ParticipantStatus, ExamForm, ExamFormAnswer
from app.models.question import Answer, QuestionType, Question
from app.services.grading.scorer import grade_submission_ctt
from datetime import datetime, timezone
import random

async def test_flow():
    async with async_session_maker() as session:
        # Get one participant
        res = await session.execute(
            select(ExamParticipant)
            .options(
                selectinload(ExamParticipant.exam_form).selectinload(ExamForm.questions),
                selectinload(ExamParticipant.exam)
            )
            .where(ExamParticipant.status == ParticipantStatus.NOT_STARTED)
            .limit(1)
        )
        p = res.scalar_one_or_none()
        if not p:
            print("No participant found!")
            return
            
        print(f"Testing for Participant ID {p.id}, Form {p.exam_form_id}")
        
        # Load form questions and answers
        res = await session.execute(
            select(ExamFormQuestion)
            .options(
                selectinload(ExamFormQuestion.answers),
                selectinload(ExamFormQuestion.question_ref).selectinload(Question.sub_items)
            )
            .where(ExamFormQuestion.exam_form_id == p.exam_form_id)
        )
        fqs = res.scalars().unique().all()
        print(f"Found {len(fqs)} form questions.")
        
        # FIX: My setup_test_exam didn't create ExamFormAnswer. Let's create them now if missing!
        for fq in fqs:
            if not fq.answers:
                # Need to create ExamFormAnswer
                res = await session.execute(select(Answer).where(Answer.question_id == fq.question_id))
                orig_answers = res.scalars().all()
                for k, oa in enumerate(orig_answers):
                    form_a = ExamFormAnswer(
                        exam_form_question_id=fq.id,
                        answer_id=oa.id,
                        new_position=k + 1
                    )
                    session.add(form_a)
        await session.commit()
        
        # Reload fqs
        res = await session.execute(
            select(ExamFormQuestion)
            .options(
                selectinload(ExamFormQuestion.answers),
                selectinload(ExamFormQuestion.question_ref).selectinload(Question.sub_items)
            )
            .where(ExamFormQuestion.exam_form_id == p.exam_form_id)
        )
        fqs = res.scalars().unique().all()
        
        # Create submission
        sub = ExamSubmission(
            exam_participant_id=p.id,
            submit_time=datetime.now(timezone.utc)
        )
        session.add(sub)
        await session.flush()
        
        for fq in fqs:
            q = fq.question_ref
            qtype = q.type
            
            # Load original answers for this question
            res = await session.execute(
                select(Answer).where(Answer.question_id == q.id)
            )
            orig_answers = res.scalars().all()
            
            if qtype == QuestionType.SINGLE_CHOICE:
                correct_id = next((a.id for a in orig_answers if a.is_correct and a.sub_item_id is None), None)
                ans = ExamSubmissionAnswer(
                    exam_submission_id=sub.id,
                    exam_form_question_id=fq.id,
                    selected_answer_id=correct_id
                )
                session.add(ans)
                
            elif qtype == QuestionType.TRUE_FALSE or qtype == QuestionType.COMPOSITE:
                subitems = q.sub_items
                sel_dict = {}
                for si in subitems:
                    # find correct answer for this subitem
                    correct_id = next((a.id for a in orig_answers if a.is_correct and a.sub_item_id == si.id), None)
                    if correct_id:
                        sel_dict[str(si.id)] = correct_id
                
                ans = ExamSubmissionAnswer(
                    exam_submission_id=sub.id,
                    exam_form_question_id=fq.id,
                    selected_subitem_answers=sel_dict
                )
                session.add(ans)
        
        p.status = ParticipantStatus.SUBMITTED
        await session.flush()
        sub_id = sub.id
        await session.commit()
        
        print(f"Submission created with ID {sub_id}")
        
    # Grade it
    async with async_session_maker() as session:
        res = await grade_submission_ctt(session, sub_id)
        print("Grading Result:")
        print(f"Total points: {res.total_points}")
        print(f"Raw Total Score: {res.raw_total_score}")
        print(f"Item points: {res.item_points}")
        print(f"Item scores: {res.item_scores}")
        print(f"Subitem scores: {res.item_subitem_scores}")

asyncio.run(test_flow())
