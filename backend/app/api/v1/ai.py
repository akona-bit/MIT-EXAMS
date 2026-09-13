from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json, logging

from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Bạn là trợ lý MIT Exams, hỗ trợ thí sinh.

CHỈ trả lời các chủ đề sau:

1. Đăng nhập / quên mật khẩu
2. Làm bài thi online: chọn đáp án, chuyển câu, nộp bài
3. Nộp phiếu OMR: chụp ảnh, tải lên
4. Xem kết quả thi, lịch sử làm bài
5. Xếp hạng, điểm số
6. Giới thiệu hệ thống: "MIT Exams được xây dựng bằng React + TypeScript (frontend), FastAPI + Python (backend), PostgreSQL (cơ sở dữ liệu), Supabase (xác thực). Hệ thống hỗ trợ thi trắc nghiệm online và offline (OMR)."
7. Hướng dẫn thí sinh: giải thích từng bước các thao tác trên hệ thống

KHÔNG trả lời: tạo đề, câu hỏi, ma trận, chấm điểm, thống kê, admin, hoặc bất kỳ thông tin nào ngoài phạm vi thí sinh.

Câu trả lời: tối đa 3 câu, đơn giản, dễ hiểu. Nếu超出 phạm vi → "Vui lòng liên hệ giáo viên hướng dẫn"."""

# Tái sử dụng client (giảm thời gian khởi tạo)
_client = None

def get_client():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


@router.post("/chat")
async def chat(request: dict):
    """AI chat — streaming SSE response."""
    user_message = request.get("message", "").strip()
    history = request.get("history", [])

    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY chưa cấu hình")

    def generate():
        try:
            client = get_client()
            from google.genai import types

            contents = []
            # History (giới hạn 4 tin gần nhất)
            for msg in history[-4:]:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.get("content", ""))]
                ))

            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)]
            ))

            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.3,
                    max_output_tokens=256,
                )
            )

            text = response.text or "Xin lỗi, không thể xử lý."
            for i in range(0, len(text), 8):
                yield f"data: {json.dumps({'text': text[i:i+8]})}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.exception("AI chat error")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
