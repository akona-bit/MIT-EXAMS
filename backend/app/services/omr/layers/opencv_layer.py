"""
LỚP 1 — OpenCV OMR Pipeline
Xử lý chính: marker detection, perspective transform, tự động threshold, đọc SBD/Mã đề/120 câu.
Deterministic, miễn phí, chạy nhanh hàng nghìn phiếu.
"""

import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import logging

from app.services.omr.layout_config import SheetLayout, BubbleCoord

logger = logging.getLogger(__name__)


# ─── Constants ───────────────────────────────────────────────────────────────
MARKER_MIN_AREA = 500       # Diện tích tối thiểu marker (pixel²)
MARKER_MAX_AREA = 50000     # Diện tích tối đa marker
MARKER_ASPECT_MIN = 0.7     # Tỷ lệ cạnh marker (width/height)
MARKER_ASPECT_MAX = 1.4
MARKER_SOLIDITY_MIN = 0.7   # Độ đặc (contour area / convex hull area)
WARP_WIDTH = 1700
WARP_HEIGHT = 2200
FILL_THRESHOLD_LOW = 0.15   # Dưới ngưỡng này = ô trống
FILL_GAP_SAFE = 0.15        # Gap tối thiểu để tự chọn (nếu gap nhỏ hơn → needs_review)


@dataclass
class BubbleReadResult:
    """Kết quả đọc 1 ô bubble."""
    fill_ratio: float
    is_filled: bool


@dataclass
class QuestionReadResult:
    """Kết quả đọc 1 câu hỏi."""
    question_no: int
    selected: Optional[str]  # "A", "B", "C", "D" hoặc None
    needs_review: bool
    fill_ratios: Dict[str, float] = field(default_factory=dict)  # {"A": 0.85, ...}
    gap: float = 0.0  # Gap giữa ô đậm nhất và ô đậm thứ nhì
    source: str = "opencv"
    confidence: float = 0.0


@dataclass
class SheetReadResult:
    """Kết quả đọc 1 phiếu."""
    sbd: Optional[str] = None
    ma_de: Optional[str] = None
    sbd_confident: bool = False
    ma_de_confident: bool = False
    questions: List[QuestionReadResult] = field(default_factory=list)
    needs_review_count: int = 0
    needs_review_reasons: List[str] = field(default_factory=list)
    warped_image: Optional[np.ndarray] = None


