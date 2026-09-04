"""
LỚP 2 — Gemini Vision OMR Layer
Chỉ xử lý câu hỏi bị needs_review từ Lớp 1.
Gửi crop ảnh nhỏ (không cả trang) để tiết kiệm token.
"""

import os
import json
import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False
    logger.warning("google-genai chưa cài. Gemini layer sẽ bị vô hiệu hóa.")


@dataclass
class GeminiReviewResult:
    """Kết quả review 1 câu hỏi từ Gemini."""
    question_no: int
    trang_thai: str  # "hop_le" | "nhieu_dap_an" | "khong_ro"
    dap_an: Optional[str]  # "A"|"B"|"C"|"D"|None
    confidence: float = 0.0
    source: str = "gemini"


class GeminiOMRReviewer:
    """
    Lớp 2 — Dùng Gemini Vision để review các câu hỏi cần review.
    Chỉ nhận crop ảnh của câu hỏi cần review, KHÔNG gửi cả trang.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-1.5-flash"):
        if not HAS_GEMINI:
            raise RuntimeError("google-generativeai chưa cài. pip install google-generativeai")

        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY chưa được cấu hình.")

        self.client = genai.Client(api_key=self.api_key)
        self.model_name = model_name

    def review_questions(
        self,
        warped_image: np.ndarray,
        question_numbers: List[int],
        opencv_fill_ratios: Dict[int, Dict[str, float]],
        layout_config: Optional[object] = None,
    ) -> List[GeminiReviewResult]:
        """
        Review các câu hỏi cần review bằng Gemini Vision.
        
        Args:
            warped_image: ảnh đã warp (BGR)
            question_numbers: danh sách câu hỏi cần review
            opencv_fill_ratios: {question_no: {"A": ratio, "B": ratio, ...}}
            layout_config: SheetLayout instance (để crop ảnh)
        
        Returns:
            List[GeminiReviewResult]
        """
        if not question_numbers:
            return []

        results = []
        from app.services.omr.layout_config import SheetLayout
        layout = layout_config or SheetLayout()

        for q_no in question_numbers:
            try:
                crop = self._crop_question(warped_image, q_no, layout)
                fill_ratios = opencv_fill_ratios.get(q_no, {})
                result = self._review_single(crop, q_no, fill_ratios)
                results.append(result)
            except Exception as e:
                logger.error(f"Gemini review failed for Q{q_no}: {e}")
                results.append(GeminiReviewResult(
                    question_no=q_no,
                    trang_thai="khong_ro",
                    dap_an=None,
                    confidence=0.0,
                    source="gemini",
                ))

        return results

    def _crop_question(
        self, warped_image: np.ndarray, question_no: int, layout: object
    ) -> np.ndarray:
        """
        Crop ảnh vùng câu hỏi cần review.
        Gửi crop nhỏ thay vì cả trang để giảm token.
        """
        h, w = warped_image.shape[:2]
        bubbles = layout.get_question_bubbles(question_no)

        # Tìm bounding box bao quanh 4 ô A/B/C/D
        min_cx = min(b.cx for b in bubbles)
        max_cx = max(b.cx for b in bubbles)
        min_cy = min(b.cy for b in bubbles)
        max_cy = max(b.cy for b in bubbles)

        # Thêm padding
        pad_x = 3.0  # % padding ngang
        pad_y = 2.0  # % padding dọc

        x1 = max(0, int((min_cx - pad_x) / 100.0 * w))
        y1 = max(0, int((min_cy - pad_y) / 100.0 * h))
        x2 = min(w, int((max_cx + pad_x) / 100.0 * w))
        y2 = min(h, int((max_cy + pad_y) / 100.0 * h))

        crop = warped_image[y1:y2, x1:x2]
        return crop

    def _review_single(
        self,
        crop_image: np.ndarray,
        question_no: int,
        fill_ratios: Dict[str, float],
    ) -> GeminiReviewResult:
        """
        Gửi 1 crop ảnh câu hỏi cho Gemini và nhận kết quả review.
        """
        # Encode crop thành JPEG bytes
        _, buffer = cv2.imencode('.jpg', crop_image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        image_bytes = buffer.tobytes()

        # Thêm context fill ratios từ OpenCV vào prompt
        ratios_text = ", ".join(f"{k}: {v:.3f}" for k, v in sorted(fill_ratios.items()))

        prompt = f"""Bạn là hệ thống chấm thi OMR. Hãy phân tích ảnh crop câu hỏi số {question_no}.

