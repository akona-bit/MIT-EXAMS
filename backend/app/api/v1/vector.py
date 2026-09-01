"""
Semantic search API endpoints for questions.

Provides vector-based similarity search using pgvector.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.api.dependencies import RequireRole
from app.services.embedding_service import (
    generate_embedding,
    upsert_embedding,
    delete_embedding,
    search_similar_questions,
    batch_embed_questions,
)

router = APIRouter()


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="Search query text")
    limit: int = Field(default=10, ge=1, le=50, description="Max results to return")
    similarity_threshold: float = Field(default=0.3, ge=0.0, le=1.0, description="Min similarity score (0-1)")
    question_ids: Optional[List[int]] = Field(default=None, description="Restrict search to these question IDs")


class SemanticSearchResult(BaseModel):
    question_id: int
    content: str
    level: int
    question_type: str
    status: str
    knowledge_node_id: Optional[int]
    public_code: Optional[str]
    similarity: float


class SemanticSearchResponse(BaseModel):
    results: List[SemanticSearchResult]
    query: str
    total: int


class EmbedQuestionRequest(BaseModel):
    question_id: int = Field(..., description="Question ID to embed")


class BatchEmbedRequest(BaseModel):
    question_ids: Optional[List[int]] = Field(default=None, description="Specific question IDs to embed (all unembedded if empty)")
    batch_size: int = Field(default=20, ge=1, le=100)


class BatchEmbedResponse(BaseModel):
    total: int
    embedded: int
    skipped: int
    errors: int


@router.post("/search", response_model=SemanticSearchResponse)
async def semantic_search(
    request: SemanticSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Search for questions by semantic similarity.
    
    Uses OpenAI text-embedding-3-small to generate embeddings, then
    performs cosine similarity search via pgvector.
    """
    try:
        query_embedding = await generate_embedding(request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate embedding: {e}")
    
    results = await search_similar_questions(
        db=db,
        query_embedding=query_embedding,
        limit=request.limit,
        similarity_threshold=request.similarity_threshold,
        question_ids=request.question_ids,
    )
    
    return SemanticSearchResponse(
        results=[SemanticSearchResult(**r) for r in results],
        query=request.query,
        total=len(results),
    )


@router.post("/embed", status_code=201)
async def embed_single_question(
    request: EmbedQuestionRequest,
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(RequireRole(["ADMIN", "TEACHER"])),
):
    """Generate and store embedding for a single question."""
    from sqlalchemy import select
    from app.models.question import Question
    
    result = await db.execute(
        select(Question).where(Question.id == request.question_id)
    )
    question = result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    if not question.content or len(question.content.strip()) < 10:
        raise HTTPException(status_code=400, detail="Question content too short to embed")
    
    try:
        embedding = await generate_embedding(question.content)
        await upsert_embedding(db, question.id, question.content, embedding)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to embed question: {e}")
    
    return {"status": "ok", "question_id": question.id, "model": "text-embedding-3-small"}


@router.post("/embed/batch", response_model=BatchEmbedResponse)
async def embed_batch_questions(
    request: BatchEmbedRequest,
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(RequireRole(["ADMIN", "TEACHER"])),
):
    """Generate embeddings for multiple questions that don't have embeddings yet."""
    stats = await batch_embed_questions(
        db=db,
        question_ids=request.question_ids,
        batch_size=request.batch_size,
    )
    return BatchEmbedResponse(**stats)


@router.delete("/embed/{question_id}", status_code=204)
async def remove_embedding(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(RequireRole(["ADMIN", "TEACHER"])),
):
    """Delete embedding for a specific question."""
    await delete_embedding(db, question_id)


@router.get("/similar/{question_id}")
async def get_similar_questions(
    question_id: int,
    limit: int = Query(default=5, ge=1, le=20),
    threshold: float = Query(default=0.3, ge=0.0, le=1.0),
    db: AsyncSession = Depends(get_db),
):
    """Find questions similar to a given question by its ID."""
    from sqlalchemy import select
    from app.models.question import Question, QuestionEmbedding
    
    # Get the question's embedding
    result = await db.execute(
        select(QuestionEmbedding).where(QuestionEmbedding.question_id == question_id)
    )
    qe = result.scalars().first()
    if not qe or not qe.embedding:
        raise HTTPException(status_code=404, detail="No embedding found for this question. Embed it first via POST /embed.")
    
    import json
    query_embedding = json.loads(qe.embedding)
    
    # Search (exclude the question itself)
    results = await search_similar_questions(
        db=db,
        query_embedding=query_embedding,
        limit=limit + 1,  # +1 to account for self-match
        similarity_threshold=threshold,
    )
    
    # Filter out the source question
    results = [r for r in results if r["question_id"] != question_id][:limit]
    
    return {"question_id": question_id, "similar": results, "total": len(results)}
