from __future__ import annotations
"""
Blueprint ĐGNL ĐHQG-HCM chuẩn 120 câu.

Mã hóa "khung xương" đã đối chiếu chéo 3 nguồn trong
memory-bank/exam-matrix-analysis.md:

- Phần 1.1 Tiếng Việt (câu 1-30):  12 (đọc hiểu văn học, chung ngữ liệu)
  + 8 (thực hành tiếng, câu đơn) + 5 + 5 (2 cụm đọc hiểu văn bản thông tin,
  chung ngữ liệu).
- Phần 1.2 Tiếng Anh (câu 31-60):  5 + 5 + 5 (điền từ / tìm lỗi sai / viết
  lại câu, câu đơn) + 7 + 8 (2 bài đọc, chung ngữ liệu).
- Phần 2 Toán (câu 61-90): 9 khối 2 câu + 4 khối 3 câu. Hai khối đầu
  (Đại số, Mũ-Log) TRẬT TỰ CỨNG; các khối còn lại soft-order.
- Phần 3 Tư duy khoa học (câu 91-120): 10 khối 3 câu — 2 nhóm logic +
  2 nhóm số liệu (logic luôn TRƯỚC số liệu — cứng), sau đó 6 lĩnh vực
  theo trình tự CỨNG Hóa → Lý → Sinh → XH/kinh tế → Sử → Tình huống.

Các khối `passage=True` là khối chung ngữ liệu (cần Passage) và phải nằm
LIỀN KỀ nhau trong đề — engine sinh đề giữ khối liền khối, chỉ xáo
thứ tự câu trong khối + xáo đáp án.
"""
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class BlueprintSlot:
    """Một ô ma trận = 1 MatrixRule trong blueprint chuẩn."""

    part: int                 # 1=TV, 2=TA, 3=Toán, 4=TDKH
    position: int             # thứ tự khối trong phần (1-based)
    count: int                # số câu của khối
    label: str                # tên hiển thị tiếng Việt
    node_hint: str            # gợi ý tên KnowledgeNode để auto-match
    passage: bool = False     # khối chung ngữ liệu (đọc hiểu)
    group: bool = False       # thuộc group MatrixRuleGroup (liền kề)
    order_locked: bool = False  # trình tự CỨNG (không hoán đổi giữa các đề)
    shuffle_group: Optional[int] = None # Nhóm hoán đổi vị trí (các slot cùng shuffle_group sẽ xáo trộn vị trí cho nhau)
    note: str = ""

    @property
    def key(self) -> str:
        return f"p{self.part}s{self.position}"


# ---------------------------------------------------------------------------
# Định nghĩa blueprint (nguồn chân lý: memory-bank/exam-matrix-analysis.md)
# ---------------------------------------------------------------------------

PART_NAMES: Dict[int, str] = {
    1: "Sử dụng ngôn ngữ — Tiếng Việt",
    2: "Sử dụng ngôn ngữ — Tiếng Anh",
    3: "Toán học",
    4: "Tư duy khoa học",
}

