"""
Layout configuration cho phiếu trả lời trắc nghiệm v20.0.
Tọa độ tính theo % kích thước ảnh sau khi warp về khung chuẩn.
"""

from dataclasses import asdict, dataclass, field
from typing import Dict, List, Tuple
import json
import os


@dataclass
class BubbleCoord:
    """Tọa độ 1 ô bubble (tâm + bán kính) theo %."""
    cx: float  # % width
    cy: float  # % height
    radius: float  # % width (bán kính ô tròn)


@dataclass
class MarkerCoord:
    """Tọa độ marker góc theo %."""
    cx: float
    cy: float


@dataclass
class SheetLayout:
    """Layout hoàn chỉnh của phiếu trả lời."""
    # Kích thước khung sau warp (pixel)
    target_width: int = 1700
    target_height: int = 2200

    # 4 marker góc (top-left, top-right, bottom-right, bottom-left)
    markers: List[MarkerCoord] = field(default_factory=lambda: [
        MarkerCoord(cx=2.5, cy=2.5),    # Top-left
        MarkerCoord(cx=97.5, cy=2.5),   # Top-right
        MarkerCoord(cx=97.5, cy=97.5),  # Bottom-right
        MarkerCoord(cx=2.5, cy=97.5),   # Bottom-left
    ])

    # Ô Số báo danh: 10 hàng (0-9) x 6 cột
    sbd_origin: Tuple[float, float] = (8.0, 8.0)  # % top-left của lưới SBD
    sbd_cols: int = 6
    sbd_rows: int = 10
    sbd_cell_w: float = 4.5  # % width mỗi cột
    sbd_cell_h: float = 5.0  # % height mỗi hàng
    sbd_bubble_r: float = 1.8  # % bán kính ô bubble

    # Ô Mã đề: 10 hàng (0-9) x 3 cột
    ma_de_origin: Tuple[float, float] = (42.0, 8.0)
    ma_de_cols: int = 3
    ma_de_rows: int = 10
    ma_de_cell_w: float = 4.5
    ma_de_cell_h: float = 5.0
    ma_de_bubble_r: float = 1.8

    # 120 câu hỏi: 5 khối, mỗi khối 24 câu x 4 lựa chọn (A/B/C/D)
    # Khối 1: câu 1-24, Khối 2: 25-48, Khối 3: 49-72, Khối 4: 73-96, Khối 5: 97-120
    blocks: List[Dict] = field(default_factory=lambda: [
        {"start": 1, "end": 24, "origin_x": 8.0, "origin_y": 62.0},
        {"start": 25, "end": 48, "origin_x": 28.0, "origin_y": 62.0},
        {"start": 49, "end": 72, "origin_x": 48.0, "origin_y": 62.0},
        {"start": 73, "end": 96, "origin_x": 68.0, "origin_y": 62.0},
        {"start": 97, "end": 120, "origin_x": 88.0, "origin_y": 62.0},
    ])
    question_cell_w: float = 4.0  # % width mỗi ô đáp án (A/B/C/D)
    question_cell_h: float = 3.5  # % height mỗi câu
    question_bubble_r: float = 1.2  # % bán kính ô bubble câu hỏi

    # Hàng Type (calibration pattern) ở cuối trang
    # 8 ô bubble: pattern cố định [trống, trống, trống, trống, trống, đầy, đầy, trống, đầy]
    type_origin: Tuple[float, float] = (8.0, 95.0)
    type_cols: int = 9  # 9 ô để chứa pattern 5+2+1+1
    type_cell_w: float = 4.5
    type_bubble_r: float = 1.5
    # Index các ô ĐẦY trong pattern (0-indexed): 5, 6, 8
    type_filled_indices: List[int] = field(default_factory=lambda: [5, 6, 8])
    # Index các ô TRỐNG: 0, 1, 2, 3, 4, 7
    type_empty_indices: List[int] = field(default_factory=lambda: [0, 1, 2, 3, 4, 7])

    def get_sbd_bubbles(self) -> List[List[BubbleCoord]]:
        """Trả về lưới SBD: bubbles[col][row], mỗi cột có 10 ô (0-9)."""
        bubbles = []
        for col in range(self.sbd_cols):
            col_bubbles = []
            for row in range(self.sbd_rows):
                cx = self.sbd_origin[0] + col * self.sbd_cell_w + self.sbd_cell_w / 2
                cy = self.sbd_origin[1] + row * self.sbd_cell_h + self.sbd_cell_h / 2
                col_bubbles.append(BubbleCoord(cx=cx, cy=cy, radius=self.sbd_bubble_r))
            bubbles.append(col_bubbles)
        return bubbles

    def get_ma_de_bubbles(self) -> List[List[BubbleCoord]]:
        """Trả về lưới Mã đề: bubbles[col][row], mỗi cột có 10 ô (0-9)."""
        bubbles = []
        for col in range(self.ma_de_cols):
            col_bubbles = []
            for row in range(self.ma_de_rows):
                cx = self.ma_de_origin[0] + col * self.ma_de_cell_w + self.ma_de_cell_w / 2
                cy = self.ma_de_origin[1] + row * self.ma_de_cell_h + self.ma_de_cell_h / 2
                col_bubbles.append(BubbleCoord(cx=cx, cy=cy, radius=self.ma_de_bubble_r))
            bubbles.append(col_bubbles)
        return bubbles

    def get_question_bubbles(self, question_no: int) -> List[BubbleCoord]:
        """Trả về 4 ô A/B/C/D cho 1 câu hỏi."""
        if not 1 <= question_no <= 120:
            raise ValueError(f"question_no must be 1-120, got {question_no}")

        block_idx = (question_no - 1) // 24
        block = self.blocks[block_idx]
        local_idx = (question_no - 1) % 24

        # Mỗi câu có 4 ô A/B/C/D, mỗi ô 1 cột
        row_in_block = local_idx // 1  # 1 câu trên 1 hàng

        bubbles = []
        for choice in range(4):  # A=0, B=1, C=2, D=3
            cx = block["origin_x"] + choice * self.question_cell_w + self.question_cell_w / 2
            cy = block["origin_y"] + row_in_block * self.question_cell_h + self.question_cell_h / 2
            bubbles.append(BubbleCoord(cx=cx, cy=cy, radius=self.question_bubble_r))
        return bubbles

    def get_all_question_bubbles(self) -> Dict[int, List[BubbleCoord]]:
        """Trả về dict {question_no: [A, B, C, D]} cho 120 câu."""
        return {q: self.get_question_bubbles(q) for q in range(1, 121)}

    def get_type_bubbles(self) -> List[BubbleCoord]:
        """Trả về các ô bubble ở hàng Type (calibration pattern)."""
        bubbles = []
        for i in range(self.type_cols):
            cx = self.type_origin[0] + i * self.type_cell_w + self.type_cell_w / 2
            cy = self.type_origin[1]
            bubbles.append(BubbleCoord(cx=cx, cy=cy, radius=self.type_bubble_r))
        return bubbles

    def to_json(self) -> str:
        """Export layout ra JSON."""
        return json.dumps(asdict(self), indent=2, ensure_ascii=False)

    @classmethod
    def from_json(cls, json_str: str) -> "SheetLayout":
        """Import layout từ JSON."""
        data = json.loads(json_str)
        markers = [MarkerCoord(**m) for m in data.pop("markers", [])]
        blocks = data.pop("blocks", [])
        layout = cls(**data)
        layout.markers = markers
        layout.blocks = blocks
        return layout

    @classmethod
    def from_file(cls, path: str) -> "SheetLayout":
        """Load layout từ file JSON."""
        if not os.path.exists(path):
            return cls()  # Return default
        with open(path, "r", encoding="utf-8") as f:
            return cls.from_json(f.read())

    def save(self, path: str) -> None:
        """Lưu layout ra file JSON."""
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.to_json())