Các ô A/B/C/D trong ảnh, với fill ratios từ OpenCV: {ratios_text}

Quyết định:
1. Nếu RÕ RÀNG chỉ có 1 ô được tô đen → trang_thai="hop_le", dap_an="A"/"B"/"C"/"D"
2. Nếu NHIỀU ô được tô đen hoặc không rõ cái nào được chọn → trang_thai="nhieu_dap_an", dap_an=null
3. Nếu ẢNH MỜ/KHÔNG ĐỌC ĐƯỢC → trang_thai="khong_ro", dap_an=null

QUAN TRỌNG: Nếu fill-ratio gap giữa 2 đáp án hàng đầu KHÔNG rõ ràng → BẮT BUỘC trang_thai="nhieu_dap_an", dap_an=null.

Trả về JSON:
{{
  "trang_thai": "hop_le" hoặc "nhieu_dap_an" hoặc "khong_ro",
  "dap_an": "A"/"B"/"C"/"D" hoặc null
}}"""

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[
                prompt,
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        try:
            result_json = json.loads(response.text)
        except json.JSONDecodeError:
            logger.error(f"Gemini trả về không phải JSON: {response.text}")
            return GeminiReviewResult(
                question_no=question_no,
                trang_thai="khong_ro",
                dap_an=None,
                confidence=0.0,
                source="gemini",
            )

        trang_thai = result_json.get("trang_thai", "khong_ro")
        dap_an = result_json.get("dap_an")

        # Validate trang_thai
        if trang_thai not in ("hop_le", "nhieu_dap_an", "khong_ro"):
            trang_thai = "khong_ro"

        # Validate dap_an: chỉ chấp nhận khi trang_thai=hop_le
        if trang_thai != "hop_le":
            dap_an = None
        elif dap_an and dap_an.upper() not in ("A", "B", "C", "D"):
            dap_an = None
        else:
            dap_an = dap_an.upper() if dap_an else None

        # Tính confidence
        confidence = 0.0
        if trang_thai == "hop_le" and dap_an:
            # Dựa vào gap fill ratio
            ratios = list(fill_ratios.values())
            if len(ratios) >= 2:
                sorted_ratios = sorted(ratios, reverse=True)
                gap = sorted_ratios[0] - sorted_ratios[1]
                confidence = min(0.95, 0.6 + gap * 0.6)
            else:
                confidence = 0.7
        elif trang_thai == "nhieu_dap_an":
            confidence = 0.8  # Khá chắc chắn là multi-mark
        else:
            confidence = 0.3

        return GeminiReviewResult(
            question_no=question_no,
            trang_thai=trang_thai,
            dap_an=dap_an,
            confidence=confidence,
            source="gemini",
        )

    def review_sbd_ma_de(
        self,
        warped_image: np.ndarray,
        sbd_raw: str,
        ma_de_raw: str,
        layout_config: Optional[object] = None,
    ) -> Dict[str, object]:
        """
        Review SBD và Mã đề nếu OpenCV không chắc chắn.
        Gửi crop vùng SBD/Mã đề cho Gemini.
        """
        from app.services.omr.layout_config import SheetLayout
        layout = layout_config or SheetLayout()
        h, w = warped_image.shape[:2]

        results = {"sbd": sbd_raw, "ma_de": ma_de_raw, "confidence": 0.0}

        # Crop vùng SBD
        sbd_origin = layout.sbd_origin
        sbd_width = layout.sbd_cols * layout.sbd_cell_w
        sbd_height = layout.sbd_rows * layout.sbd_cell_h

        x1 = int(sbd_origin[0] / 100.0 * w)
        y1 = int(sbd_origin[1] / 100.0 * h)
        x2 = int((sbd_origin[0] + sbd_width) / 100.0 * w)
        y2 = int((sbd_origin[1] + sbd_height) / 100.0 * h)
        sbd_crop = warped_image[y1:y2, x1:x2]

        _, sbd_buf = cv2.imencode('.jpg', sbd_crop, [cv2.IMWRITE_JPEG_QUALITY, 85])

        prompt_sbd = f"""Phân tích ảnh ô Số báo danh. OpenCV đọc được: '{sbd_raw}'