BLUEPRINT_SLOTS: List[BlueprintSlot] = [
    # ---------------- PHẦN 1.1 — TIẾNG VIỆT (30 câu) ----------------
    BlueprintSlot(1, 1, 12, "Đọc hiểu trích đoạn văn học (kiến thức thể loại)",
                  "Đọc hiểu văn học", passage=True, group=True, order_locked=True,
                  note="Tầng 1: hàm lượng lý luận văn học cao nhất — nhân vật chèo/tuồng, thi pháp Đường luật, mô-típ dân gian..."),
    BlueprintSlot(1, 2, 1, "Thực hành tiếng — chính tả", "Chính tả", order_locked=True,
                  note="Tầng 2: khối gỡ điểm — lỗi s/x, tr/ch"),
    BlueprintSlot(1, 3, 1, "Thực hành tiếng — lỗi ngữ pháp", "Lỗi ngữ pháp", order_locked=True),
    BlueprintSlot(1, 4, 1, "Thực hành tiếng — từ vựng", "Từ vựng", order_locked=True),
    BlueprintSlot(1, 5, 1, "Thực hành tiếng — thành ngữ/quán ngữ", "Thành ngữ - quán ngữ", order_locked=True),
    BlueprintSlot(1, 6, 1, "Thực hành tiếng — phong cách ngôn ngữ", "Phong cách ngôn ngữ", order_locked=True),
    BlueprintSlot(1, 7, 1, "Thực hành tiếng — hoạt động ngữ pháp", "Hoạt động ngữ pháp", order_locked=True),
    BlueprintSlot(1, 8, 1, "Thực hành tiếng — dấu câu", "Dấu câu", order_locked=True),
    BlueprintSlot(1, 9, 1, "Thực hành tiếng — sử dụng từ", "Sử dụng từ", order_locked=True),
    BlueprintSlot(1, 10, 5, "Đọc hiểu văn bản thông tin/nghị luận (cụm 1)",
                  "Đọc hiểu văn bản thông tin", passage=True, group=True, order_locked=True,
                  note="Trình tự cố định trong cụm: tổ chức thông tin → vai trò chi tiết/thái độ → chủ đề → tác động/luận điểm"),
    BlueprintSlot(1, 11, 5, "Đọc hiểu văn bản thông tin/nghị luận (cụm 2)",
                  "Đọc hiểu văn bản thông tin", passage=True, group=True, order_locked=True),

    # ---------------- PHẦN 1.2 — TIẾNG ANH (30 câu) ----------------
    BlueprintSlot(2, 1, 5, "Điền từ vào câu (grammar/vocabulary)", "Điền từ", order_locked=True,
                  note="5 điểm ngữ pháp/từ vựng không trùng: phrasal verb, so sánh, thì, lượng từ, từ loại"),
    BlueprintSlot(2, 2, 5, "Tìm lỗi sai", "Tìm lỗi sai", order_locked=True,
                  note="Lỗi ẩn: mạo từ, đại từ quan hệ, hòa hợp S-V, đại từ nhân xưng, sở hữu cách"),
    BlueprintSlot(2, 3, 5, "Viết lại câu (paraphrase)", "Viết lại câu", order_locked=True,
                  note="unless, tường thuật, so sánh nhất, bị động ngầm nhân quả"),
    BlueprintSlot(2, 4, 7, "Bài đọc ngắn", "Bài đọc ngắn", passage=True, group=True, order_locked=True,
                  note="Motif: chủ đề, đại từ quy chiếu, đồng nghĩa ngữ cảnh, chi tiết KHÔNG đề cập, inference, mục đích dẫn chứng"),
    BlueprintSlot(2, 5, 8, "Bài đọc dài", "Bài đọc dài", passage=True, group=True, order_locked=True,
                  note="Thêm 1-2 câu tổng hợp toàn bài: chọn tiêu đề / tóm tắt trình tự đoạn"),

    # ---------------- PHẦN 2 — TOÁN (30 câu) ----------------
    # 9 khối 2 câu + 4 khối 3 câu. 2 khối đầu CỨNG, còn lại soft-order
    # (vị trí có thể hoán đổi — đối chiếu 3 nguồn, mục VII).
    BlueprintSlot(3, 1, 2, "Đại số cơ bản", "Đại số cơ bản", order_locked=True,
                  note="CỨNG: luôn khối đầu — phương trình/bất phương trình, hình chữ nhật-vuông, điều kiện có nghiệm"),
    BlueprintSlot(3, 2, 2, "Mũ — Logarit ứng dụng", "Mũ - Logarit", order_locked=True,
                  note="CỨNG: luôn khối thứ hai — lãi suất kép, tăng trưởng, phóng xạ"),
    BlueprintSlot(3, 3, 2, "Lý thuyết đồ thị / đếm rời rạc", "Lý thuyết đồ thị", shuffle_group=1,
                  note="Soft: đếm cạnh, cây khung nhỏ nhất, Dijkstra đơn giản; có thể đội lốt ngữ cảnh Hóa"),
    BlueprintSlot(3, 4, 2, "Lượng giác + hệ thức lượng tam giác", "Lượng giác và tam giác", shuffle_group=1,
                  note="Soft: gộp nhóm dùng chung công cụ sin/cos — định lý sin/cos/Heron"),
    BlueprintSlot(3, 5, 2, "Giới hạn — liên tục — tiệm cận — BPT đạo hàm", "Giới hạn - đạo hàm - liên tục", shuffle_group=1,
                  note="Soft: cụm hành vi hàm số; biến thể chọn 1 (liên tục+BPT đạo hàm hoặc giới hạn+tiệm cận)"),
    BlueprintSlot(3, 6, 2, "Nguyên hàm — Tích phân", "Nguyên hàm - tích phân", shuffle_group=1,
                  note="Soft: tính giá trị từ đẳng thức cho trước + diện tích hình phẳng"),
    BlueprintSlot(3, 7, 2, "Quy hoạch tuyến tính", "Quy hoạch tuyến tính", shuffle_group=2,
                  note="Soft: 2 bước tuyến tính — ràng buộc → tối ưu"),
    BlueprintSlot(3, 8, 2, "Dãy số (công sai/công bội + giới hạn)", "Dãy số", shuffle_group=2,
                  note="Soft"),
    BlueprintSlot(3, 9, 2, "Hình học tọa độ Oxyz cơ bản", "Hình học Oxyz", shuffle_group=2,
                  note="Soft: khoảng cách/góc → phương trình mặt phẳng"),
    BlueprintSlot(3, 10, 3, "Khảo sát hàm số bậc 3", "Khảo sát hàm số", shuffle_group=3,
                  note="Soft: 3 tầng — đơn điệu → cực trị → tương giao/trung điểm"),
    BlueprintSlot(3, 11, 3, "Xác suất (đơn giản → toàn phần → Bayes)", "Xác suất", shuffle_group=3,
                  note="Soft: luôn 3-câu, chưa từng rơi vào ô 2-câu qua cả 3 đề"),
    BlueprintSlot(3, 12, 3, "Hình học phẳng Oxy", "Hình học Oxy", shuffle_group=3,
                  note="Soft: trọng tâm/trung điểm → đường thẳng/hình chiếu → tích vô hướng"),
    BlueprintSlot(3, 13, 3, "Hình chóp (Oxyz)", "Hình chóp", shuffle_group=3,
                  note="Soft: luôn 3-câu; xu hướng câu chốt — thể tích, góc đường-mặt, khoảng cách"),

    # ---------------- PHẦN 3 — TƯ DUY KHOA HỌC (30 câu) ----------------
    # Trình tự CỨNG tuyệt đối qua cả 3 đề (mục VIII): logic trước số liệu,
    # sau đó Hóa → Lý → Sinh → XH/kinh tế → Sử → Tình huống ứng dụng.
    BlueprintSlot(4, 1, 3, "Suy luận logic — bài toán ràng buộc 1", "Suy luận logic", order_locked=True,
                  note="CỨNG: nửa đầu là logic thuần (xếp lịch/xếp nhóm — constraint satisfaction)"),
    BlueprintSlot(4, 2, 3, "Suy luận logic — bài toán ràng buộc 2", "Suy luận logic", order_locked=True),
    BlueprintSlot(4, 3, 3, "Phân tích số liệu — biểu đồ/bảng 1", "Phân tích số liệu", order_locked=True,
                  note="CỨNG: nửa sau đọc số liệu; câu 3 hay cài bẫy 'chênh lệch phần trăm' vs 'tỉ lệ tương đối'"),
    BlueprintSlot(4, 4, 3, "Phân tích số liệu — biểu đồ/bảng 2", "Phân tích số liệu", order_locked=True),
    BlueprintSlot(4, 5, 3, "Hóa học", "Hóa học", order_locked=True,
                  note="CỨNG: trình tự 6 lĩnh vực bất biến — tính toán định lượng chặt chẽ nhất"),
    BlueprintSlot(4, 6, 3, "Vật lý", "Vật lý", order_locked=True),
    BlueprintSlot(4, 7, 3, "Sinh học", "Sinh học", order_locked=True,
                  note="Định lượng + yếu tố thực nghiệm/quan sát"),
    BlueprintSlot(4, 8, 3, "Khoa học xã hội / thống kê kinh tế vĩ mô", "Khoa học xã hội", order_locked=True,
                  note="Dân số/GRDP — đọc hiểu số liệu xã hội-kinh tế"),
    BlueprintSlot(4, 9, 3, "Lịch sử", "Lịch sử", order_locked=True,
                  note="Thuần đọc hiểu - ghi nhớ - suy luận ngữ cảnh"),
    BlueprintSlot(4, 10, 3, "Tình huống ứng dụng — kinh tế/đời sống", "Tình huống ứng dụng", order_locked=True,
                  note="CỨNG: khối chốt hạ nhiệt — khởi nghiệp, pháp luật, cung-cầu"),
]

