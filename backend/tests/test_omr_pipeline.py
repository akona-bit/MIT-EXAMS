"""
Unit tests cho OMR Pipeline (Lớp 1 — OpenCV).
Test marker detection, perspective transform, fill ratio, threshold calibration.
"""

import pytest
import numpy as np
import cv2
from unittest.mock import patch, MagicMock

from app.services.omr.layout_config import SheetLayout, BubbleCoord
from app.services.omr.layers.opencv_layer import (
    OpenCVOMRPipeline,
    OpenCVOMRProcessor,
    SheetReadResult,
    QuestionReadResult,
    MARKER_MIN_AREA,
    MARKER_MAX_AREA,
    FILL_GAP_SAFE,
)


# ─── Test Fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
def layout():
    return SheetLayout()


@pytest.fixture
def pipeline(layout):
    return OpenCVOMRPipeline(layout)


def _create_blank_sheet(width=1700, height=2200):
    """Tạo ảnh blank (trắng) để test."""
    return np.ones((height, width, 3), dtype=np.uint8) * 255


def _create_sheet_with_markers(width=1700, height=2200):
    """Tạo ảnh có 4 marker góc đen."""
    img = np.ones((height, width, 3), dtype=np.uint8) * 255

    marker_size = 40
    margin = 30

    # Top-left
    cv2.rectangle(img, (margin, margin), (margin + marker_size, margin + marker_size), (0, 0, 0), -1)
    # Top-right
    cv2.rectangle(img, (width - margin - marker_size, margin), (width - margin, margin + marker_size), (0, 0, 0), -1)
    # Bottom-right
    cv2.rectangle(img, (width - margin - marker_size, height - margin - marker_size), (width - margin, height - margin), (0, 0, 0), -1)
    # Bottom-left
    cv2.rectangle(img, (margin, height - margin - marker_size), (margin + marker_size, height - margin), (0, 0, 0), -1)

    return img


def _create_sheet_with_bubble(x_pct, y_pct, radius_pct=1.5, filled=True, width=1700, height=2200):
    """Tạo ảnh với 1 ô bubble tại vị trí % nhất định."""
    img = np.ones((height, width, 3), dtype=np.uint8) * 255

    cx = int(x_pct / 100.0 * width)
    cy = int(y_pct / 100.0 * height)
    r = int(radius_pct / 100.0 * width)

    color = (0, 0, 0) if filled else (255, 255, 255)
    cv2.circle(img, (cx, cy), r, color, -1)

    return img


# ─── Layout Config Tests ─────────────────────────────────────────────────────

class TestSheetLayout:
    def test_default_layout(self):
        layout = SheetLayout()
        assert layout.target_width == 1700
        assert layout.target_height == 2200
        assert len(layout.markers) == 4

    def test_sbd_bubbles_count(self):
        layout = SheetLayout()
        bubbles = layout.get_sbd_bubbles()
        assert len(bubbles) == 6  # 6 cột
        for col in bubbles:
            assert len(col) == 10  # 10 hàng (0-9)

    def test_ma_de_bubbles_count(self):
        layout = SheetLayout()
        bubbles = layout.get_ma_de_bubbles()
        assert len(bubbles) == 3  # 3 cột
        for col in bubbles:
            assert len(col) == 10

    def test_question_bubbles_count(self):
        layout = SheetLayout()
        for q_no in [1, 60, 120]:
            bubbles = layout.get_question_bubbles(q_no)
            assert len(bubbles) == 4  # A, B, C, D

    def test_question_bubbles_invalid(self):
        layout = SheetLayout()
        with pytest.raises(ValueError):
            layout.get_question_bubbles(0)
        with pytest.raises(ValueError):
            layout.get_question_bubbles(121)

    def test_all_questions_bubbles(self):
        layout = SheetLayout()
        all_bubbles = layout.get_all_question_bubbles()
        assert len(all_bubbles) == 120
        for q_no in range(1, 121):
            assert q_no in all_bubbles
            assert len(all_bubbles[q_no]) == 4

    def test_type_bubbles(self):
        layout = SheetLayout()
        bubbles = layout.get_type_bubbles()
        assert len(bubbles) == 9
        assert len(layout.type_filled_indices) == 3  # 5, 6, 8
        assert len(layout.type_empty_indices) == 6   # 0, 1, 2, 3, 4, 7

    def test_json_roundtrip(self):
        layout = SheetLayout()
        json_str = layout.to_json()
        restored = SheetLayout.from_json(json_str)
        assert restored.target_width == layout.target_width
        assert len(restored.markers) == len(layout.markers)


# ─── Marker Detection Tests ──────────────────────────────────────────────────

