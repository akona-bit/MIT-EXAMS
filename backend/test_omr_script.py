import os
import cv2
import sys
from app.services.omr.hybrid_omr import HybridOMREngine
import pprint
import asyncio

def test_omr(image_path):
    print(f"Reading image: {image_path}")
    img = cv2.imread(image_path)
    if img is None:
        print("Failed to read image.")
        return

    engine = HybridOMREngine(
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        enable_gemini=True
    )
    result = engine.process_image(img)
    
    print("--- Hybrid OMR Result ---")
    print(f"SBD: {result.sbd} (Confident: {result.sbd_confident})")
    print(f"Ma de: {result.ma_de} (Confident: {result.ma_de_confident})")
    print(f"Needs review count: {result.needs_review_count}")
    print(f"Gemini reviewed: {result.gemini_reviewed_count}")
    print(f"Time: OpenCV={result.opencv_time_ms:.1f}ms, Gemini={result.gemini_time_ms:.1f}ms")
    if result.errors:
        print(f"Errors: {result.errors}")
    print("First 10 questions:")
    for q in result.questions[:10]:
        sel = q.get('selected') if isinstance(q, dict) else (q.selected if hasattr(q, 'selected') else q.get('selected_answer_id'))
        print(f"  Q{q.get('question_no') if isinstance(q, dict) else q.question_no}: selected={sel}")

if __name__ == "__main__":
    test_omr("C:/Users/LENOVO/.gemini/antigravity-ide/brain/6d036120-bebe-4313-86ed-fcef85ef21fd/.user_uploaded/media_1789272353522.jpg")
