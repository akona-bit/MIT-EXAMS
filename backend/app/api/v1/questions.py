from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from app.models.exam import ExamFormQuestion

from app.db.database import get_db
from app.models.user import User
from app.models.question import Question, Answer, QuestionStatus, QuestionType, KnowledgeNode, KnowledgeNodeType
from app.schemas.question import QuestionCreate, QuestionResponse, QuestionUpdate, QuestionReviewRequest, QuestionSimilarityResponse
from pydantic import BaseModel
from app.api.dependencies import RequireRole, get_current_active_user
from app.core.analytics import capture
from app.services.knowledge_service import KnowledgeService

router = APIRouter()

@router.get("/")
async def get_questions(
    skip: int = 0,
    limit: int = 100,
    knowledge_node_id: int | None = None,
    status: QuestionStatus | None = None,
    level: int | None = None,
    question_type: QuestionType | None = None,
    has_passage: bool | None = None,
    creator_id: int | None = None,
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
    if has_passage is not None:
        if has_passage:
            filters.append(Question.passage_id.isnot(None))
        else:
            filters.append(Question.passage_id.is_(None))
    if creator_id is not None:
        filters.append(Question.creator_id == creator_id)

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
    
    # Calculate usage_count for each question
    if items:
        question_ids = [q.id for q in items]
        usage_result = await db.execute(
            select(ExamFormQuestion.question_id, func.count(ExamFormQuestion.id))
            .where(ExamFormQuestion.question_id.in_(question_ids))
            .group_by(ExamFormQuestion.question_id)
        )
        usage_counts = dict(usage_result.all())
        for q in items:
            q.usage_count = usage_counts.get(q.id, 0)

    return {"items": items, "total": total, "page": (skip // limit) + 1 if limit else 1, "size": limit}


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Question).options(selectinload(Question.answers)).where(Question.id == question_id)
    )
    question = result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    usage_result = await db.execute(
        select(func.count(ExamFormQuestion.id))
        .where(ExamFormQuestion.question_id == question_id)
    )
    question.usage_count = usage_result.scalar() or 0
        
    return question

@router.get("/{question_id}/similarity", response_model=List[QuestionSimilarityResponse])
async def get_question_similarity(question_id: int, threshold: float = 0.3, limit: int = 10, db: AsyncSession = Depends(get_db)):
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        raise HTTPException(status_code=500, detail="Thư viện tính toán không khả dụng.")

    # 1. Fetch the target question
    result = await db.execute(select(Question).where(Question.id == question_id))
    target_q = result.scalars().first()
    if not target_q:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # 2. Fetch other questions (limit to same node_type or subject if needed, here we fetch all for simplicity or same knowledge_node)
    # To avoid performance issues, only compare within the same knowledge node.
    all_q_result = await db.execute(
        select(Question).where(
            Question.knowledge_node_id == target_q.knowledge_node_id,
            Question.id != target_q.id
        )
    )
    other_qs = all_q_result.scalars().all()
    
    if not other_qs:
        return []

    # 3. Compute TF-IDF
    texts = [target_q.content] + [q.content for q in other_qs]
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(texts)
    
    # Calculate cosine similarity of the first document (target) with the rest
    similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
    
    # 4. Filter and sort
    results = []
    for idx, sim in enumerate(similarities):
        if sim >= threshold:
            results.append({
                "question_id": other_qs[idx].id,
                "similarity_score": round(float(sim), 4),
                "content": other_qs[idx].content,
                "status": other_qs[idx].status.value
            })
            
    # Sort descending
    results.sort(key=lambda x: x["similarity_score"], reverse=True)
    return results[:limit]

class CheckDuplicateRequest(BaseModel):
    content: str
    knowledge_node_id: int

@router.post("/check-duplicate", response_model=List[QuestionSimilarityResponse])
async def check_duplicate(req: CheckDuplicateRequest, threshold: float = 0.8, db: AsyncSession = Depends(get_db)):
    from difflib import SequenceMatcher
    result = await db.execute(select(Question).where(Question.knowledge_node_id == req.knowledge_node_id))
    other_qs = result.scalars().all()
    results = []
    for q in other_qs:
        ratio = SequenceMatcher(None, req.content, q.content).ratio()
        if ratio >= threshold:
            results.append({
                "question_id": q.id,
                "similarity_score": round(ratio, 4),
                "content": q.content,
                "status": q.status.value
            })
    results.sort(key=lambda x: x["similarity_score"], reverse=True)
    return results[:10]


@router.post("/", response_model=QuestionResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_question(
    request: Request,
    q_in: QuestionCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Validation for SINGLE_CHOICE
    if q_in.type == QuestionType.SINGLE_CHOICE:
        if not q_in.answers or len(q_in.answers) != 4:
            raise HTTPException(status_code=400, detail="Câu hỏi SINGLE_CHOICE bắt buộc phải có đúng 4 đáp án.")
        if sum(1 for a in q_in.answers if a.is_correct) != 1:
            raise HTTPException(status_code=400, detail="Câu hỏi SINGLE_CHOICE bắt buộc phải có đúng 1 đáp án đúng.")

    # Validate knowledge node type is SKILL and it's a leaf
    kn_result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == q_in.knowledge_node_id))
    kn = kn_result.scalars().first()
    if not kn:
        raise HTTPException(status_code=400, detail="Knowledge Node không tồn tại.")
    if kn.node_type != KnowledgeNodeType.SKILL:
        raise HTTPException(status_code=400, detail="Câu hỏi chỉ được gắn vào chủ đề kiến thức dạng Kỹ năng (SKILL).")
    if not await KnowledgeService.is_leaf(db, q_in.knowledge_node_id):
        raise HTTPException(status_code=400, detail="Câu hỏi chỉ được gắn vào node lá (node không có con).")

    # Create question
    db_question = Question(
        content=q_in.content,
        level=q_in.level,
        type=q_in.type,
        knowledge_node_id=q_in.knowledge_node_id,
        resource_id=q_in.resource_id,
        source_author=q_in.source_author,
        source_title=q_in.source_title,
        creator_id=current_user.id,
        status=QuestionStatus.PENDING
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
    capture(
        request,
        "question_created",
        {"question_id": db_question.id, "question_type": db_question.type.value, "level": db_question.level},
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
            source_author=q_in.source_author if q_in.source_author is not None else existing_q.source_author,
            source_title=q_in.source_title if q_in.source_title is not None else existing_q.source_title,
            creator_id=current_user.id,
            status=QuestionStatus.PENDING,
            parent_question_id=existing_q.id # Linking to the old version
        )
        db.add(new_q)
        await db.commit()
        await db.refresh(new_q)
        
        # Add new answers
        answers_to_use = q_in.answers if q_in.answers is not None else [
            {"content": a.content, "is_correct": a.is_correct, "position": a.position} for a in existing_q.answers
        ]
        
        # Validation for SINGLE_CHOICE
        target_type = q_in.type if q_in.type is not None else existing_q.type
        if target_type == QuestionType.SINGLE_CHOICE:
            if not answers_to_use or len(answers_to_use) != 4:
                raise HTTPException(status_code=400, detail="Câu hỏi SINGLE_CHOICE bắt buộc phải có đúng 4 đáp án.")
            
            correct_count = 0
            for a in answers_to_use:
                is_correct = a.is_correct if hasattr(a, 'is_correct') else a.get("is_correct")
                if is_correct: correct_count += 1
                
            if correct_count != 1:
                raise HTTPException(status_code=400, detail="Câu hỏi SINGLE_CHOICE bắt buộc phải có đúng 1 đáp án đúng.")

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
        if q_in.source_author is not None: existing_q.source_author = q_in.source_author
        if q_in.source_title is not None: existing_q.source_title = q_in.source_title
        
        # Validate node_type is SKILL if changed
        if q_in.knowledge_node_id is not None and q_in.knowledge_node_id != existing_q.knowledge_node_id:
            kn_result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == q_in.knowledge_node_id))
            kn = kn_result.scalars().first()
            if not kn or kn.node_type != KnowledgeNodeType.SKILL:
                raise HTTPException(status_code=400, detail="Câu hỏi chỉ được gắn vào chủ đề kiến thức dạng Kỹ năng (SKILL).")
            if not await KnowledgeService.is_leaf(db, q_in.knowledge_node_id):
                raise HTTPException(status_code=400, detail="Câu hỏi chỉ được gắn vào node lá (node không có con).")
                
        target_type = existing_q.type
        
        if q_in.answers is not None:
            # Validation for SINGLE_CHOICE (when updating answers)
            if target_type == QuestionType.SINGLE_CHOICE:
                if len(q_in.answers) != 4:
                    raise HTTPException(status_code=400, detail="Câu hỏi SINGLE_CHOICE bắt buộc phải có đúng 4 đáp án.")
                if sum(1 for a in q_in.answers if a.is_correct) != 1:
                    raise HTTPException(status_code=400, detail="Câu hỏi SINGLE_CHOICE bắt buộc phải có đúng 1 đáp án đúng.")
                    
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