class TestMarkerDetection:
    def test_no_markers_blank_image(self, pipeline):
        img = _create_blank_sheet()
        markers = pipeline._detect_markers(img)
        # Blank image → không detect được marker
        assert markers is None or len(markers) < 4

    def test_detect_4_markers(self, pipeline):
        img = _create_sheet_with_markers()
        markers = pipeline._detect_markers(img)
        assert markers is not None
        assert len(markers) == 4

    def test_markers_order(self, pipeline):
        img = _create_sheet_with_markers()
        markers = pipeline._detect_markers(img)
        assert markers is not None

        # Top-left: x nhỏ nhất, y nhỏ nhất
        tl = markers[0]
        tr = markers[1]
        br = markers[2]
        bl = markers[3]

        assert tl[0] < tr[0]  # TL.x < TR.x
        assert tl[1] < bl[1]  # TL.y < BL.y
        assert br[0] > bl[0]  # BR.x > BL.x
        assert br[1] > tr[1]  # BR.y > TR.y

    def test_insufficient_markers(self, pipeline):
        img = _create_blank_sheet()
        # Thêm chỉ 2 marker
        cv2.rectangle(img, (30, 30), (70, 70), (0, 0, 0), -1)
        cv2.rectangle(img, (1630, 30), (1670, 70), (0, 0, 0), -1)

        markers = pipeline._detect_markers(img)
        assert markers is None or len(markers) < 4


# ─── Perspective Transform Tests ─────────────────────────────────────────────

class TestPerspectiveTransform:
    def test_warp_identity(self, pipeline):
        """Test warp với src = dst → ảnh giữ nguyên."""
        img = _create_blank_sheet()
        corners = [(0, 0), (1699, 0), (1699, 2199), (0, 2199)]
        warped = pipeline._perspective_transform(img, corners)
        assert warped is not None
        assert warped.shape[:2] == (2200, 1700)

    def test_warp_with_markers(self, pipeline):
        img = _create_sheet_with_markers()
        markers = pipeline._detect_markers(img)
        assert markers is not None

        warped = pipeline._perspective_transform(img, markers)
        assert warped is not None
        assert warped.shape[:2] == (2200, 1700)


# ─── Fill Ratio Tests ────────────────────────────────────────────────────────

class TestFillRatio:
    def test_empty_bubble(self, pipeline):
        bubble = BubbleCoord(cx=50.0, cy=50.0, radius=2.0)
        img = _create_blank_sheet()
        ratio = pipeline._compute_fill_ratio(img, bubble)
        assert ratio < 0.3  # Ô trống → ratio thấp

    def test_filled_bubble(self, pipeline):
        bubble = BubbleCoord(cx=50.0, cy=50.0, radius=2.0)
        img = _create_sheet_with_bubble(50.0, 50.0, filled=True)
        ratio = pipeline._compute_fill_ratio(img, bubble)
        assert ratio > 0.5  # Ô đầy → ratio cao

    def test_partially_filled(self, pipeline):
        bubble = BubbleCoord(cx=50.0, cy=50.0, radius=2.0)
        # Tạo ảnh với bubble chỉ đầy 50%
        img = np.ones((2200, 1700, 3), dtype=np.uint8) * 255
        cx = int(50.0 / 100.0 * 1700)
        cy = int(50.0 / 100.0 * 2200)
        r = int(2.0 / 100.0 * 1700)
        # Chỉ nửa dưới đầy
        cv2.ellipse(img, (cx, cy), (r, r), 0, 0, 180, (0, 0, 0), -1)

        ratio = pipeline._compute_fill_ratio(img, bubble)
        assert 0.3 < ratio < 0.8  # Nửa đầy


# ─── Threshold Calibration Tests ─────────────────────────────────────────────

class TestThresholdCalibration:
    def test_calibration_returns_valid_threshold(self, pipeline):
        """Test rằng calibration trả về threshold trong khoảng hợp lý."""
        img = _create_blank_sheet()
        threshold = pipeline._calibrate_threshold_from_type(img)
        assert 0.1 <= threshold <= 0.9

    def test_calibration_with_filled_type(self, pipeline):
        """Test calibration với Type row có ô đầy."""
        img = _create_blank_sheet()
        layout = pipeline.layout

        # Tô đầy các ô Type theo pattern
        type_bubbles = layout.get_type_bubbles()
        for i, b in enumerate(type_bubbles):
            if i in layout.type_filled_indices:
                cx = int(b.cx / 100.0 * 1700)
                cy = int(b.cy / 100.0 * 2200)
                r = int(b.radius / 100.0 * 1700)
                cv2.circle(img, (cx, cy), r, (0, 0, 0), -1)

        threshold = pipeline._calibrate_threshold_from_type(img)
        assert 0.2 <= threshold <= 0.8


# ─── Question Read Tests ─────────────────────────────────────────────────────

