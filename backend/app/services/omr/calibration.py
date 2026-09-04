"""
Calibration Tool — Tự động detect toạ độ bubble từ ảnh phiếu trống.
Admin upload ảnh scan phẳng độ phân giải cao của phiếu trống,
tool tự động dò tâm từng bubble bằng contour detection, xuất ra file config JSON.
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
import json
import logging

from app.services.omr.layout_config import SheetLayout, BubbleCoord

logger = logging.getLogger(__name__)


@dataclass
class DetectedBubble:
    """Bubble đã detect được từ contour detection."""
    cx: float  # % width
    cy: float  # % height
    radius: float  # % width
    area: float  # pixel²
    row: int = -1
    col: int = -1
    label: str = ""  # "SBD_0_0", "Q1_A", etc.


class CalibrationTool:
    """
    Tool calibrate toạ độ bubble từ ảnh phiếu trống.
    
    Quy trình:
    1. Đọc ảnh phiếu trống (scan phẳng, không tô)
    2. Detect 4 marker góc → warp về khung chuẩn
    3. Detect tất cả contour hình tròn (bubble)
    4. Cluster thành các nhóm (SBD, Mã đề, câu hỏi, Type)
    5. Gán row/col cho từng bubble
    6. Xuất ra file JSON
    """

    def __init__(self, target_width: int = 1700, target_height: int = 2200):
        self.target_width = target_width
        self.target_height = target_height

    def calibrate(self, image: np.ndarray) -> Dict:
        """
        Calibration chính: detect bubbles từ ảnh phiếu trống.
        
        Args:
            image: ảnh phiếu trống (BGR)
            
        Returns:
            Dict chứa detected bubbles và layout config
        """
        # 1. Detect markers và warp
        warped = self._warp_image(image)
        if warped is None:
            raise ValueError("Không detect được 4 marker góc. Ảnh phải có 4 marker đen ở 4 góc.")

        # 2. Detect tất cả bubble contours
        raw_bubbles = self._detect_bubble_contours(warped)

        # 3. Cluster bubbles thành các nhóm
        clustered = self._cluster_bubbles(raw_bubbles)

        # 4. Tạo layout config từ detected bubbles
        layout = self._build_layout_from_detections(clustered)

        return {
            "warped_image": warped,
            "raw_bubbles": raw_bubbles,
            "clustered": clustered,
            "layout": layout,
        }

    def _warp_image(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Detect markers và warp ảnh."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        h, w = image.shape[:2]
        min_area = 500 * (h * w / (2000 * 2500))
        max_area = 50000 * (h * w / (2000 * 2500))

        candidates = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < min_area or area > max_area:
                continue

            x, y, cw, ch = cv2.boundingRect(contour)
            aspect = cw / ch if ch > 0 else 0
            if not (0.7 <= aspect <= 1.4):
                continue

            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            solidity = area / hull_area if hull_area > 0 else 0
            if solidity < 0.7:
                continue

            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            candidates.append((cx, cy, area))

        if len(candidates) < 4:
            return None

        candidates.sort(key=lambda c: c[2], reverse=True)
        candidates = candidates[:4]
        points = np.array([(c[0], c[1]) for c in candidates], dtype=np.float32)

        # Sắp xếp corners
        rect = np.zeros((4, 2), dtype=np.float32)
        s = points.sum(axis=1)
        diff = np.diff(points, axis=1)
        rect[0] = points[np.argmin(s)]
        rect[2] = points[np.argmax(s)]
        rect[1] = points[np.argmin(diff)]
        rect[3] = points[np.argmax(diff)]

        dst = np.array([
            [0, 0],
            [self.target_width - 1, 0],
            [self.target_width - 1, self.target_height - 1],
            [0, self.target_height - 1],
        ], dtype=np.float32)

        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(image, M, (self.target_width, self.target_height))
        return warped

    def _detect_bubble_contours(self, warped: np.ndarray) -> List[DetectedBubble]:
        """Detect tất cả contour hình tròn (bubble) trong ảnh đã warp."""
        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

        # Threshold để tìm viền bubble (ô trống = viền đen, bên trong trắng)
        edges = cv2.Canny(gray, 50, 150)

        # Dilate để nối các viền đứt
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=1)

        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        h, w = warped.shape[:2]
        min_radius = int(0.5 / 100.0 * w)  # Bán kính tối thiểu ~0.5% width
        max_radius = int(3.0 / 100.0 * w)  # Bán kính tối đa ~3% width

        detected = []
        for contour in contours:
            # Chỉ giữ contour gần tròn
            perimeter = cv2.arcLength(contour, True)
            if perimeter == 0:
                continue
            circularity = 4 * np.pi * cv2.contourArea(contour) / (perimeter * perimeter)
            if circularity < 0.5:  # Không đủ tròn
                continue

            # Fit ellipse nếu đủ points
            if len(contour) >= 5:
                ellipse = cv2.fitEllipse(contour)
                (cx, cy), (ma, mb), angle = ellipse
                radius = min(ma, mb) / 2
            else:
                M = cv2.moments(contour)
                if M["m00"] == 0:
                    continue
                cx = M["m10"] / M["m00"]
                cy = M["m01"] / M["m00"]
                radius = np.sqrt(cv2.contourArea(contour) / np.pi)

            if radius < min_radius or radius > max_radius:
                continue

            # Convert sang %
            cx_pct = cx / w * 100
            cy_pct = cy / h * 100
            radius_pct = radius / w * 100

            detected.append(DetectedBubble(
                cx=cx_pct,
                cy=cy_pct,
                radius=radius_pct,
                area=cv2.contourArea(contour),
            ))

        return detected

    def _cluster_bubbles(self, bubbles: List[DetectedBubble]) -> Dict[str, List[DetectedBubble]]:
        """
        Cluster bubbles thành các nhóm dựa trên vị trí:
        - SBD: vùng trên-trái (cy < 60%, cx < 40%)
        - MaDe: vùng trên-giữa (cy < 60%, 40% < cx < 60%)
        - Questions: vùng giữa-dưới (cy > 60%)
        - Type: vùng dưới cùng (cy > 90%)
        """
        clusters = {
            "sbd": [],
            "ma_de": [],
            "questions": [],
            "type": [],
            "unknown": [],
        }

        for b in bubbles:
            if b.cy < 60 and b.cx < 40:
                clusters["sbd"].append(b)
            elif b.cy < 60 and 40 <= b.cx < 60:
                clusters["ma_de"].append(b)
            elif b.cy > 90:
                clusters["type"].append(b)
            elif b.cy > 60:
                clusters["questions"].append(b)
            else:
                clusters["unknown"].append(b)

        # Gán row/col cho từng cluster
        self._assign_grid_coords(clusters["sbd"], cols=6, rows=10, label_prefix="SBD")
        self._assign_grid_coords(clusters["ma_de"], cols=3, rows=10, label_prefix="MD")
        self._assign_grid_coords(clusters["type"], cols=9, rows=1, label_prefix="TYPE")

        # Cluster questions thành 5 blocks x 24 câu x 4 choices
        self._assign_question_coords(clusters["questions"])

        return clusters

    def _assign_grid_coords(
        self,
        bubbles: List[DetectedBubble],
        cols: int,
        rows: int,
        label_prefix: str,
    ):
        """Gán row/col cho bubbles trong grid dựa trên vị trí."""
        if not bubbles:
            return

        # Sắp xếp theo cy rồi cx
        bubbles.sort(key=lambda b: (b.cy, b.cx))

        # Tính median radius để phân biệt rows
        radii = [b.radius for b in bubbles]
        median_r = np.median(radii) if radii else 1.0

        # Cluster rows dựa trên cy
        rows_groups = []
        current_row = [bubbles[0]]
        for b in bubbles[1:]:
            if abs(b.cy - current_row[-1].cy) < median_r * 1.5:
                current_row.append(b)
            else:
                rows_groups.append(current_row)
                current_row = [b]
        rows_groups.append(current_row)

        for row_idx, row_bubbles in enumerate(rows_groups[:rows]):
            row_bubbles.sort(key=lambda b: b.cx)
            for col_idx, b in enumerate(row_bubbles[:cols]):
                b.row = row_idx
                b.col = col_idx
                b.label = f"{label_prefix}_{row_idx}_{col_idx}"

    def _assign_question_coords(self, bubbles: List[DetectedBubble]):
        """Gán question_no và choice (A/B/C/D) cho bubbles câu hỏi."""
        if not bubbles:
            return

        # Sắp xếp theo cy rồi cx
        bubbles.sort(key=lambda b: (b.cy, b.cx))

        # Cluster thành rows
        radii = [b.radius for b in bubbles]
        median_r = np.median(radii) if radii else 1.0

        rows_groups = []
        current_row = [bubbles[0]]
        for b in bubbles[1:]:
            if abs(b.cy - current_row[-1].cy) < median_r * 1.5:
                current_row.append(b)
            else:
                rows_groups.append(current_row)
                current_row = [b]
        rows_groups.append(current_row)

        # Mỗi row có 4 bubbles (A/B/C/D) cho 1 câu
        q_no = 1
        choice_labels = ["A", "B", "C", "D"]

        for row_bubbles in rows_groups:
            row_bubbles.sort(key=lambda b: b.cx)
            for i in range(0, len(row_bubbles), 4):
                chunk = row_bubbles[i:i+4]
                for j, b in enumerate(chunk):
                    if j < 4:
                        b.row = q_no
                        b.col = j
                        b.label = f"Q{q_no}_{choice_labels[j]}"
                q_no += 1

    def _build_layout_from_detections(
        self, clustered: Dict[str, List[DetectedBubble]]
    ) -> SheetLayout:
        """Tạo SheetLayout từ detected bubbles."""
        layout = SheetLayout()

        # Update SBD origin và cell sizes
        sbd_bubbles = clustered.get("sbd", [])
        if sbd_bubbles:
            min_cx = min(b.cx for b in sbd_bubbles)
            min_cy = min(b.cy for b in sbd_bubbles)
            max_cx = max(b.cx for b in sbd_bubbles)
            max_cy = max(b.cy for b in sbd_bubbles)

            layout.sbd_origin = (min_cx - 1.0, min_cy - 1.0)
            if layout.sbd_cols > 0:
                layout.sbd_cell_w = (max_cx - min_cx) / (layout.sbd_cols - 1) if layout.sbd_cols > 1 else 4.5
            if layout.sbd_rows > 0:
                layout.sbd_cell_h = (max_cy - min_cy) / (layout.sbd_rows - 1) if layout.sbd_rows > 1 else 5.0

        # Update MaDe origin
        ma_de_bubbles = clustered.get("ma_de", [])
        if ma_de_bubbles:
            min_cx = min(b.cx for b in ma_de_bubbles)
            min_cy = min(b.cy for b in ma_de_bubbles)
            layout.ma_de_origin = (min_cx - 1.0, min_cy - 1.0)

        return layout

    def export_layout(self, result: Dict, output_path: str) -> str:
        """Export detected layout ra file JSON."""
        layout = result["layout"]

        # Thêm thông tin detected
        export_data = {
            "target_width": self.target_width,
            "target_height": self.target_height,
            "sbd_origin": layout.sbd_origin,
            "sbd_cols": layout.sbd_cols,
            "sbd_rows": layout.sbd_rows,
            "sbd_cell_w": round(layout.sbd_cell_w, 2),
            "sbd_cell_h": round(layout.sbd_cell_h, 2),
            "ma_de_origin": layout.ma_de_origin,
            "ma_de_cols": layout.ma_de_cols,
            "ma_de_rows": layout.ma_de_rows,
            "ma_de_cell_w": round(layout.ma_de_cell_w, 2),
            "ma_de_cell_h": round(layout.ma_de_cell_h, 2),
            "detected_bubbles": {
                "sbd": [
                    {"row": b.row, "col": b.col, "cx": round(b.cx, 2), "cy": round(b.cy, 2), "radius": round(b.radius, 2)}
                    for b in result["clustered"].get("sbd", [])
                ],
                "ma_de": [
                    {"row": b.row, "col": b.col, "cx": round(b.cx, 2), "cy": round(b.cy, 2), "radius": round(b.radius, 2)}
                    for b in result["clustered"].get("ma_de", [])
                ],
                "questions": [
                    {"label": b.label, "cx": round(b.cx, 2), "cy": round(b.cy, 2), "radius": round(b.radius, 2)}
                    for b in result["clustered"].get("questions", [])
                ],
                "type": [
                    {"col": b.col, "cx": round(b.cx, 2), "cy": round(b.cy, 2), "radius": round(b.radius, 2)}
                    for b in result["clustered"].get("type", [])
                ],
            },
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)

        return output_path

    def visualize_calibration(
        self,
        warped: np.ndarray,
        clustered: Dict[str, List[DetectedBubble]],
        output_path: Optional[str] = None,
    ) -> np.ndarray:
        """
        Vẽ visualize lên ảnh đã warp để admin kiểm tra kết quả calibration.
        """
        vis = warped.copy()
        h, w = vis.shape[:2]

        # Vẽ SBD bubbles (xanh lá)
        for b in clustered.get("sbd", []):
            cx = int(b.cx / 100 * w)
            cy = int(b.cy / 100 * h)
            r = int(b.radius / 100 * w)
            cv2.circle(vis, (cx, cy), r, (0, 255, 0), 2)
            if b.label:
                cv2.putText(vis, b.label, (cx - 20, cy - r - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)

        # Vẽ MaDe bubbles (xanh dương)
        for b in clustered.get("ma_de", []):
            cx = int(b.cx / 100 * w)
            cy = int(b.cy / 100 * h)
            r = int(b.radius / 100 * w)
            cv2.circle(vis, (cx, cy), r, (255, 0, 0), 2)
            if b.label:
                cv2.putText(vis, b.label, (cx - 20, cy - r - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 0, 0), 1)

        # Vẽ Question bubbles (đỏ)
        for b in clustered.get("questions", []):
            cx = int(b.cx / 100 * w)
            cy = int(b.cy / 100 * h)
            r = int(b.radius / 100 * w)
            cv2.circle(vis, (cx, cy), r, (0, 0, 255), 2)
            if b.label and "A" in b.label:
                cv2.putText(vis, b.label, (cx - 15, cy - r - 3),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.25, (0, 0, 255), 1)

        # Vẽ Type bubbles (vàng)
        for b in clustered.get("type", []):
            cx = int(b.cx / 100 * w)
            cy = int(b.cy / 100 * h)
            r = int(b.radius / 100 * w)
            cv2.circle(vis, (cx, cy), r, (0, 255, 255), 2)

        if output_path:
            cv2.imwrite(output_path, vis)
            logger.info(f"Calibration visualization saved to {output_path}")

        return vis


def run_calibration(
    image_path: str,
    output_json_path: str,
    visualization_path: Optional[str] = None,
) -> Dict:
    """
    Hàm便捷 để chạy calibration từ file ảnh.
    
    Args:
        image_path: đường dẫn ảnh phiếu trống
        output_json_path: đường dẫn file JSON output
        visualization_path: (tuỳ chọn) đường dẫn ảnh visualization
        
    Returns:
        Dict kết quả calibration
    """
    image = cv2.imread(image_path)
    if image is None:
        raise FileNotFoundError(f"Không đọc được ảnh: {image_path}")

    tool = CalibrationTool()
    result = tool.calibrate(image)

    # Export layout
    tool.export_layout(result, output_json_path)
    logger.info(f"Layout exported to {output_json_path}")

    # Visualize
    if visualization_path:
        tool.visualize_calibration(
            result["warped_image"],
            result["clustered"],
            visualization_path,
        )

    return {
        "output_json": output_json_path,
        "visualization": visualization_path,
        "detected_bubbles": {
            "sbd": len(result["clustered"].get("sbd", [])),
            "ma_de": len(result["clustered"].get("ma_de", [])),
            "questions": len(result["clustered"].get("questions", [])),
            "type": len(result["clustered"].get("type", [])),
        },
    }