# Trình tự lĩnh vực Phần 3.2 — hard constraint dùng cho validate + hiển thị
SCIENCE_FIELD_ORDER: List[str] = ["Hóa học", "Vật lý", "Sinh học", "Khoa học xã hội", "Lịch sử", "Tình huống ứng dụng"]

# Độ dài khối hợp lệ trong toàn đề (mục I: 1/2/3/5/7-8 câu; riêng tầng 1
# Tiếng Việt là khối 12 câu gồm nhiều trích đoạn ngắn hỏi kiến thức thể loại)
VALID_BLOCK_SIZES = {1, 2, 3, 5, 7, 8, 12}


def get_blueprint() -> dict:
    """Trả về blueprint dạng JSON-able cho API/frontend."""
    parts: List[dict] = []
    lo = 1
    for part in (1, 2, 3, 4):
        slots = sorted((s for s in BLUEPRINT_SLOTS if s.part == part), key=lambda s: s.position)
        p_total = sum(s.count for s in slots)
        hi = lo + p_total - 1
        parts.append({
            "part": part,
            "name": PART_NAMES[part],
            "total": p_total,
            "question_range": f"{lo}-{hi}",
            "slots": [
                {
                    "key": s.key,
                    "position": s.position,
                    "count": s.count,
                    "label": s.label,
                    "node_hint": s.node_hint,
                    "passage": s.passage,
                    "group": s.group,
                    "order_locked": s.order_locked,
                    "shuffle_group": s.shuffle_group,
                    "note": s.note,
                }
                for s in slots
            ],
        })
        lo += p_total
    return {
        "total_questions": sum(s.count for s in BLUEPRINT_SLOTS),
        "total_slots": len(BLUEPRINT_SLOTS),
        "duration_minutes": 150,
        "score_scale": "0-300/phần, tổng 0-1200",
        "science_field_order": SCIENCE_FIELD_ORDER,
        "valid_block_sizes": sorted(VALID_BLOCK_SIZES),
        "parts": parts,
    }