class OpenCVOMRPipeline:
    """
    Pipeline OMR Lớp 1 — xử lý hoàn toàn bằng OpenCV.
    1. Detect 4 marker góc → perspective transform
    2. Đọc hàng Type → tính ngưỡng threshold riêng cho ảnh này
    3. Đọc SBD, Mã đề, 120 câu
    """

    def __init__(self, layout: Optional[SheetLayout] = None):
        self.layout = layout or SheetLayout()
        self.warp_width = self.layout.target_width
        self.warp_height = self.layout.target_height

    def process(self, image: np.ndarray) -> SheetReadResult:
        """
        Xử lý 1 ảnh phiếu trả lời.
        Args:
            image: ảnh gốc (BGR hoặc grayscale)
        Returns:
            SheetReadResult
        """
        result = SheetReadResult()

        # Convert grayscale → BGR nếu cần
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

        # 1. Detect 4 marker góc
        markers = self._detect_markers(image)
        if markers is None or len(markers) < 4:
            result.needs_review_count = 120
            result.needs_review_reasons.append(
                f"Không detect đủ 4 marker góc (found {len(markers) if markers else 0})"
            )
            return result

        # 2. Perspective transform
        warped = self._perspective_transform(image, markers)
        if warped is None:
            result.needs_review_count = 120
            result.needs_review_reasons.append("Perspective transform thất bại")
            return result
        result.warped_image = warped

        # 3. Tính ngưỡng từ hàng Type
        type_threshold = self._calibrate_threshold_from_type(warped)

        # 4. Đọc SBD
        sbd, sbd_confident = self._read_sbd(warped, type_threshold)
        result.sbd = sbd
        result.sbd_confident = sbd_confident

        # 5. Đọc Mã đề
        ma_de, ma_de_confident = self._read_ma_de(warped, type_threshold)
        result.ma_de = ma_de
        result.ma_de_confident = ma_de_confident

        # Nếu SBD hoặc Mã đề không confident → toàn phiếu needs_review
        if not sbd_confident or not ma_de_confident:
            reasons = []
            if not sbd_confident:
                reasons.append(f"SBD không rõ ràng: '{sbd}'")
            if not ma_de_confident:
                reasons.append(f"Mã đề không rõ ràng: '{ma_de}'")
            result.needs_review_reasons.extend(reasons)

        # 6. Đọc 120 câu hỏi
        questions = self._read_all_questions(warped, type_threshold)
        result.questions = questions
        result.needs_review_count = sum(1 for q in questions if q.needs_review)

        # Nếu SBD/Mã đề không confident → đánh dấu toàn bộ câu needs_review
        if not sbd_confident or not ma_de_confident:
            for q in result.questions:
                q.needs_review = True
                q.source = "opencv"
            result.needs_review_count = len(result.questions)

        return result

    # ─── Marker Detection ────────────────────────────────────────────────────

    def _detect_markers(self, image: np.ndarray) -> Optional[List[Tuple[int, int]]]:
        """
        Detect 4 marker hình vuông đen ở 4 góc.
        Trả về list 4 tọa độ tâm markers, sắp xếp theo thứ tự:
        [top-left, top-right, bottom-right, bottom-left].
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []
        h, w = image.shape[:2]
        min_area = MARKER_MIN_AREA * (h * w / (2000 * 2500))  # Scale theo kích thước ảnh
        max_area = MARKER_MAX_AREA * (h * w / (2000 * 2500))

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < min_area or area > max_area:
                continue

            # Kiểm tra aspect ratio (gần vuông)
            x, y, cw, ch = cv2.boundingRect(contour)
            aspect = cw / ch if ch > 0 else 0
            if not (MARKER_ASPECT_MIN <= aspect <= MARKER_ASPECT_MAX):
                continue

            # Kiểm tra solidity (độ đặc)
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            solidity = area / hull_area if hull_area > 0 else 0
            if solidity < MARKER_SOLIDITY_MIN:
                continue

            # Tính tâm contour
            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            candidates.append((cx, cy, area))

        if len(candidates) < 4:
            return None

        # Sắp xếp theo diện tích giảm dần, lấy 4 marker lớn nhất
        candidates.sort(key=lambda c: c[2], reverse=True)
        candidates = candidates[:4]

        # Sắp xếp theo vị trí: top-left, top-right, bottom-right, bottom-left
        points = np.array([(c[0], c[1]) for c in candidates], dtype=np.float32)
        return self._order_corners(points)

    def _order_corners(self, points: np.ndarray) -> List[Tuple[int, int]]:
        """
        Sắp xếp 4 điểm theo thứ tự: top-left, top-right, bottom-right, bottom-left.
        """
        rect = np.zeros((4, 2), dtype=np.float32)

        s = points.sum(axis=1)
        diff = np.diff(points, axis=1)

        # Top-left: tổng nhỏ nhất
        rect[0] = points[np.argmin(s)]
        # Bottom-right: tổng lớn nhất
        rect[2] = points[np.argmax(s)]
        # Top-right: diff nhỏ nhất
        rect[1] = points[np.argmin(diff)]
        # Bottom-left: diff lớn nhất
        rect[3] = points[np.argmax(diff)]

        return [(int(p[0]), int(p[1])) for p in rect]

    # ─── Perspective Transform ───────────────────────────────────────────────

    def _perspective_transform(
        self, image: np.ndarray, src_corners: List[Tuple[int, int]]
    ) -> Optional[np.ndarray]:
        """
        Warp ảnh về khung chuẩn dựa vào 4 marker góc.
        """
        src = np.array(src_corners, dtype=np.float32)
        dst = np.array([
            [0, 0],
            [self.warp_width - 1, 0],
            [self.warp_width - 1, self.warp_height - 1],
            [0, self.warp_height - 1],
        ], dtype=np.float32)

        M = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(image, M, (self.warp_width, self.warp_height))
        return warped

    # ─── Threshold Calibration from Type Row ─────────────────────────────────

    def _calibrate_threshold_from_type(self, warped: np.ndarray) -> float:
        """
        Đọc hàng Type ở cuối phiếu → tính fill_ratio của ô trống/đầy
        → suy ra ngưỡng threshold riêng cho ảnh này.
        
        Pattern: [trống, trống, trống, trống, trống, đầy, đầy, trống, đầy]
        """
        type_bubbles = self.layout.get_type_bubbles()
        ratios = []

        for i, bubble in enumerate(type_bubbles):
            ratio = self._compute_fill_ratio(warped, bubble)
            ratios.append((i, ratio))

        # Tách thành 2 nhóm: ô trống và ô đầy (dựa trên pattern đã biết)
        filled_ratios = [r for i, r in ratios if i in self.layout.type_filled_indices]
        empty_ratios = [r for i, r in ratios if i in self.layout.type_empty_indices]

        if not filled_ratios or not empty_ratios:
            # Fallback: dùng Otsu trên toàn ảnh
            return self._otsu_threshold(warped)

        avg_filled = np.mean(filled_ratios)
        avg_empty = np.mean(empty_ratios)

        # Ngưỡng = trung bình cộng của 2 nhóm
        threshold = (avg_filled + avg_empty) / 2.0

        # Clamp trong khoảng hợp lý
        threshold = max(0.2, min(0.8, threshold))

        logger.debug(
            f"Type calibration: avg_filled={avg_filled:.3f}, "
            f"avg_empty={avg_empty:.3f}, threshold={threshold:.3f}"
        )
        return threshold

    def _otsu_threshold(self, warped: np.ndarray) -> float:
        """Fallback: dùng Otsu threshold trên ảnh grayscale."""
        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        _, otsu_thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # Tính tỷ lệ pixel trắng (ô tô) trên toàn ảnh
        white_ratio = np.sum(otsu_thresh == 255) / otsu_thresh.size
        return 0.3  # Default fallback

    # ─── Fill Ratio Computation ──────────────────────────────────────────────

    def _compute_fill_ratio(self, warped: np.ndarray, bubble: BubbleCoord) -> float:
        """
        Tính fill ratio của 1 ô bubble.
        fill_ratio = pixel_tổng / pixel_tổng_ô
        """
        h, w = warped.shape[:2]
        cx = int(bubble.cx / 100.0 * w)
        cy = int(bubble.cy / 100.0 * h)
        r = int(bubble.radius / 100.0 * w)  # Dùng width làm chuẩn cho bán kính

        # Tạo mask hình tròn
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.circle(mask, (cx, cy), r, 255, -1)

        # Chuyển sang grayscale nếu cần
        if len(warped.shape) == 3:
            gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        else:
            gray = warped

        # Threshold để tìm pixel tối (ô tô)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Tính fill ratio trong vùng mask
        masked = cv2.bitwise_and(binary, binary, mask=mask)
        total_pixels = cv2.countNonZero(mask)
        if total_pixels == 0:
            return 0.0
        filled_pixels = cv2.countNonZero(masked)
        return filled_pixels / total_pixels

    # ─── Read SBD ────────────────────────────────────────────────────────────

    def _read_sbd(self, warped: np.ndarray, threshold: float) -> Tuple[Optional[str], bool]:
        """
        Đọc Số báo danh từ lưới 6 cột x 10 hàng.
        Returns: (sbd_string, is_confident)
        """
        bubbles = self.layout.get_sbd_bubbles()
        digits = []

        for col_idx in range(self.layout.sbd_cols):
            col_bubbles = bubbles[col_idx]
            col_ratios = [self._compute_fill_ratio(warped, b) for b in col_bubbles]

            # Tìm ô có fill ratio cao nhất
            max_ratio = max(col_ratios)
            max_idx = col_ratios.index(max_ratio)

            # Kiểm tra confidence: chỉ 1 ô vượt ngưỡng, các ô còn lại thấp
            filled_count = sum(1 for r in col_ratios if r > threshold)

            if filled_count == 1 and max_ratio > threshold:
                digits.append(str(max_idx))
            elif filled_count == 0:
                # Ô trống → có thể thiếu sót
                digits.append("?")
            else:
                # Nhiều ô vượt ngưỡng → không chắc chắn
                digits.append("X")

        sbd = "".join(digits)
        # Confidence: không có ? hay X
        confident = "?" not in sbd and "X" not in sbd
        return sbd, confident

    # ─── Read Mã đề ──────────────────────────────────────────────────────────

    def _read_ma_de(self, warped: np.ndarray, threshold: float) -> Tuple[Optional[str], bool]:
        """
        Đọc Mã đề từ lưới 3 cột x 10 hàng.
        Returns: (ma_de_string, is_confident)
        """
        bubbles = self.layout.get_ma_de_bubbles()
        digits = []

        for col_idx in range(self.layout.ma_de_cols):
            col_bubbles = bubbles[col_idx]
            col_ratios = [self._compute_fill_ratio(warped, b) for b in col_bubbles]

            max_ratio = max(col_ratios)
            max_idx = col_ratios.index(max_ratio)
            filled_count = sum(1 for r in col_ratios if r > threshold)

            if filled_count == 1 and max_ratio > threshold:
                digits.append(str(max_idx))
            elif filled_count == 0:
                digits.append("?")
            else:
                digits.append("X")

        ma_de = "".join(digits)
        confident = "?" not in ma_de and "X" not in ma_de
        return ma_de, confident

    # ─── Read All Questions ──────────────────────────────────────────────────

    def _read_all_questions(
        self, warped: np.ndarray, threshold: float
    ) -> List[QuestionReadResult]:
        """Đọc 120 câu hỏi."""
        questions = []
        for q_no in range(1, 121):
            result = self._read_single_question(warped, q_no, threshold)
            questions.append(result)
        return questions

    def _read_single_question(
        self, warped: np.ndarray, question_no: int, threshold: float
    ) -> QuestionReadResult:
        """
        Đọc 1 câu hỏi (4 ô A/B/C/D).
        Logic quyết định:
        - 0 ô vượt ngưỡng → bỏ trống (selected=None)
        - Đúng 1 ô vượt ngưỡng → lấy làm đáp án, tính gap
        - ≥2 ô vượt ngưỡng → multi-mark → needs_review
        """
        bubbles = self.layout.get_question_bubbles(question_no)
        choice_labels = ["A", "B", "C", "D"]

        fill_ratios = {}
        for label, bubble in zip(choice_labels, bubbles):
            ratio = self._compute_fill_ratio(warped, bubble)
            fill_ratios[label] = ratio

        # Sắp xếp theo fill ratio giảm dần
        sorted_choices = sorted(fill_ratios.items(), key=lambda x: x[1], reverse=True)
        best_label, best_ratio = sorted_choices[0]
        second_ratio = sorted_choices[1][1] if len(sorted_choices) > 1 else 0.0

        # Đếm số ô vượt ngưỡng
        filled_count = sum(1 for r in fill_ratios.values() if r > threshold)
        gap = best_ratio - second_ratio

        # Decision logic
        selected = None
        needs_review = False
        confidence = 0.0

        if filled_count == 0:
            # Bỏ trống
            selected = None
            # Kiểm tra xem có ô nào gần ngưỡng không (auto needs_review)
            max_ratio = max(fill_ratios.values())
            if max_ratio > threshold * 0.7:  # Gần ngưỡng 70%
                needs_review = True
                confidence = 0.4
            else:
                confidence = 0.9  # Chắc chắn bỏ trống

        elif filled_count == 1:
            # Đúng 1 ô → lấy làm đáp án
            selected = best_label
            if gap < FILL_GAP_SAFE:
                # Gap quá nhỏ → không chắc chắn
                needs_review = True
                confidence = 0.5
            else:
                confidence = min(0.95, 0.7 + gap * 0.5)

        else:
            # ≥2 ô → multi-mark
            selected = None
            needs_review = True
            confidence = 0.3

        return QuestionReadResult(
            question_no=question_no,
            selected=selected,
            needs_review=needs_review,
            fill_ratios=fill_ratios,
            gap=gap,
            source="opencv",
            confidence=confidence,
        )


class OpenCVOMRProcessor:
    """
    Wrapper để chạy pipeline trên file ảnh hoặc URL.
    """

    def __init__(self, layout: Optional[SheetLayout] = None):
        self.pipeline = OpenCVOMRPipeline(layout)

    def process_file(self, file_path: str) -> SheetReadResult:
        """Xử lý file ảnh."""
        image = cv2.imread(file_path)
        if image is None:
            raise FileNotFoundError(f"Không đọc được ảnh: {file_path}")
        return self.pipeline.process(image)

    def process_bytes(self, image_bytes: bytes) -> SheetReadResult:
        """Xử lý bytes ảnh."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Không decode được ảnh từ bytes")
        return self.pipeline.process(image)

    def process_url(self, url: str) -> SheetReadResult:
        """Xử lý ảnh từ URL."""
        import httpx
        response = httpx.get(url, timeout=30.0)
        response.raise_for_status()
        return self.process_bytes(response.content)