Nếu rõ ràng và chính xác → trả về {{"sbd": "{sbd_raw}", "hop_le": true}}
Nếu không rõ → trả về {{"sbd": null, "hop_le": false}}"""

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[
                    prompt_sbd,
                    types.Part.from_bytes(data=sbd_buf.tobytes(), mime_type="image/jpeg")
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            result = json.loads(response.text)
            if result.get("hop_le") and result.get("sbd"):
                results["sbd"] = result["sbd"]
                results["confidence"] = 0.8
        except Exception as e:
            logger.error(f"Gemini SBD review failed: {e}")

        return results


class GeminiOMRProcessor:
    """
    Wrapper để chạy Gemini review trên sheet result từ OpenCV.
    """

    def __init__(self, api_key: Optional[str] = None):
        try:
            self.reviewer = GeminiOMRReviewer(api_key=api_key)
        except (RuntimeError, ValueError) as e:
            logger.warning(f"Gemini layer không khả dụng: {e}")
            self.reviewer = None

    def review_sheet(
        self,
        warped_image: np.ndarray,
        opencv_result: object,
        layout_config: Optional[object] = None,
    ) -> Dict[str, object]:
        """
        Review toàn bộ phiếu: các câu needs_review + SBD/Mã đề nếu cần.
        
        Args:
            warped_image: ảnh đã warp
            opencv_result: SheetReadResult từ OpenCV pipeline
            layout_config: SheetLayout
            
        Returns:
            Dict với các field cần update vào SheetReadResult
        """
        if self.reviewer is None:
            return {"reviewed": False, "reason": "Gemini layer not available"}

        from app.services.omr.layout_config import SheetLayout
        layout = layout_config or SheetLayout()

        # 1. Review các câu needs_review
        needs_review_qs = [
            q for q in opencv_result.questions if q.needs_review
        ]
        question_numbers = [q.question_no for q in needs_review_qs]
        fill_ratios_map = {
            q.question_no: q.fill_ratios for q in needs_review_qs
        }

        gemini_results = self.reviewer.review_questions(
            warped_image, question_numbers, fill_ratios_map, layout
        )

        # 2. Map kết quả Gemini về lại QuestionReadResult
        gemini_map = {r.question_no: r for r in gemini_results}
        updated_questions = []
        for q in opencv_result.questions:
            if q.question_no in gemini_map:
                gr = gemini_map[q.question_no]
                if gr.trang_thai == "hop_le" and gr.dap_an:
                    q.selected = gr.dap_an
                    q.needs_review = False
                    q.source = "gemini"
                    q.confidence = gr.confidence
                elif gr.trang_thai == "nhieu_dap_an":
                    q.selected = None
                    q.needs_review = True
                    q.source = "gemini"
                    q.confidence = gr.confidence
                else:
                    # khong_ro → giữ nguyên needs_review
                    q.source = "gemini"
                    q.confidence = gr.confidence
            updated_questions.append(q)

        # 3. Review SBD/Mã đề nếu cần
        sbd_ma_de_review = {}
        if not opencv_result.sbd_confident or not opencv_result.ma_de_confident:
            sbd_ma_de_review = self.reviewer.review_sbd_ma_de(
                warped_image,
                opencv_result.sbd or "",
                opencv_result.ma_de or "",
                layout,
            )

        return {
            "reviewed": True,
            "questions": updated_questions,
            "needs_review_count": sum(1 for q in updated_questions if q.needs_review),
            "sbd_ma_de_review": sbd_ma_de_review,
        }
