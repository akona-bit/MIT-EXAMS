import random
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.exam import Matrix, MatrixRule, Exam, ExamForm, ExamFormQuestion, ExamFormAnswer
from app.models.question import Question, QuestionStatus, Answer

async def generate_original_exam(db: AsyncSession, matrix: Matrix, exam_name: str, exam_description: str) -> Exam:
    exam = Exam(
        name=exam_name,
        description=exam_description,
        matrix_id=matrix.id
    )
    db.add(exam)
    await db.flush() # get exam.id
    
    original_form = ExamForm(
        exam_id=exam.id,
        code="ORIGINAL",
        is_original=True
    )
    db.add(original_form)
    await db.flush()
    
    current_positions = {1: 1, 2: 31, 3: 61, 4: 91}
    
    for rule in matrix.rules:
        # Fetch matching questions
        from app.models.question import QuestionSkillTag
        from app.services.knowledge_service import KnowledgeService
        
        # Get all descendant leaves of the matrix rule's node (including the node itself)
        descendants = await KnowledgeService.get_all_descendant_leaves(db, [rule.knowledge_node_id])
        target_nodes = set([rule.knowledge_node_id] + descendants)
        
        stmt = select(Question).options(selectinload(Question.answers)).where(
            Question.skill_tags.any(QuestionSkillTag.knowledge_node_id.in_(target_nodes)),
            Question.type == rule.question_type,
            Question.level == rule.level,
            Question.status == QuestionStatus.APPROVED
        )
        result = await db.execute(stmt)
        available_questions = result.scalars().all()
        
        if len(available_questions) < rule.count:
            raise HTTPException(
                status_code=400, 
                detail=f"Not enough approved questions for node {rule.knowledge_node_id}, level {rule.level}, type {rule.question_type}. Required {rule.count}, found {len(available_questions)}"
            )
            
        selected_questions = random.sample(available_questions, rule.count)
        
        for q in selected_questions:
            pos = current_positions[rule.part]
            current_positions[rule.part] += 1
            
            form_q = ExamFormQuestion(
                exam_form_id=original_form.id,
                question_id=q.id,
                position=pos,
                part=rule.part
            )
            db.add(form_q)
            await db.flush()
            
            # Map answers originally 1 to N
            for i, ans in enumerate(q.answers):
                form_a = ExamFormAnswer(
                    exam_form_question_id=form_q.id,
                    answer_id=ans.id,
                    new_position=i + 1
                )
                db.add(form_a)
                
    await db.commit()
    return exam

async def generate_shuffled_forms(db: AsyncSession, original_form: ExamForm, number_of_forms: int):
    # Load original form with questions and answers
    stmt = select(ExamFormQuestion).options(selectinload(ExamFormQuestion.answers)).where(ExamFormQuestion.exam_form_id == original_form.id)
    result = await db.execute(stmt)
    orig_questions = result.scalars().all()
    
    # Group by part (dynamic, not hardcoded)
    from collections import defaultdict
    parts: dict[int, list] = defaultdict(list)
    for oq in orig_questions:
        parts[oq.part].append(oq)
    
    sorted_parts = sorted(parts.keys())
        
    for i in range(number_of_forms):
        new_code = str(101 + i)
        new_form = ExamForm(
            exam_id=original_form.exam_id,
            code=new_code,
            is_original=False
        )
        db.add(new_form)
        await db.flush()
        
        current_pos = 1
        for part_num in sorted_parts:
            part_questions = list(parts[part_num])
            random.shuffle(part_questions)
            
            for j, oq in enumerate(part_questions):
                new_pos = current_pos + j
                
                new_form_q = ExamFormQuestion(
                    exam_form_id=new_form.id,
                    question_id=oq.question_id,
                    position=new_pos,
                    part=part_num
                )
                db.add(new_form_q)
                await db.flush()
                
                # Shuffle answers
                orig_answers = list(oq.answers)
                random.shuffle(orig_answers)
                for k, oa in enumerate(orig_answers):
                    new_form_a = ExamFormAnswer(
                        exam_form_question_id=new_form_q.id,
                        answer_id=oa.answer_id,
                        new_position=k + 1
                    )
                    db.add(new_form_a)
            current_pos += len(part_questions)
                    
    await db.commit()
