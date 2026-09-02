from typing import Dict, List, Any
from app.models.question import QuestionType

# Mặc định
DEFAULT_LEVEL_RATIOS = {
    1: 0.20, # NB
    2: 0.30, # TH
    3: 0.30, # VD
    4: 0.20  # VDC
}
DEFAULT_TYPE_RATIOS = {
    QuestionType.SINGLE_CHOICE.value: 1.0
}

def _largest_remainder(ratios: Dict[Any, float], total: int) -> Dict[Any, int]:
    """
    Thuật toán Largest Remainder (Hamilton method)
    Chia tổng 'total' theo tỷ lệ 'ratios' đảm bảo tổng số lượng chính xác bằng 'total'.
    """
    if not ratios or total <= 0:
        return {}
    
    # Chuẩn hoá tỷ lệ về tổng = 1.0
    total_ratio = sum(ratios.values())
    if total_ratio <= 0:
        return {}
    normalized = {k: v / total_ratio for k, v in ratios.items()}
    
    floors: Dict[Any, int] = {}
    remainders: Dict[Any, float] = {}
    
    for k, r in normalized.items():
        if r <= 0:
            continue
        exact = r * total
        floors[k] = int(exact)
        remainders[k] = exact - int(exact)
        
    allocated = sum(floors.values())
    leftover = total - allocated
    
    # Phân phối phần dư cho bucket có remainder lớn nhất
    for k in sorted(remainders, key=lambda x: remainders[x], reverse=True):
        if leftover <= 0:
            break
        if k in floors:
            floors[k] += 1
            leftover -= 1
            
    return {k: v for k, v in floors.items() if v > 0}

def allocate_rules_for_cell(
    knowledge_node_id: int, 
    total_count: int, 
    level_ratios: Dict[int, float] = None, 
    type_ratios: Dict[str, float] = None
) -> List[Dict[str, Any]]:
    """
    Tách 1 ô (skill, tổng số câu) thành nhiều rule con chi tiết (mức độ, dạng câu).
    Sử dụng thuật toán largest remainder để đảm bảo tổng số câu luôn khớp.
    """
    if level_ratios is None:
        level_ratios = DEFAULT_LEVEL_RATIOS
    if type_ratios is None:
        type_ratios = DEFAULT_TYPE_RATIOS
        
    level_counts = _largest_remainder(level_ratios, total_count)
    
    rules = []
    for level, count in level_counts.items():
        type_counts = _largest_remainder(type_ratios, count)
        for q_type, type_count in type_counts.items():
            rules.append({
                "knowledge_node_id": knowledge_node_id,
                "level": level,
                "question_type": q_type,
                "count": type_count
            })
            
    return rules
