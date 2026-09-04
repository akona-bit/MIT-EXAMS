"""
Hybrid OMR Orchestrator — Kết hợp Lớp 1 (OpenCV) và Lớp 2 (Gemini Vision).
Điều phối luồng xử lý: OpenCV chạy trước, Gemini chỉ xử lý câu needs_review.
"""

import cv2
import numpy as np
from typing import Dict, List, Optional
from dataclasses import dataclass, field
import logging
import time

from app.services.omr.layout_config import SheetLayout
from app.services.omr.layers.opencv_layer import OpenCVOMRProcessor, SheetReadResult, QuestionReadResult
from app.services.omr.layers.gemini_layer import GeminiOMRProcessor

logger = logging.getLogger(__name__)


@dataclass
class HybridOMRResult:
    """Kết quả cuối cùng từ hybrid pipeline."""
    sbd: Optional[str] = None
    ma_de: Optional[str] = None
    sbd_confident: bool = False
    ma_de_confident: bool = False
    questions: List[Dict] = field(default_factory=list)
    needs_review_count: int = 0
    total_questions: int = 120
    processing_time_ms: float = 0.0
    opencv_time_ms: float = 0.0
    gemini_time_ms: float = 0.0
    gemini_reviewed_count: int = 0
    errors: List[str] = field(default_factory=list)


class HybridOMREngine:
    """
    Engine hybrid kết hợp OpenCV + Gemini.
    
    Luồng xử lý:
    1. OpenCV: marker detection → perspective transform → calibration → đọc SBD/Mã đề/120 câu
    2. Gemini: chỉ xử lý câu needs_review từ OpenCV (crop ảnh nhỏ, tiết kiệm token)
    3. Output: JSON kết quả cuối cùng
    """

    def __init__(
        self,
        layout: Optional[SheetLayout] = None,
        gemini_api_key: Optional[str] = None,
        enable_gemini: bool = True,
    ):
        self.layout = layout or SheetLayout()
        self.opencv_processor = OpenCVOMRProcessor(self.layout)
        self.gemini_processor = None
        self.enable_gemini = enable_gemini

        if enable_gemini:
            try:
                self.gemini_processor = GeminiOMRProcessor(api_key=gemini_api_key)
            except Exception as e:
                logger.warning(f"Gemini layer không khả dụng: {e}")
                self.gemini_processor = None

    def process_image(self, image: np.ndarray) -> HybridOMRResult:
        """
        Xử lý 1 ảnh phiếu qua hybrid pipeline.
        
        Args:
            image: ảnh gốc (BGR hoặc grayscale)
            
        Returns:
            HybridOMRResult
        """
        start_time = time.time()
        result = HybridOMRResult()

        # ─── LỚP 1: OpenCV ──────────────────────────────────────────────────
        opencv_start = time.time()
        try:
            opencv_result = self.opencv_processor.pipeline.process(image)
        except Exception as e:
            logger.error(f"OpenCV pipeline lỗi: {e}")
            result.errors.append(f"OpenCV: {str(e)}")
            result.processing_time_ms = (time.time() - start_time) * 1000
            return result

        opencv_time = (time.time() - opencv_start) * 1000
        result.opencv_time_ms = opencv_time

        # Copy kết quả OpenCV
        result.sbd = opencv_result.sbd
        result.ma_de = opencv_result.ma_de
        result.sbd_confident = opencv_result.sbd_confident
        result.ma_de_confident = opencv_result.ma_de_confident
        result.needs_review_count = opencv_result.needs_review_count

        # ─── LỚP 2: Gemini (chỉ nếu enable + có câu needs_review) ─────────
        gemini_time = 0.0
        gemini_reviewed = 0

        if (
            self.gemini_processor is not None
            and self.enable_gemini
            and opencv_result.needs_review_count > 0
            and opencv_result.warped_image is not None
        ):
            gemini_start = time.time()
            try:
                gemini_result = self.gemini_processor.review_sheet(
                    opencv_result.warped_image,
                    opencv_result,
                    self.layout,
                )

                if gemini_result.get("reviewed"):
                    # Update questions từ Gemini
                    opencv_result.questions = gemini_result["questions"]
                    opencv_result.needs_review_count = gemini_result["needs_review_count"]
                    gemini_reviewed = sum(
                        1 for q in gemini_result["questions"]
                        if q.source == "gemini"
                    )

                    # Update SBD/Mã đề nếu Gemini review
                    sbd_review = gemini_result.get("sbd_ma_de_review", {})
                    if sbd_review.get("sbd") and sbd_review.get("confidence", 0) > 0.5:
                        result.sbd = sbd_review["sbd"]
                    if sbd_review.get("ma_de") and sbd_review.get("confidence", 0) > 0.5:
                        result.ma_de = sbd_review["ma_de"]

            except Exception as e:
                logger.error(f"Gemini review lỗi: {e}")
                result.errors.append(f"Gemini: {str(e)}")

            gemini_time = (time.time() - gemini_start) * 1000

        result.gemini_time_ms = gemini_time
        result.gemini_reviewed_count = gemini_reviewed
        result.needs_review_count = opencv_result.needs_review_count

        # ─── Convert questions thành dict ────────────────────────────────────
        result.questions = [
            {
                "question_no": q.question_no,
                "selected": q.selected,
                "source": q.source,
                "confidence": round(q.confidence, 3),
                "needs_review": q.needs_review,
                "fill_ratios": {k: round(v, 3) for k, v in q.fill_ratios.items()},
                "gap": round(q.gap, 3),
            }
            for q in opencv_result.questions
        ]

        result.processing_time_ms = (time.time() - start_time) * 1000
        return result

    def process_file(self, file_path: str) -> HybridOMRResult:
        """Xử lý file ảnh."""
        image = cv2.imread(file_path)
        if image is None:
            raise FileNotFoundError(f"Không đọc được ảnh: {file_path}")
        return self.process_image(image)

    def process_bytes(self, image_bytes: bytes) -> HybridOMRResult:
        """Xử lý bytes ảnh."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Không decode được ảnh từ bytes")
        return self.process_image(image)

    def process_url(self, url: str) -> HybridOMRResult:
        """Xử lý ảnh từ URL."""
        import httpx
        response = httpx.get(url, timeout=30.0)
        response.raise_for_status()
        return self.process_bytes(response.content)

    def to_dict(self, result: HybridOMRResult) -> Dict:
        """Convert result thành dict để lưu DB hoặc trả API."""
        return {
            "sbd": result.sbd,
            "ma_de": result.ma_de,
            "sbd_confident": result.sbd_confident,
            "ma_de_confident": result.ma_de_confident,
            "questions": result.questions,
            "needs_review_count": result.needs_review_count,
            "total_questions": result.total_questions,
            "processing_time_ms": round(result.processing_time_ms, 2),
            "opencv_time_ms": round(result.opencv_time_ms, 2),
            "gemini_time_ms": round(result.gemini_time_ms, 2),
            "gemini_reviewed_count": result.gemini_reviewed_count,
            "errors": result.errors,
        }