# ---------------------------------------------------------------------------
# Auto-match KnowledgeNode theo tên
# ---------------------------------------------------------------------------

def _normalize(name: str) -> str:
    return "".join(str(name).lower().split())


def match_nodes(nodes: List[dict]) -> Dict[str, Optional[int]]:
    """
    Map slot.key -> knowledge_node_id (hoặc None).

    `nodes`: [{"id": int, "name": str}, ...] — toàn bộ cây kiến thức.
    Chiến lược: exact (sau chuẩn hóa bỏ khoảng trắng/lower) trước,
    rồi contains 2 chiều.
    """
    by_exact: Dict[str, int] = {}
    for n in nodes:
        by_exact.setdefault(_normalize(n["name"]), n["id"])

    result: Dict[str, Optional[int]] = {}
    for slot in BLUEPRINT_SLOTS:
        target = _normalize(slot.node_hint)
        node_id: Optional[int] = by_exact.get(target)
        if node_id is None:
            for norm, nid in by_exact.items():
                if target and norm and (target in norm or norm in target):
                    node_id = nid
                    break
        result[slot.key] = node_id
    return result


def validate_blueprint() -> List[str]:
    """Self-check cấu trúc blueprint — dùng trong test và lúc khởi động."""
    errors: List[str] = []
    total = sum(s.count for s in BLUEPRINT_SLOTS)
    if total != 120:
        errors.append(f"Tổng số câu = {total}, phải là 120")
    for part in (1, 2, 3, 4):
        p_total = sum(s.count for s in BLUEPRINT_SLOTS if s.part == part)
        if p_total != 30:
            errors.append(f"Phần {part} có {p_total} câu, phải là 30")
    for part in (1, 2, 3, 4):
        positions = sorted(s.position for s in BLUEPRINT_SLOTS if s.part == part)
        if positions != list(range(1, len(positions) + 1)):
            errors.append(f"Phần {part}: position không liên tiếp ({positions})")
    for s in BLUEPRINT_SLOTS:
        if s.count not in VALID_BLOCK_SIZES:
            errors.append(f"{s.key}: kích thước khối {s.count} không thuộc {sorted(VALID_BLOCK_SIZES)}")
        if s.passage and not s.group:
            errors.append(f"{s.key}: khối chung ngữ liệu phải thuộc group")
    keys = [s.key for s in BLUEPRINT_SLOTS]
    if len(set(keys)) != len(keys):
        errors.append("Trùng slot key")
    # 2 khối cứng đầu Toán
    math_slots = sorted((s for s in BLUEPRINT_SLOTS if s.part == 3), key=lambda s: s.position)
    if math_slots[0].node_hint != "Đại số cơ bản" or math_slots[1].node_hint != "Mũ - Logarit":
        errors.append("Phần Toán: 2 khối đầu phải là Đại số rồi Mũ-Log")
    # logic trước số liệu + trình tự 6 lĩnh vực ở phần TDKH
    tdkh = sorted((s for s in BLUEPRINT_SLOTS if s.part == 4), key=lambda s: s.position)
    hints4 = [s.node_hint for s in tdkh]
    if hints4[:4] != ["Suy luận logic", "Suy luận logic", "Phân tích số liệu", "Phân tích số liệu"]:
        errors.append("Phần TDKH: 2 nhóm logic phải đứng trước 2 nhóm số liệu")
    if hints4[4:10] != SCIENCE_FIELD_ORDER:
        errors.append(f"Trình tự 6 lĩnh vực sai: {hints4[4:10]}")
    return errors


