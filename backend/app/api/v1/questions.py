from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.user import User
from app.models.question import Question, Answer, QuestionStatus, QuestionType
from app.schemas.question import QuestionCreate, QuestionResponse, QuestionUpdate
from app.api.dependencies import RequireRole, get_current_active_user

router = APIRouter()

@router.get("/")
async def get_questions(
    skip: int = 0,
    limit: int = 100,
    knowledge_node_id: int | None = None,
    status: QuestionStatus | None = None,
    level: int | None = None,
    question_type: QuestionType | None = None,
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if knowledge_node_id is not None:
        filters.append(Question.knowledge_node_id == knowledge_node_id)
    if status is not None:
        filters.append(Question.status == status)
    if level is not None:
        filters.append(Question.level == level)
    if question_type is not None:
        filters.append(Question.type == question_type)

    total_result = await db.execute(select(func.count()).select_from(Question).where(*filters))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Question)
        .options(selectinload(Question.answers))
        .where(*filters)
        .order_by(Question.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    items = result.scalars().all()
    return {"items": items, "total": total, "page": (skip // limit) + 1 if limit else 1, "size": limit}


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Question).options(selectinload(Question.answers)).where(Question.id == question_id)
    )
    question = result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question

@router.post("/", response_model=QuestionResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_question(
    q_in: QuestionCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Create question
    db_question = Question(
        content=q_in.content,
        level=q_in.level,
        type=q_in.type,
        knowledge_node_id=q_in.knowledge_node_id,
        resource_id=q_in.resource_id,
        creator_id=current_user.id,
        status=QuestionStatus.DRAFT
    )
    db.add(db_question)
    await db.commit()
    await db.refresh(db_question)
    
    # Create answers
    for ans in q_in.answers:
        db_ans = Answer(
            question_id=db_question.id,
            content=ans.content,
            is_correct=ans.is_correct,
            position=ans.position
        )
        db.add(db_ans)
    
    await db.commit()
    
    # Reload with answers
    result = await db.execute(
        select(Question).options(selectinload(Question.answers)).where(Question.id == db_question.id)
    )
    return result.scalars().first()

@router.put("/{question_id}", response_model=QuestionResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def update_question(
    question_id: int,
    q_in: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Find existing question
    result = await db.execute(
        select(Question).options(selectinload(Question.answers)).where(Question.id == question_id)
    )
    existing_q = result.scalars().first()
    
    if not existing_q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    # VERSIONING RULE: If APPROVED or used in an exam, clone it.
    if existing_q.status == QuestionStatus.APPROVED:
        # Clone into a new question
        new_q = Question(
            content=q_in.content if q_in.content is not None else existing_q.content,
            level=q_in.level if q_in.level is not None else existing_q.level,
            type=q_in.type if q_in.type is not None else existing_q.type,
            knowledge_node_id=q_in.knowledge_node_id if q_in.knowledge_node_id is not None else existing_q.knowledge_node_id,
            resource_id=q_in.resource_id if q_in.resource_id is not None else existing_q.resource_id,
            creator_id=current_user.id,
            status=QuestionStatus.DRAFT,
            parent_question_id=existing_q.id # Linking to the old version
        )
        db.add(new_q)
        await db.commit()
        await db.refresh(new_q)
        
        # Add new answers
        answers_to_use = q_in.answers if q_in.answers is not None else [
            {"content": a.content, "is_correct": a.is_correct, "position": a.position} for a in existing_q.answers
        ]
        
        for ans in answers_to_use:
            # If from Pydantic schema, it's an object. If copied from old, it's dict.
            content = ans.content if hasattr(ans, 'content') else ans["content"]
            is_correct = ans.is_correct if hasattr(ans, 'is_correct') else ans["is_correct"]
            position = ans.position if hasattr(ans, 'position') else ans["position"]
            
            db_ans = Answer(
                question_id=new_q.id,
                content=content,
                is_correct=is_correct,
                position=position
            )
            db.add(db_ans)
            
        await db.commit()
        
        # Return the new version
        res = await db.execute(select(Question).options(selectinload(Question.answers)).where(Question.id == new_q.id))
        return res.scalars().first()
    else:
        # Just update in place for DRAFT or PENDING
        if q_in.content is not None: existing_q.content = q_in.content
        if q_in.level is not None: existing_q.level = q_in.level
        if q_in.type is not None: existing_q.type = q_in.type
        if q_in.knowledge_node_id is not None: existing_q.knowledge_node_id = q_in.knowledge_node_id
        if q_in.resource_id is not None: existing_q.resource_id = q_in.resource_id
        
        if q_in.answers is not None:
            # Delete old answers
            for a in existing_q.answers:
                await db.delete(a)
            # Add new answers
            for ans in q_in.answers:
                db_ans = Answer(
                    question_id=existing_q.id,
                    content=ans.content,
                    is_correct=ans.is_correct,
                    position=ans.position
                )
                db.add(db_ans)
                
        await db.commit()
        res = await db.execute(select(Question).options(selectinload(Question.answers)).where(Question.id == existing_q.id))
        return res.scalars().first()


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def delete_question(question_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(question)
    await db.commit()
    return None

@router.post("/{question_id}/review", response_model=QuestionResponse, dependencies=[Depends(RequireRole(["ADMIN", "MODERATOR"]))])
async def review_question(
    question_id: int,
    approve: bool,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Question).options(selectinload(Question.answers)).where(Question.id == question_id))
    question = result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    question.status = QuestionStatus.APPROVED if approve else QuestionStatus.REJECTED
    await db.commit()
    return question


@router.post("/{question_id}/approve", response_model=QuestionResponse, dependencies=[Depends(RequireRole(["ADMIN", "MODERATOR"]))])
async def approve_question(question_id: int, db: AsyncSession = Depends(get_db)):
    return await review_question(question_id=question_id, approve=True, db=db)
