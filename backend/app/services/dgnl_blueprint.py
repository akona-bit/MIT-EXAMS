from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass(frozen=True)
class BlueprintSlot:
    part: int
    position: int
    count: int
    label: str
    node_hint: str
    passage: bool = False
    group: bool = False
    order_locked: bool = False
    shuffle_group: Optional[int] = None
    note: str = ""
    group_prefix: Optional[str] = None

    @property
    def key(self) -> str:
        return f"p{self.part}s{self.position}"

PART_NAMES: Dict[int, str] = {
    1: "Sử dụng ngôn ngữ — Tiếng Việt",
    2: "Sử dụng ngôn ngữ — Tiếng Anh",
    3: "Toán học",
    4: "Tư duy khoa học",
}

BLUEPRINT_SLOTS: List[BlueprintSlot] = [
    BlueprintSlot(1, 1, 2, 'Cổ đại - Sử thi', 'Sử thi', passage=False, group=False, order_locked=False, shuffle_group=None, note='Có thể có câu hỏi thuần lí thuyết (1 câu)', group_prefix=None),
    BlueprintSlot(1, 2, 2, 'Trung đại - Truyện truyền kì', 'Truyện truyền kì', passage=False, group=False, order_locked=False, shuffle_group=None, note='Bắt buộc phải có một câu hỏi mức 3 về thơ với motif: - Giải thích từ ngữ, điển tích,... - Liên hệ tư tưởng của chủ thể trữ tinh,... hoặc liên hệ hình ảnh con người trung đại', group_prefix=None),
    BlueprintSlot(1, 3, 1, 'Văn xuôi - Tiểu thuyết', 'Tiểu thuyết', passage=False, group=False, order_locked=False, shuffle_group=None, note='Một trong hai phải có câu hỏi mức 3', group_prefix=None),
    BlueprintSlot(1, 4, 1, 'Truyện ngắn', 'Truyện ngắn', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(1, 5, 3, 'Thơ - Thơ cận đại', 'Thơ cận đại', passage=False, group=False, order_locked=False, shuffle_group=None, note='Phải có một câu hỏi mức 3 theo motif - Phân tích chi tiết một hình ảnh/thông tin - Phân tích tác dụng của một biện pháp nghệ thuật', group_prefix=None),
    BlueprintSlot(1, 6, 1, 'Các thể loại kí - Tuỳ bút', 'Tuỳ bút', passage=False, group=False, order_locked=False, shuffle_group=None, note='Mức 1', group_prefix=None),
    BlueprintSlot(1, 7, 1, 'Kịch (chung)', 'Kịch (chung)', passage=False, group=False, order_locked=False, shuffle_group=None, note='Mức 2', group_prefix=None),
    BlueprintSlot(1, 8, 1, 'Chỉnh tả - Nhận biết các từ/cụm đúng hoặc sai chính tả', 'Nhận biết các từ/cụm đúng hoặc sai chính tả', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(1, 9, 6, 'Chữa lỗi trong câu/từ - Sai quy chiếu', 'Sai quy chiếu', passage=False, group=False, order_locked=False, shuffle_group=None, note='Phải đảm bảo mỗi câu sẽ bao quát hỏi một lỗi. Phải có ít nhất một câu hỏi theo motif: - Tìm câu được viết đúng - Phát hiện lỗi trong câu. - Cho một câu có chứa lỗi sai, viết lại câu đúng với nghĩa không đổi.', group_prefix=None),
    BlueprintSlot(1, 10, 1, 'Nghĩa hoặc cấu trúc của từ hoặc câu - Giải thích nghĩa của từ/cụm từ/câu', 'Giải thích nghĩa của từ/cụm từ/câu', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(1, 11, 1, 'Tri thức ngữ văn khác', 'Tri thức ngữ văn khác', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(1, 12, 1, 'Văn bản thông tin - Xác định chủ đề chính', 'Xác định chủ đề chính', passage=True, group=True, order_locked=False, shuffle_group=None, note='Thứ tự các câu hỏi nên trình bày tương ứng với thứ tự đọc từ trên xuống.', group_prefix="A3.1"),
    BlueprintSlot(1, 13, 3, 'Xác định thái độ của tác giả ở từng đoạn', 'Xác định thái độ của tác giả ở từng đoạn', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="A3.1"),
    BlueprintSlot(1, 14, 1, 'Đánh giá/Suy luận tác động của văn bản cho người độc', 'Đánh giá/Suy luận tác động của văn bản cho người độc', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="A3.1"),
    BlueprintSlot(1, 15, 1, 'Văn bản nghị luận (xã hội/văn học) - Xác định luận đề/luận điểm/lí lẽ', 'Xác định luận đề/luận điểm/lí lẽ', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="A3.2"),
    BlueprintSlot(1, 16, 2, 'Xác định cách trình bày của luận đề/luận điểm', 'Xác định cách trình bày của luận đề/luận điểm', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="A3.2"),
    BlueprintSlot(1, 17, 2, 'Hiểu/Đánh giá/Suy luận các biện pháp nghệ thuật mà tác giả sử dụng trong văn bản', 'Hiểu/Đánh giá/Suy luận các biện pháp nghệ thuật mà tác giả sử dụng trong văn bản', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="A3.2"),
    BlueprintSlot(2, 1, 1, 'Điền khuyết - Giới từ', 'Giới từ', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 2, 1, 'Verb form', 'Verb form', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 3, 1, 'So sánh', 'So sánh', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 4, 1, 'Word form', 'Word form', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 5, 1, 'Lượng từ', 'Lượng từ', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 6, 1, 'Tìm lỗi sai - Mạo từ', 'Mạo từ', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 7, 1, 'Sở hữu', 'Sở hữu', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 8, 1, 'Mệnh đề quan hệ', 'Mệnh đề quan hệ', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 9, 1, 'Hoà hợp chủ-vị', 'Hoà hợp chủ-vị', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 10, 1, 'Động từ/tobe', 'Động từ/tobe', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 11, 1, 'Viết lại câu - Câu tường thuật', 'Câu tường thuật', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 12, 1, 'If/wish, thể giả định,...', 'If/wish, thể giả định,...', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 13, 1, 'So sánh (nhiều, nhất)', 'So sánh (nhiều, nhất)', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 14, 1, 'Bị động (có dạng đặc biệt)', 'Bị động (có dạng đặc biệt)', passage=False, group=False, order_locked=False, shuffle_group=None, note='Câu hỏi phải đánh vào kiến thức ngữ pháp chuyên sâu, tập trung sử dụng các ngữ pháp phức tạp (đảo ngữ, câu chẻ)', group_prefix=None),
    BlueprintSlot(2, 15, 1, 'Modal verb/adverb', 'Modal verb/adverb', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(2, 16, 1, 'Đọc hiểu đời sống - Nội dung chính văn bản', 'Nội dung chính văn bản', passage=True, group=True, order_locked=False, shuffle_group=None, note='Thứ tự các câu hỏi nên trình bày tương ứng với thứ tự đọc từ trên xuống.', group_prefix="B2.1"),
    BlueprintSlot(2, 17, 1, 'Tìm từ liên quan đến đối tượng (refer to)', 'Tìm từ liên quan đến đối tượng (refer to)', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.1"),
    BlueprintSlot(2, 18, 2, 'Đọc, hiểu và nhận biết ý của một đoạn trong văn bản', 'Đọc, hiểu và nhận biết ý của một đoạn trong văn bản', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.1"),
    BlueprintSlot(2, 19, 1, 'Tìm từ đồng/gần/trái nghĩa', 'Tìm từ đồng/gần/trái nghĩa', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.1"),
    BlueprintSlot(2, 20, 2, 'Đọc, hiểu nội dung được đề cập hoặc liên hệ trong một đoạn của văn bản', 'Đọc, hiểu nội dung được đề cập hoặc liên hệ trong một đoạn của văn bản', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.1"),
    BlueprintSlot(2, 21, 1, 'Đọc hiểu học thuật - Đặt tiêu đề của văn bản', 'Đặt tiêu đề của văn bản', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.2"),
    BlueprintSlot(2, 22, 1, 'Tìm từ/cụm từ liên quan đến đối tượng (refer to)', 'Tìm từ/cụm từ liên quan đến đối tượng (refer to)', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.2"),
    BlueprintSlot(2, 23, 1, 'Giải thích nghĩa của một từ/cụm từ trong một đoạn của văn bản', 'Giải thích nghĩa của một từ/cụm từ trong một đoạn của văn bản', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.2"),
    BlueprintSlot(2, 24, 1, 'Hiểu, suy luận mục đích tác giả sử dụng một từ ngữ trong ngữ cảnh của một đoạn văn', 'Hiểu, suy luận mục đích tác giả sử dụng một từ ngữ trong ngữ cảnh của một đoạn văn', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.2"),
    BlueprintSlot(2, 25, 3, 'Đọc, hiểu và nhận biết ý của một đoạn trong văn bản', 'Đọc, hiểu và nhận biết ý của một đoạn trong văn bản', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.2"),
    BlueprintSlot(2, 26, 1, 'Sắp xếp, suy luận, lựa chọn các ý/nội dung phù hợp với NHIỀU đoạn trong văn bản', 'Sắp xếp, suy luận, lựa chọn các ý/nội dung phù hợp với NHIỀU đoạn trong văn bản', passage=True, group=True, order_locked=False, shuffle_group=None, note='', group_prefix="B2.2"),
    BlueprintSlot(3, 1, 1, 'Nguyên hàm, tích phân - Các phép biển đổi cơ bản', 'Các phép biển đổi cơ bản', passage=False, group=False, order_locked=False, shuffle_group=1, note='', group_prefix=None),
    BlueprintSlot(3, 2, 1, 'Ứng dụng của tích phân', 'Ứng dụng của tích phân', passage=False, group=False, order_locked=False, shuffle_group=1, note='', group_prefix=None),
    BlueprintSlot(3, 3, 1, 'Lý thuyết đồ thị - Tính liên thông của đồ thị', 'Tính liên thông của đồ thị', passage=False, group=False, order_locked=False, shuffle_group=1, note='', group_prefix=None),
    BlueprintSlot(3, 4, 1, 'Đường đi ngắn nhất', 'Đường đi ngắn nhất', passage=False, group=False, order_locked=False, shuffle_group=1, note='Câu hỏi bắt buộc phải có đồ thị đi kèm', group_prefix=None),
    BlueprintSlot(3, 5, 2, 'Hinh học phẳng - Định lý sin', 'Định lý sin', passage=False, group=False, order_locked=False, shuffle_group=1, note='1 trong 2 câu phải có yếu tố liên quan đến xử lí và biến đổi lượng giác. Bắt buộc phải có ít nhất 1 câu về hình học phẳng', group_prefix=None),
    BlueprintSlot(3, 6, 2, 'Giới hạn, hàm số liên tục - Xét tính liên tục của hàm số', 'Xét tính liên tục của hàm số', passage=False, group=False, order_locked=False, shuffle_group=1, note='', group_prefix=None),
    BlueprintSlot(3, 7, 2, 'Số mũ, logarit - (bất) Phương trình logarit/số mũ', '(bất) Phương trình logarit/số mũ', passage=False, group=False, order_locked=False, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(3, 8, 2, 'Giải, xét dấu, biện luận phương trình/bất phương trình/Hệ phương trình - Phương trình chứa căn', 'Phương trình chứa căn', passage=False, group=False, order_locked=False, shuffle_group=None, note='1 trong 2 câu phải có yếu tố liên quan đến biện luận (tham số m)', group_prefix=None),
    BlueprintSlot(3, 9, 2, 'Quy hoạch tuyến tính - Đưa ra biểu thức', 'Đưa ra biểu thức', passage=False, group=False, order_locked=False, shuffle_group=2, note='1 câu nhận biết phương trình, 1 câu tính toán', group_prefix=None),
    BlueprintSlot(3, 10, 2, 'Hệ toạ độ Oxyz - Tính độ dài đoạn thẳng/khoảng cách', 'Tính độ dài đoạn thẳng/khoảng cách', passage=False, group=False, order_locked=False, shuffle_group=2, note='Cần phải có 1 câu hỏi có sử dụng các dữ kiện liên quan để tạo lập phương trình', group_prefix=None),
    BlueprintSlot(3, 11, 2, 'Cấp số cộng/nhân, dãy số - Xác định công bội, công sai, cấp số, tổng,...', 'Xác định công bội, công sai, cấp số, tổng,...', passage=False, group=False, order_locked=False, shuffle_group=2, note='Câu cuối phải có yếu tố liên quan đến truy hồi/giới hạn', group_prefix=None),
    BlueprintSlot(3, 12, 3, 'Hình học không gian - Xác định góc, điểm, đoạn thẳng,...', 'Xác định góc, điểm, đoạn thẳng,...', passage=False, group=False, order_locked=False, shuffle_group=3, note='Cần thiết kế các câu hỏi độc lập ý nhưng có liên kết (VD: dữ kiện của câu 1 có thể được sử dụng để giải nhanh cho câu 2)', group_prefix=None),
    BlueprintSlot(3, 13, 3, 'Hệ toạ độ Oxy - Xác định toạ độ/điểm/góc...', 'Xác định toạ độ/điểm/góc...', passage=False, group=False, order_locked=False, shuffle_group=3, note='Cần phải có 1 câu hỏi có sử dụng các dữ kiện liên quan để tạo lập phương trình', group_prefix=None),
    BlueprintSlot(3, 14, 3, 'Thống kê - Quy tắc cộng, nhân', 'Quy tắc cộng, nhân', passage=False, group=False, order_locked=False, shuffle_group=3, note='', group_prefix=None),
    BlueprintSlot(3, 15, 3, 'Khảo sát hàm số (bậc 3, phân thức). Có thể có tham số - Cực trị, điểm cực trị,...', 'Cực trị, điểm cực trị,...', passage=False, group=False, order_locked=False, shuffle_group=3, note='', group_prefix=None),
    BlueprintSlot(4, 1, 3, 'Tư duy logic - Logic sắp xếp đơn lẻ', 'Logic sắp xếp đơn lẻ', passage=False, group=False, order_locked=True, shuffle_group=None, note='Chọn ngẫu nhiên một trong các nhóm câu hỏi. Không nên để trùng lặp ý tưởng câu hỏi.', group_prefix=None),
    BlueprintSlot(4, 2, 3, 'Logic có yếu tố nhiều nhóm (subgroup)', 'Logic có yếu tố nhiều nhóm (subgroup)', passage=False, group=False, order_locked=True, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(4, 3, 3, 'PTSL - Bảng số liệu', 'Bảng số liệu', passage=False, group=False, order_locked=True, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(4, 4, 3, 'Bảng sơ đồ venn', 'Bảng sơ đồ venn', passage=False, group=False, order_locked=True, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(4, 5, 3, 'SLKH - Hoá học', 'Hoá học', passage=False, group=False, order_locked=True, shuffle_group=None, note='Mỗi câu hỏi sẽ được gắn thêm đuổi .1 (nhận biết), .2 (thông hiểu), .3 (vận dụng) Độ khó câu hỏi tăng dần. Cần xây dựng các câu hỏi độc lập, hạn chế để trùng ý trên một vùng hoặc nhóm dữ liệu. Không nên để trùng lặp ý tưởng câu hỏi.', group_prefix=None),
    BlueprintSlot(4, 6, 3, 'Vật lí', 'Vật lí', passage=False, group=False, order_locked=True, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(4, 7, 3, 'Sinh học', 'Sinh học', passage=False, group=False, order_locked=True, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(4, 8, 3, 'Lịch sử', 'Lịch sử', passage=False, group=False, order_locked=True, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(4, 9, 3, 'Địa lí', 'Địa lí', passage=False, group=False, order_locked=True, shuffle_group=None, note='', group_prefix=None),
    BlueprintSlot(4, 10, 3, 'KTPL', 'KTPL', passage=False, group=False, order_locked=True, shuffle_group=None, note='', group_prefix=None),
]

SCIENCE_FIELD_ORDER: List[str] = ["Hóa học", "Vật lý", "Sinh học", "Khoa học xã hội", "Lịch sử", "Tình huống ứng dụng"]
VALID_BLOCK_SIZES = {1, 2, 3, 5, 7, 8, 12}

def get_blueprint() -> dict:
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
                    "group_prefix": s.group_prefix,
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

def _normalize(name: str) -> str:
    return "".join(str(name).lower().split())

def match_nodes(nodes: List[dict]) -> Dict[str, Optional[int]]:
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
    errors = []
    total = sum(s.count for s in BLUEPRINT_SLOTS)
    if total != 120:
        errors.append(f"Tổng số câu = {total}, phải là 120")
    for part in (1, 2, 3, 4):
        p_total = sum(s.count for s in BLUEPRINT_SLOTS if s.part == part)
        if p_total != 30:
            errors.append(f"Phần {part} có {p_total} câu, phải là 30")
    return errors
