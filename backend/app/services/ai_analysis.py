import hashlib
import json
import re
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.ai import AiAnalysisCache, AiReviewStatus, AiRequestLog
from app.models.question import Question

def _normalize_text(text: Optional[str]) -> str:
    """Normalize whitespace without stripping HTML to preserve math symbols like < or >."""
    if not text:
        return ""
    # Normalize whitespace only (preserve all tags and characters)
    text = re.sub(r'\s+', ' ', text)
    return text.strip().lower()

async def get_fully_loaded_question(db: AsyncSession, question_id: int) -> Optional[Question]:
    """Helper to load a question with all necessary relationships for hashing to prevent MissingGreenlet crash."""
    stmt = select(Question).options(
        selectinload(Question.sub_items),
        selectinload(Question.answers),
        selectinload(Question.passage)
    ).where(Question.id == question_id)
    
    result = await db.execute(stmt)
    return result.scalars().first()

def compute_question_hash(question: Question) -> str:
    """
    Compute a consistent hash for a question's content.
    WARNING: The question object MUST be fully loaded (sub_items, answers, passage)
    before passing to this function. Use get_fully_loaded_question() to ensure this.
    
    Thứ tự nối chuỗi (cố định để tránh sai lệch cache):
    1. content
    2. resource_id
    3. passage content
    4. sub_items (sort theo position, id)
    5. answers (sort theo position, id)
    """
    content_parts = [_normalize_text(question.content)]
    
    # Add resource_id to distinguish different images with same text
    if getattr(question, 'resource_id', None) is not None:
        content_parts.append(f"resource:{question.resource_id}")
        
    # Add passage content if it exists
    if getattr(question, 'passage_id', None) is not None:
        passage_content = getattr(question.passage, 'content', '') if getattr(question, 'passage', None) else ''
        content_parts.append(f"passage:{_normalize_text(passage_content)}")
    
    # Sort sub items by (position, id) để đảm bảo tính ổn định (stable sort)
    if getattr(question, 'sub_items', None):
        for sub in sorted(question.sub_items, key=lambda x: (x.position, x.id)):
            sub_prompt = getattr(sub, 'prompt', '') or ''
            sub_label = getattr(sub, 'label', '') or ''
            content_parts.append(f"{sub_label}::{_normalize_text(sub_prompt)}")
            
    # Sort answers by (position, id), and INCLUDE is_correct in the hash
    if getattr(question, 'answers', None):
        for ans in sorted(question.answers, key=lambda x: (x.position, x.id)):
            content_parts.append(f"{_normalize_text(ans.content)}::{ans.is_correct}")
            
    combined_text = "\x1f".join(content_parts)
    return hashlib.sha256(combined_text.encode('utf-8')).hexdigest()

async def get_cached_analysis(db: AsyncSession, content_hash: str) -> Optional[AiAnalysisCache]:
    """Retrieve existing cached analysis if it exists and is usable."""
    stmt = select(AiAnalysisCache).where(AiAnalysisCache.content_hash == content_hash)
    result = await db.execute(stmt)
    cache = result.scalars().first()
    
    if not cache:
        return None
        
    # Usable if Human Confirmed, or AI Suggested with high enough confidence (e.g., > 0.8)
    if cache.review_status == AiReviewStatus.HUMAN_CONFIRMED:
        return cache
    if cache.review_status == AiReviewStatus.AI_SUGGESTED and cache.confidence and cache.confidence > 0.8:
        return cache
        
    return None

async def log_ai_request(db: AsyncSession, endpoint: str, question_id: int, token_count: int, cost_estimate: float):
    """Log the AI request for token budgeting."""
    log = AiRequestLog(
        endpoint=endpoint,
        question_id=question_id,
        token_count=token_count,
        cost_estimate=cost_estimate
    )
    db.add(log)
    await db.commit()

import os
import google.generativeai as genai
from fastapi import HTTPException

async def analyze_question_with_gemini(question: Question, question_text: str) -> dict:
    """Call Gemini to analyze a question and return a structured JSON dict."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")
        
    genai.configure(api_key=api_key)
    
    generation_config = {
      "temperature": 0.1,
      "top_p": 0.95,
      "top_k": 40,
      "max_output_tokens": 8192,
      "response_mime_type": "application/json",
    }
    
    model = genai.GenerativeModel(
        model_name="gemini-1.5-pro",
        generation_config=generation_config
    )
    
    prompt = f"""Phân tích câu hỏi trắc nghiệm sau và trả về JSON chuẩn xác định các thuộc tính sư phạm.
Nội dung câu hỏi:
{question_text}

Yêu cầu trả về JSON với cấu trúc chính xác sau:
{{
  "concepts": ["concept_1", "concept_2"],
  "skills": ["skill_1", "skill_2"],
  "cognitive_level": 1, // 1: Nhận biết, 2: Thông hiểu, 3: Vận dụng, 4: Vận dụng cao
  "tags": ["tag_1"],
  "error_patterns": ["lỗi thường gặp 1"],
  "relations": ["quan hệ 1"]
}}
"""
    try:
        # In production this might block the event loop, run in executor if needed
        # But genai has async generate_content_async
        response = await model.generate_content_async(prompt)
        
        # Count tokens for cost estimation
        token_count = model.count_tokens(prompt).total_tokens
        
        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"error": "Invalid JSON from AI", "raw": response.text}
            
        return {
            "result": result,
            "token_count": token_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Analysis failed: {str(e)}")
