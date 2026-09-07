"""Tests cho Blueprint ĐGNL chuẩn 120 câu và engine giữ khung xương."""
import random
import pytest

from app.services.dgnl_blueprint import (
    BLUEPRINT_SLOTS,
    SCIENCE_FIELD_ORDER,
    get_blueprint,
    match_nodes,
    validate_blueprint,
)
from app.services.exam_matrix_generator import (
    CandidateQuestion,
    CellResult,
    MatrixCell,
    build_form_layout,
)


# ---------------------------------------------------------------------------
# Blueprint structure
# ---------------------------------------------------------------------------

def test_blueprint_structure_is_valid():
    errors = validate_blueprint()
    assert errors == [], f"Blueprint lệch cấu trúc: {errors}"


def test_blueprint_totals():
    assert sum(s.count for s in BLUEPRINT_SLOTS) == 120
    for part in (1, 2, 3, 4):
        assert sum(s.count for s in BLUEPRINT_SLOTS if s.part == part) == 30


def test_blueprint_get_json_ranges_match_standard_30_each():
    bp = get_blueprint()
    assert bp["total_questions"] == 120
    ranges = {p["part"]: p["question_range"] for p in bp["parts"]}
    assert ranges[1] == "1-30"
    assert ranges[2] == "31-60"
    assert ranges[3] == "61-90"
    assert ranges[4] == "91-120"


def test_blueprint_math_first_two_blocks_locked():
    math_slots = sorted((s for s in BLUEPRINT_SLOTS if s.part == 3), key=lambda s: s.position)
    assert math_slots[0].order_locked and math_slots[1].order_locked
    assert math_slots[0].node_hint == "Đại số cơ bản"
    assert math_slots[1].node_hint == "Mũ - Logarit"
    # xác suất & hình chóp luôn 3 câu
    by_hint = {s.node_hint: s.count for s in math_slots}
    assert by_hint["Xác suất"] == 3
    assert by_hint["Hình chóp"] == 3


def test_blueprint_science_field_sequence_hard_locked():
    tdkh = sorted((s for s in BLUEPRINT_SLOTS if s.part == 4), key=lambda s: s.position)
    hints = [s.node_hint for s in tdkh]
    # logic trước số liệu
    assert hints[:2] == ["Suy luận logic", "Suy luận logic"]
    assert hints[2:4] == ["Phân tích số liệu", "Phân tích số liệu"]
    # 6 lĩnh vực theo trình tự bất biến
    assert hints[4:10] == SCIENCE_FIELD_ORDER
    assert all(s.order_locked for s in tdkh), "Toàn bộ phần TDKH phải là trình tự cứng"


def test_blueprint_passage_blocks_sizes_match_analysis():
    """Khối chung ngữ liệu phải khớp 12+5+5 (TV) và 7+8 (TA)."""
    tv = sorted((s for s in BLUEPRINT_SLOTS if s.part == 1 and s.passage), key=lambda s: s.position)
    assert [s.count for s in tv] == [12, 5, 5]
    ta = sorted((s for s in BLUEPRINT_SLOTS if s.part == 2 and s.passage), key=lambda s: s.position)
    assert [s.count for s in ta] == [7, 8]
    assert all(s.group for s in tv + ta)


def test_match_nodes_exact_and_contains():
    nodes = [
        {"id": 1, "name": "Đại số cơ bản"},
        {"id": 2, "name": "Hóa học"},
        {"id": 3, "name": "Bài tập Hóa học nâng cao"},
    ]
    result = match_nodes(nodes)
    assert result["p3s1"] == 1
    assert result["p4s5"] == 2
    # contains 2 chiều: node_hint nằm trong tên node
    assert result["p4s5"] == 2
    # node_hint không khớp node nào → None
    assert result["p4s6"] is None


def test_match_nodes_returns_none_when_no_match():
    result = match_nodes([{"id": 1, "name": "Something unrelated"}])
    assert result["p4s9"] is None


# ---------------------------------------------------------------------------
# build_form_layout — giữ khối liền kề + part đúng
# ---------------------------------------------------------------------------

def _cell(part, position, ids, group_id=None, rule_id=None):
    cell = MatrixCell(
        topic="T", concept="C", skill="S", count=len(ids),
        part=part, position=position, group_id=group_id,
    )
    return CellResult(cell=cell, selected_ids=ids, shortage=0)


def test_layout_preserves_block_contiguity_and_part():
    # Part 1: khối 12 câu (group 1) + 8 câu đơn; Part 4: 2 khối 3 câu
    cell_results = [
        _cell(4, 2, [91, 92, 93]),            # deliberately out of order input
        _cell(1, 1, list(range(1, 13)), group_id=1),
        _cell(1, 2, [13]),
        _cell(4, 1, [88, 89, 90]),
    ]
    random.seed(42)
    layout = build_form_layout(cell_results)

    assert len(layout) == 19
    # 120 câu của part 1 đứng trước part 4
    parts = [part for _, part, _ in layout]
    assert parts == sorted(parts), "Mọi câu của part nhỏ phải đứng trước part lớn"
    # khối group 1 (câu 1-12) phải LIỀN KỀ
    positions_of_first_block = [i for i, (qid, part, _) in enumerate(layout) if 1 <= qid <= 12]
    assert positions_of_first_block == list(range(min(positions_of_first_block), min(positions_of_first_block) + 12))
    # khối logic (88-90) phải liền kề và đứng trước khối số liệu (91-93)
    idx_logic = [i for i, (qid, _, _) in enumerate(layout) if 88 <= qid <= 90]
    idx_data = [i for i, (qid, _, _) in enumerate(layout) if 91 <= qid <= 93]
    assert idx_logic == list(range(idx_logic[0], idx_logic[0] + 3))
    assert idx_data == list(range(idx_data[0], idx_data[0] + 3))
    assert max(idx_logic) < min(idx_data)
    # đúng part và rule mapping
    assert all(part == 1 for _, part, _ in layout[:13])
    assert all(part == 4 for _, part, _ in layout[13:])


def test_layout_shuffles_within_block_but_keeps_membership():
    cell_results = [_cell(3, 1, [10, 11, 12])]
    seen = set()
    for seed in range(30):
        random.seed(seed)
        layout = build_form_layout(cell_results)
        ids = [qid for qid, _, _ in layout]
        seen.add(tuple(ids))
        assert sorted(ids) == [10, 11, 12]
    # với 30 seed phải thấy ít nhất 2 hoán vị khác nhau (xáo trong khối hoạt động)
    assert len(seen) >= 2
