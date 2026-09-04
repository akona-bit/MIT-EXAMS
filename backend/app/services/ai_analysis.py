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
from google import genai
from google.genai import types
from fastapi import HTTPException

async def analyze_question_with_gemini(question: Question, question_text: str) -> dict:
    """Call Gemini to analyze a question and return a structured JSON dict."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")
        
    client = genai.Client(api_key=api_key)
    
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
        response = await client.aio.models.generate_content(
            model="gemini-1.5-pro",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                top_p=0.95,
                top_k=40,
                max_output_tokens=8192,
                response_mime_type="application/json",
            )
        )
        
        # Count tokens for cost estimation
        token_response = await client.aio.models.count_tokens(
            model="gemini-1.5-pro",
            contents=prompt,
        )
        token_count = token_response.total_tokens
        
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


async def suggest_question_tags(
    content: str,
    answers: list[str] | None = None,
    sub_items: list[str] | None = None,
    existing_nodes: list[dict] | None = None,
) -> dict:
    """
    Gợi ý knowledge nodes (concepts/skills) từ nội dung câu hỏi.
    Dùng Gemini Flash (rẻ hơn Pro) để suggest tags.
    
    Args:
        content: nội dung câu hỏi
        answers: danh sách nội dung đáp án ["A. ...", "B. ...", ...]
        sub_items: danh sách nội dung ý con ["a. ...", "b. ...", ...]
        existing_nodes: danh sách nodes có sẵn trong hệ thống [{"id": 1, "name": "...", "type": "TOPIC"}, ...]
    
    Returns:
        dict với primary_suggestion, secondary_suggestions, cognitive_level, tags
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")
    
    client = genai.Client(api_key=api_key)
    
    # Build context từ existing nodes
    nodes_context = ""
    if existing_nodes:
        nodes_list = "\n".join(
            f"  - [{n['type']}] {n['name']} (id={n['id']})"
            for n in existing_nodes[:100]  # limit 100 nodes
        )
        nodes_context = f"\nCác kiến thức có sẵn trong hệ thống:\n{nodes_list}\n\nHãy ưu tiên chọn từ danh sách trên. Nếu không có node nào phù hợp, mới gợi ý tên mới."
    
    answers_text = ""
    if answers:
        answers_text = "\nCác lựa chọn:\n" + "\n".join(f"  {a}" for a in answers)
    
    sub_items_text = ""
    if sub_items:
        sub_items_text = "\nCác ý con:\n" + "\n".join(f"  {s}" for s in sub_items)
    
    prompt = f"""Phân tích câu hỏi trắc nghiệm sau và gợi ý kiến thức liên quan.

Nội dung câu hỏi:
{content}
{answers_text}
{sub_items_text}
{nodes_context}

Trả về JSON với cấu trúc:
{{
  "primary_suggestion": {{
    "name": "tên node phù hợp nhất",
    "node_type": "TOPIC" hoặc "CONCEPT" hoặc "SKILL",
    "confidence": 0.0-1.0,
    "reasoning": "giải thích ngắn gọn"
  }},
  "secondary_suggestions": [
    {{
      "name": "...",
      "node_type": "...",
      "confidence": 0.0-1.0,
      "reasoning": "..."
    }}
  ],
  "cognitive_level": 1 hoặc 2 hoặc 3 hoặc 4,
  "tags": ["tag_1", "tag_2"]
}}

Quy tắc:
- primary_suggestion là node PHÙ HỢP NHẤT (confidence cao nhất)
- secondary_suggestions: 2-4 node liên quan khác
- cognitive_level: 1=Nhận biết, 2=Thông hiểu, 3=Vận dụng, 4=Vận dụng cao
- Nếu node trong hệ thống trùng tên → dùng tên đó, ghi confidence=0.9+
- Nếu node mới → confidence=0.6-0.8"""
    
    try:
        response = await client.aio.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=2048,
                response_mime_type="application/json",
            )
        )
        token_response = await client.aio.models.count_tokens(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        token_count = token_response.total_tokens
        
        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"error": "Invalid JSON from AI", "raw": response.text}
        
        return {
            "result": result,
            "token_count": token_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI suggest tags failed: {str(e)}")

async def generate_matrix_rules(prompt: str, existing_nodes: list[dict]):
    from google import genai
    from google.genai import types
    from app.core.config import settings
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    nodes_context = "Các chủ đề hiện có trong hệ thống (nên ưu tiên sử dụng tên y hệt để dễ khớp):\n"
    for n in existing_nodes[:500]:  # Limit to avoid huge prompt
        nodes_context += f"- {n['name']} (Type: {n['type']})\n"
        
    system_prompt = f"""Bạn là một chuyên gia khảo thí, tạo cấu trúc đề thi trắc nghiệm (ma trận đặc tả).
Người dùng yêu cầu: "{prompt}"

{nodes_context}

Hãy phân tích yêu cầu trên và trả về kết quả định dạng JSON. Cấu trúc yêu cầu (KHÔNG markdown, CHỈ JSON thuần):
[
  {{
    "node_name": "Tên chủ đề/kỹ năng (ưu tiên dùng từ danh sách hiện có)",
    "cognitive_level": số (1: Nhận biết, 2: Thông hiểu, 3: Vận dụng, 4: Vận dụng cao),
    "question_type": "SINGLE_CHOICE" hoặc "MULTIPLE_CHOICE" hoặc "TRUE_FALSE" hoặc "FILL_IN_BLANK",
    "count": số lượng câu hỏi
  }}
]
Mọi thông tin không nói rõ dạng câu hỏi thì mặc định là "SINGLE_CHOICE" (trắc nghiệm 4 đáp án). Mọi mức độ không nói rõ thì phân bổ cân đối.
"""
    
    try:
        response = await client.aio.models.generate_content(
            model="gemini-1.5-flash",
            contents=system_prompt,
        )
        token_response = await client.aio.models.count_tokens(
            model="gemini-1.5-flash",
            contents=system_prompt,
        )
        token_count = token_response.total_tokens
        
        # Clean text
        text = response.text
        if text.startswith("```json"): text = text[7:]
        if text.endswith("```"): text = text[:-3]
        
        try:
            result = json.loads(text.strip())
        except json.JSONDecodeError:
            result = []
            
        return {
            "result": result,
            "token_count": token_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI matrix generation failed: {str(e)}")