class TestQuestionRead:
    def test_single_filled_bubble(self, pipeline):
        """Test đọc 1 câu có đúng 1 ô được tô."""
        layout = pipeline.layout
        q_bubbles = layout.get_question_bubbles(1)

        # Tạo ảnh với bubble A được tô
        img = _create_blank_sheet()
        a_bubble = q_bubbles[0]
        cx = int(a_bubble.cx / 100.0 * 1700)
        cy = int(a_bubble.cy / 100.0 * 2200)
        r = int(a_bubble.radius / 100.0 * 1700)
        cv2.circle(img, (cx, cy), r, (0, 0, 0), -1)

        result = pipeline._read_single_question(img, 1, threshold=0.3)
        assert result.selected == "A"
        assert not result.needs_review
        assert result.fill_ratios["A"] > 0.5

    def test_no_filled_bubble(self, pipeline):
        """Test đọc 1 câu bỏ trống."""
        img = _create_blank_sheet()
        result = pipeline._read_single_question(img, 1, threshold=0.3)
        assert result.selected is None
        assert not result.needs_review

    def test_multi_marked_bubble(self, pipeline):
        """Test đọc 1 câu tô đè 2 ô."""
        layout = pipeline.layout
        q_bubbles = layout.get_question_bubbles(1)

        img = _create_blank_sheet()
        # Tô đầy cả A và B
        for b in q_bubbles[:2]:
            cx = int(b.cx / 100.0 * 1700)
            cy = int(b.cy / 100.0 * 2200)
            r = int(b.radius / 100.0 * 1700)
            cv2.circle(img, (cx, cy), r, (0, 0, 0), -1)

        result = pipeline._read_single_question(img, 1, threshold=0.3)
        assert result.selected is None
        assert result.needs_review


# ─── SBD Read Tests ──────────────────────────────────────────────────────────

class TestSBDRead:
    def test_read_empty_sbd(self, pipeline):
        img = _create_blank_sheet()
        sbd, confident = pipeline._read_sbd(img, threshold=0.3)
        assert sbd is not None
        assert len(sbd) == 6
        # Tất cả ô trống → digits là "?"
        assert "?" in sbd or sbd == "000000"

    def test_read_single_digit_sbd(self, pipeline):
        """Test đọc SBD với 1 chữ số được tô."""
        layout = pipeline.layout
        sbd_bubbles = layout.get_sbd_bubbles()

        img = _create_blank_sheet()
        # Tô chữ số "5" ở cột đầu tiên (index 5 = chữ số 5)
        b = sbd_bubbles[0][5]  # cột 0, hàng 5
        cx = int(b.cx / 100.0 * 1700)
        cy = int(b.cy / 100.0 * 2200)
        r = int(b.radius / 100.0 * 1700)
        cv2.circle(img, (cx, cy), r, (0, 0, 0), -1)

        sbd, confident = pipeline._read_sbd(img, threshold=0.3)
        assert sbd[0] == "5"  # Chữ số đầu tiên là 5


# ─── Full Pipeline Tests ─────────────────────────────────────────────────────

class TestFullPipeline:
    def test_process_blank_image(self, pipeline):
        """Test process ảnh blank → needs_review do không detect marker."""
        img = _create_blank_sheet()
        result = pipeline.process(img)
        assert result.needs_review_count > 0 or not result.sbd_confident

    def test_process_with_markers(self, pipeline):
        """Test process ảnh có markers."""
        img = _create_sheet_with_markers()
        result = pipeline.process(img)
        # Có thể không detect đủ bubble nhưng markers phải OK
        assert result.warped_image is not None

    def test_process_returns_120_questions(self, pipeline):
        """Test kết quả có đúng 120 câu."""
        img = _create_sheet_with_markers()
        result = pipeline.process(img)
        assert len(result.questions) == 120


# ─── Edge Case Tests ─────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_grayscale_input(self, pipeline):
        """Test input grayscale (1 channel)."""
        gray = np.ones((2200, 1700), dtype=np.uint8) * 255
        result = pipeline.process(gray)
        assert isinstance(result, SheetReadResult)

    def test_small_image(self, pipeline):
        """Test ảnh nhỏ hơn bình thường."""
        small = np.ones((500, 400, 3), dtype=np.uint8) * 255
        result = pipeline.process(small)
        assert isinstance(result, SheetReadResult)

    def test_very_dark_image(self, pipeline):
        """Test ảnh rất tối."""
        dark = np.ones((2200, 1700, 3), dtype=np.uint8) * 30
        result = pipeline.process(dark)
        assert isinstance(result, SheetReadResult)

    def test_very_bright_image(self, pipeline):
        """Test ảnh rất sáng."""
        bright = np.ones((2200, 1700, 3), dtype=np.uint8) * 250
        result = pipeline.process(bright)
        assert isinstance(result, SheetReadResult)


# ─── Processor Tests ─────────────────────────────────────────────────────────

class TestProcessor:
    def test_process_bytes(self):
        """Test process từ bytes."""
        img = _create_blank_sheet()
        _, buf = cv2.imencode('.jpg', img)
        processor = OpenCVOMRProcessor()
        result = processor.process_bytes(buf.tobytes())
        assert isinstance(result, SheetReadResult)

    def test_process_file_not_found(self):
        """Test process file không tồn tại."""
        processor = OpenCVOMRProcessor()
        with pytest.raises(FileNotFoundError):
            processor.process_file("nonexistent.jpg")
