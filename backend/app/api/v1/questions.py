from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from app.models.exam import ExamFormQuestion

from app.db.database import get_db
from app.models.user import User
from app.models.question import Question, Answer, QuestionStatus, QuestionType, KnowledgeNode, KnowledgeNodeType, QuestionSkillTag
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
        filters.append(Question.skill_tags.any(QuestionSkillTag.knowledge_node_id == knowledge_node_id))
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
        select(Question).options(selectinload(Question.answers), selectinload(Question.skill_tags)).where(Question.id == question_id)
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
    
    # 2. Fetch other questions
    target_skill_ids = [tag.knowledge_node_id for tag in target_q.skill_tags]
    if not target_skill_ids:
        return []
        
    all_q_result = await db.execute(
        select(Question).where(
            Question.skill_tags.any(QuestionSkillTag.knowledge_node_id.in_(target_skill_ids)),
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
from app.services.embedding_service import generate_embedding, search_similar_questions

@router.post("/check-duplicate", response_model=List[QuestionSimilarityResponse])
async def check_duplicate(req: CheckDuplicateRequest, threshold: float = 0.3, db: AsyncSession = Depends(get_db)):
    # Generate embedding for the new question content
    try:
        emb = await generate_embedding(req.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate embedding: {str(e)}")
        
    # Search for similar questions in the DB
    results = await search_similar_questions(
        db=db,
        query_embedding=emb,
        limit=10,
        similarity_threshold=threshold
    )
    
    # Optional: Filter by knowledge_node_id if needed, but semantic search is usually global.
    # We can keep it global or pass a list of IDs to search_similar_questions.
    
    # Format to match QuestionSimilarityResponse
    formatted_results = []
    for r in results:
        formatted_results.append({
            "question_id": r["question_id"],
            "similarity_score": r["similarity"],
            "content": r["content"],
            "status": r["status"]
        })
        
    return formatted_results

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
    kn_result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == q_in.primary_knowledge_node_id))
    kn = kn_result.scalars().first()
    if not kn:
        raise HTTPException(status_code=400, detail="Primary Knowledge Node không tồn tại.")
    if kn.node_type != KnowledgeNodeType.SKILL:
        raise HTTPException(status_code=400, detail="Câu hỏi chỉ được gắn vào chủ đề kiến thức dạng Kỹ năng (SKILL).")
    if not await KnowledgeService.is_leaf(db, q_in.primary_knowledge_node_id):
        raise HTTPException(status_code=400, detail="Câu hỏi chỉ được gắn vào node lá (node không có con).")

    # Resolve knowledge node path for public_code
    kn_path = await KnowledgeService.calculate_path_code(db, q_in.primary_knowledge_node_id)
    # Get next sequence number for this path
    seq_result = await db.execute(
        select(func.count()).select_from(Question).where(
            Question.public_code.like(f"{kn_path}-%")
        )
    )
    next_seq = (seq_result.scalar() or 0) + 1
    auto_public_code = f"{kn_path}-{next_seq:03d}"

    # Create question
    db_question = Question(
        public_code=auto_public_code,
        content=q_in.content,
        level=q_in.level,
        type=q_in.type,
        resource_id=q_in.resource_id,
        source_author=q_in.source_author,
        source_title=q_in.source_title,
        creator_id=current_user.id,
        status=QuestionStatus.PENDING
    )
    db.add(db_question)
    await db.commit()
    await db.refresh(db_question)
    
    # Create tags
    primary_tag = QuestionSkillTag(question_id=db_question.id, knowledge_node_id=q_in.primary_knowledge_node_id, is_primary=True)
    db.add(primary_tag)
    for sec_id in q_in.secondary_knowledge_node_ids:
        if sec_id != q_in.primary_knowledge_node_id:
            db.add(QuestionSkillTag(question_id=db_question.id, knowledge_node_id=sec_id, is_primary=False))
    
    
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
    
    # Generate and save embedding in background or immediately
    try:
        from app.services.embedding_service import upsert_embedding
        emb = await generate_embedding(db_question.content)
        await upsert_embedding(db, db_question.id, db_question.content, emb)
    except Exception as e:
        print(f"Warning: Failed to generate embedding for question {db_question.id}: {e}")

    # Reload with answers and tags
    result = await db.execute(
        select(Question).options(selectinload(Question.answers), selectinload(Question.skill_tags)).where(Question.id == db_question.id)
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
        select(Question).options(selectinload(Question.answers), selectinload(Question.skill_tags)).where(Question.id == question_id)
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
        
        # Add skill tags
        if q_in.primary_knowledge_node_id is not None:
            primary_id = q_in.primary_knowledge_node_id
            secondary_ids = q_in.secondary_knowledge_node_ids or []
        else:
            primary_tag = next((t for t in existing_q.skill_tags if t.is_primary), None)
            primary_id = primary_tag.knowledge_node_id if primary_tag else None
            secondary_ids = [t.knowledge_node_id for t in existing_q.skill_tags if not t.is_primary]
            
        if primary_id:
            db.add(QuestionSkillTag(question_id=new_q.id, knowledge_node_id=primary_id, is_primary=True))
            for sec_id in secondary_ids:
                if sec_id != primary_id:
                    db.add(QuestionSkillTag(question_id=new_q.id, knowledge_node_id=sec_id, is_primary=False))
        
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
        
        # Generate and save embedding in background or immediately
        try:
            from app.services.embedding_service import upsert_embedding
            emb = await generate_embedding(new_q.content)
            await upsert_embedding(db, new_q.id, new_q.content, emb)
        except Exception as e:
            print(f"Warning: Failed to generate embedding for question {new_q.id}: {e}")
        
        # Return the new version
        res = await db.execute(select(Question).options(selectinload(Question.answers), selectinload(Question.skill_tags)).where(Question.id == new_q.id))
        return res.scalars().first()
    else:
        # Just update in place for DRAFT or PENDING
        if q_in.content is not None: existing_q.content = q_in.content
        if q_in.level is not None: existing_q.level = q_in.level
        if q_in.type is not None: existing_q.type = q_in.type
        if q_in.resource_id is not None: existing_q.resource_id = q_in.resource_id
        if q_in.source_author is not None: existing_q.source_author = q_in.source_author
        if q_in.source_title is not None: existing_q.source_title = q_in.source_title
        
        if q_in.primary_knowledge_node_id is not None:
            kn_result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == q_in.primary_knowledge_node_id))
            kn = kn_result.scalars().first()
            if not kn or kn.node_type != KnowledgeNodeType.SKILL:
                raise HTTPException(status_code=400, detail="Câu hỏi chỉ được gắn vào chủ đề kiến thức dạng Kỹ năng (SKILL).")
            if not await KnowledgeService.is_leaf(db, q_in.primary_knowledge_node_id):
                raise HTTPException(status_code=400, detail="Câu hỏi chỉ được gắn vào node lá (node không có con).")
                
            # Delete old tags
            for tag in existing_q.skill_tags:
                await db.delete(tag)
                
            # Add new tags
            primary_id = q_in.primary_knowledge_node_id
            secondary_ids = q_in.secondary_knowledge_node_ids or []
            db.add(QuestionSkillTag(question_id=existing_q.id, knowledge_node_id=primary_id, is_primary=True))
            for sec_id in secondary_ids:
                if sec_id != primary_id:
                    db.add(QuestionSkillTag(question_id=existing_q.id, knowledge_node_id=sec_id, is_primary=False))
                
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
        
        # Generate and save embedding in background or immediately
        try:
            from app.services.embedding_service import upsert_embedding
            emb = await generate_embedding(existing_q.content)
            await upsert_embedding(db, existing_q.id, existing_q.content, emb)
        except Exception as e:
            print(f"Warning: Failed to generate embedding for question {existing_q.id}: {e}")
            
        res = await db.execute(select(Question).options(selectinload(Question.answers), selectinload(Question.skill_tags)).where(Question.id == existing_q.id))
        return res.scalars().first()


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def delete_question(question_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if question.creator_id != current_user.id and not current_user.role_id in [1, 2, 3]: # ADMIN, TEACHER, MODERATOR
        raise HTTPException(status_code=403, detail="Not enough permissions")

    await db.delete(question)
    await db.commit()
    return {"status": "success"}

from app.schemas.ai import AiAnalysisResponse
from app.services.ai_analysis import (
    get_fully_loaded_question,
    compute_question_hash,
    get_cached_analysis,
    analyze_question_with_gemini,
    log_ai_request
)
from app.models.ai import AiAnalysisCache, AiReviewStatus

@router.post("/{question_id}/analyze", response_model=AiAnalysisResponse)
async def analyze_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Trigger AI analysis for a specific question.
    Only Teachers and Admins can perform this action.
    """
    if current_user.role_id not in [1, 2]: # Assuming 1: Admin, 2: Teacher
        raise HTTPException(status_code=403, detail="Only teachers and admins can analyze questions")
        
    question = await get_fully_loaded_question(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    # Calculate hash
    content_hash = compute_question_hash(question)
    
    # Check cache first
    cached_result = await get_cached_analysis(db, content_hash)
    if cached_result:
        return cached_result
        
    # Not in cache or usable cache, call AI
    # Pass a simplified text version to AI (you can adjust this later)
    q_text = question.content
    for sub in getattr(question, 'sub_items', []):
        q_text += f"\n- {getattr(sub, 'label', '')}: {getattr(sub, 'prompt', '')}"
    for ans in getattr(question, 'answers', []):
        q_text += f"\n[ ] {ans.content}"
        
    ai_response = await analyze_question_with_gemini(question, q_text)
    
    # Estimate cost (very rough estimate for Gemini 1.5 Pro)
    cost = (ai_response["token_count"] / 1000) * 0.0035 
    
    # Save to Cache
    new_cache = AiAnalysisCache(
        content_hash=content_hash,
        source_question_id=question.id,
        analysis_result=ai_response["result"],
        confidence=0.9, # default or parse from AI if requested
        ai_model_used="gemini-1.5-pro",
        review_status=AiReviewStatus.AI_SUGGESTED,
        reviewed_by=None
    )
    db.add(new_cache)
    await db.commit()
    await db.refresh(new_cache)
    
    # Log request
    await log_ai_request(
        db=db,
        endpoint=f"/questions/{question_id}/analyze",
        question_id=question.id,
        token_count=ai_response["token_count"],
        cost_estimate=cost
    )
    
    return new_cache
    
from app.schemas.ai import AiReviewRequest
from app.models.ai import AiReviewStatus
from sqlalchemy import func

@router.post("/{question_id}/ai-analysis/review", response_model=AiAnalysisResponse)
async def review_ai_analysis(
    question_id: int,
    request: AiReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Accept, edit, or reject the AI analysis result.
    If confirmed/edited, the concepts and skills are saved as non-primary QuestionSkillTags.
    """
    if current_user.role_id not in [1, 2]:
        raise HTTPException(status_code=403, detail="Only teachers and admins can review AI analysis")
        
    question = await get_fully_loaded_question(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    content_hash = compute_question_hash(question)
    
    # Find the latest cache
    stmt = select(AiAnalysisCache).where(AiAnalysisCache.content_hash == content_hash)
    result = await db.execute(stmt)
    cache = result.scalars().first()
    
    if not cache:
        raise HTTPException(status_code=404, detail="No AI analysis found for this question version")
        
    # Update cache
    cache.review_status = request.review_status
    cache.reviewed_by = current_user.id
    cache.reviewed_at = func.now()
    
    if request.updated_analysis_result:
        cache.analysis_result = request.updated_analysis_result
        
    # If accepted or edited, process skills and concepts
    if request.review_status in [AiReviewStatus.HUMAN_CONFIRMED, AiReviewStatus.HUMAN_EDITED]:
        final_result = cache.analysis_result or {}
        ai_concepts = final_result.get("concepts", [])
        ai_skills = final_result.get("skills", [])
        
        # Determine existing tags to avoid duplicates
        existing_tags_stmt = select(QuestionSkillTag.knowledge_node_id).where(QuestionSkillTag.question_id == question_id)
        existing_tags = (await db.execute(existing_tags_stmt)).scalars().all()
        existing_tags_set = set(existing_tags)
        
        async def _get_or_create_node(name: str, node_type: KnowledgeNodeType) -> int:
            if not name: return None
            # case-insensitive search
            s = select(KnowledgeNode).where(
                func.lower(KnowledgeNode.name) == name.lower(),
                KnowledgeNode.node_type == node_type
            )
            node = (await db.execute(s)).scalars().first()
            if not node:
                node = KnowledgeNode(name=name, node_type=node_type, is_leaf=True)
                db.add(node)
                await db.flush() # get ID
            return node.id
            
        nodes_to_add = []
        for c in ai_concepts:
            nid = await _get_or_create_node(c, KnowledgeNodeType.CONCEPT)
            if nid and nid not in existing_tags_set:
                nodes_to_add.append(nid)
                existing_tags_set.add(nid)
                
        for s in ai_skills:
            nid = await _get_or_create_node(s, KnowledgeNodeType.SKILL)
            if nid and nid not in existing_tags_set:
                nodes_to_add.append(nid)
                existing_tags_set.add(nid)
                
        for nid in nodes_to_add:
            new_tag = QuestionSkillTag(
                question_id=question_id,
                knowledge_node_id=nid,
                is_primary=False
            )
            db.add(new_tag)
            
    await db.commit()
    await db.refresh(cache)
    return cache

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
