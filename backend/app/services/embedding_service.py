"""
Embedding service for semantic search of questions.

Uses OpenAI text-embedding-3-small (1536 dimensions) by default.
Falls back to a simple TF-IDF approach if no API key is available.
"""

import json
import hashlib
import numpy as np
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import httpx

from app.core.config import settings


EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


async def generate_embedding(text_content: str) -> List[float]:
    """Generate embedding vector for given text.
    
    Uses OpenAI API if OPENAI_API_KEY is set, otherwise uses a simple
    hash-based fallback for development/testing.
    """
    import os
    api_key = os.environ.get("OPENAI_API_KEY") or getattr(settings, "OPENAI_API_KEY", None)
    
    if api_key:
        return await _generate_openai_embedding(text_content, api_key)
    else:
        return _generate_fallback_embedding(text_content)


async def _generate_openai_embedding(text_content: str, api_key: str) -> List[float]:
    """Generate embedding using OpenAI API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "input": text_content[:8000],  # OpenAI limit
                "model": EMBEDDING_MODEL,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["data"][0]["embedding"]


def _generate_fallback_embedding(text_content: str) -> List[float]:
    """Generate a deterministic fallback embedding using hashing.
    
    NOT suitable for production - only for development/testing when
    no OpenAI API key is available. Creates a sparse, hash-based vector.
    """
    # Create multiple hash points for different parts of the text
    words = text_content.lower().split()
    vector = np.zeros(EMBEDDING_DIM, dtype=np.float32)
    
    # Hash individual words
    for word in words[:200]:  # limit to first 200 words
        h = int(hashlib.md5(word.encode()).hexdigest(), 16)
        idx = h % EMBEDDING_DIM
        vector[idx] += 1.0
    
    # Hash bigrams
    for i in range(len(words) - 1):
        bigram = f"{words[i]}_{words[i+1]}"
        h = int(hashlib.sha256(bigram.encode()).hexdigest(), 16)
        idx = h % EMBEDDING_DIM
        vector[idx] += 0.5
    
    # Normalize
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    
    return vector.tolist()


async def upsert_embedding(
    db: AsyncSession,
    question_id: int,
    content: str,
    embedding: List[float],
    model_name: str = EMBEDDING_MODEL,
) -> None:
    """Insert or update an embedding for a question."""
    embedding_str = json.dumps(embedding)
    
    await db.execute(
        text("""
            INSERT INTO question_embedding (question_id, content, embedding, model_name)
            VALUES (:question_id, :content, :embedding, :model_name)
            ON CONFLICT (question_id)
            DO UPDATE SET
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                model_name = EXCLUDED.model_name,
                updated_at = NOW()
        """),
        {
            "question_id": question_id,
            "content": content,
            "embedding": embedding_str,
            "model_name": model_name,
        },
    )
    await db.commit()


async def delete_embedding(db: AsyncSession, question_id: int) -> None:
    """Delete embedding for a question."""
    await db.execute(
        text("DELETE FROM question_embedding WHERE question_id = :question_id"),
        {"question_id": question_id},
    )
    await db.commit()


async def search_similar_questions(
    db: AsyncSession,
    query_embedding: List[float],
    limit: int = 10,
    similarity_threshold: float = 0.3,
    question_ids: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    """Search for questions similar to the query embedding.
    
    Returns list of dicts with keys: question_id, content, similarity, level, type, status.
    """
    embedding_str = json.dumps(query_embedding)
    
    # Build the query - filter by question_ids if provided
    if question_ids:
        id_filter = "AND q.id = ANY(:question_ids)"
    else:
        id_filter = ""
    
    sql = text(f"""
        SELECT 
            qe.question_id,
            qe.content,
            q.level,
            q.type::text as question_type,
            q.status::text as status,
            q.knowledge_node_id,
            q.public_code,
            1 - (qe.embedding <=> :query_embedding::vector) AS similarity
        FROM question_embedding qe
        JOIN question q ON q.id = qe.question_id
        WHERE qe.embedding IS NOT NULL
            AND 1 - (qe.embedding <=> :query_embedding::vector) > :threshold
            {id_filter}
        ORDER BY qe.embedding <=> :query_embedding::vector
        LIMIT :limit
    """)
    
    params = {
        "query_embedding": embedding_str,
        "threshold": similarity_threshold,
        "limit": limit,
    }
    if question_ids:
        params["question_ids"] = question_ids
    
    result = await db.execute(sql, params)
    rows = result.mappings().all()
    
    return [
        {
            "question_id": row["question_id"],
            "content": row["content"],
            "level": row["level"],
            "question_type": row["question_type"],
            "status": row["status"],
            "knowledge_node_id": row["knowledge_node_id"],
            "public_code": row["public_code"],
            "similarity": round(float(row["similarity"]), 4),
        }
        for row in rows
    ]


async def batch_embed_questions(
    db: AsyncSession,
    question_ids: Optional[List[int]] = None,
    batch_size: int = 20,
) -> Dict[str, Any]:
    """Generate embeddings for multiple questions that don't have embeddings yet.
    
    Returns stats: {total: int, embedded: int, skipped: int, errors: int}
    """
    import os
    api_key = os.environ.get("OPENAI_API_KEY") or getattr(settings, "OPENAI_API_KEY", None)
    
    # Find questions without embeddings
    if question_ids:
        filter_clause = "AND q.id = ANY(:question_ids)"
        params = {"question_ids": question_ids, "batch_size": batch_size}
    else:
        filter_clause = ""
        params = {"batch_size": batch_size}
    
    sql = text(f"""
        SELECT q.id, q.content
        FROM question q
        LEFT JOIN question_embedding qe ON qe.question_id = q.id
        WHERE qe.id IS NULL
            AND q.content IS NOT NULL
            {filter_clause}
        ORDER BY q.id
        LIMIT :batch_size
    """)
    
    result = await db.execute(sql, params)
    rows = result.all()
    
    stats = {"total": len(rows), "embedded": 0, "skipped": 0, "errors": 0}
    
    if not rows:
        return stats
    
    for row in rows:
        qid, content = row[0], row[1]
        if not content or len(content.strip()) < 10:
            stats["skipped"] += 1
            continue
        
        try:
            embedding = await generate_embedding(content)
            await upsert_embedding(db, qid, content, embedding)
            stats["embedded"] += 1
        except Exception as e:
            stats["errors"] += 1
            import logging
            logging.warning(f"Failed to embed question {qid}: {e}")
    
    return stats