@router.post("/{question_id}/review", response_model=QuestionResponse, dependencies=[Depends(RequireRole(["ADMIN", "MODERATOR", "TEACHER"]))])
async def review_question(
    request: Request,
    question_id: int,
    payload: QuestionReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Question).options(selectinload(Question.answers)).where(Question.id == question_id))
    question = result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    if payload.approve and question.creator_id == current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không thể tự duyệt câu hỏi do chính mình tạo.")
        
    if payload.approve:
        question.status = QuestionStatus.APPROVED
        question.reject_reason = None
    else:
        question.status = QuestionStatus.REJECTED
        if payload.reject_reason:
            question.reject_reason = payload.reject_reason
            
    await db.commit()
    capture(request, "question_reviewed", {"question_id": question_id, "approved": payload.approve})
    return question


@router.post("/{question_id}/approve", response_model=QuestionResponse, dependencies=[Depends(RequireRole(["ADMIN", "MODERATOR"]))])
async def approve_question(request: Request, question_id: int, db: AsyncSession = Depends(get_db)):
    return await review_question(request=request, question_id=question_id, payload=QuestionReviewRequest(approve=True), db=db)

@router.get("/{question_id}/history", response_model=List[QuestionResponse])
async def get_question_history(question_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Question).options(selectinload(Question.answers)).where(Question.id == question_id))
    q = result.scalars().first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    history = []
    
    # Trace backwards (ancestors)
    curr = q.parent_question_id
    while curr:
        res = await db.execute(select(Question).options(selectinload(Question.answers)).where(Question.id == curr))
        ancestor = res.scalars().first()
        if not ancestor:
            break
        history.append(ancestor)
        curr = ancestor.parent_question_id

    # Ancestors are traced from parent to grandparent, reverse to get oldest first
    history.reverse()
    
    # Add current question
    history.append(q)
    
    # Trace forwards (descendants) using BFS
    queue = [question_id]
    visited = set([question_id])
    
    while queue:
        curr_id = queue.pop(0)
        res = await db.execute(select(Question).options(selectinload(Question.answers)).where(Question.parent_question_id == curr_id))
        children = res.scalars().all()
        for child in children:
            if child.id not in visited:
                history.append(child)
                queue.append(child.id)
                visited.add(child.id)
                
    # Sort by created_at
    history.sort(key=lambda x: x.created_at)
    return history
