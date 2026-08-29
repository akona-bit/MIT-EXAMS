from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, List, Any


class SubmissionAnswerDetail(BaseModel):
    """Chi tiết 1 câu trong bài làm (cho endpoint /answers)."""

    position: int
    question_id: int
    question_type: str
    part: int
    score: float
    max_score: float
    selected_answer_ids: List[int] = []
    correct_answer_ids: List[int] = []
    subitem_selections: Dict[int, int] = {}  # sub_item_id -> answer_id
    subitem_scores: Dict[str, float] = {}  # label -> score


class SubmissionResultResponse(BaseModel):
    """Kết quả chấm đầy đủ của 1 submission."""

    submission_id: int
    exam_id: int
    score_method: str

    ctt_score_part1: float
    ctt_score_part2: float
    ctt_score_part3: float
    ctt_score_part4: float
    raw_total_score: float
    total_points: Optional[float] = None
    irt_score_part1: Optional[float] = None
    irt_score_part2: Optional[float] = None
    irt_score_part3: Optional[float] = None
    irt_score_part4: Optional[float] = None
    total_score: Optional[float] = None

    # Điểm từng câu (key = str(position), value = float)
    item_scores: Dict[str, float] = {}
    # Điểm chi tiết từng ý con (key = "q_<qid>_sub_<sid>")
    item_subitem_scores: Dict[str, float] = {}
    # Loại câu (key = str(position), value = "SINGLE_CHOICE"/"MULTIPLE_CHOICE"/...)
    item_types: Dict[str, str] = {}
    # Đáp án đúng (key = str(position), value = list[int])
    correct_answers: Dict[str, List[int]] = {}
    # Đáp án thí sinh chọn (key = str(position), value = list[int] hoặc dict {sub_item_id: answer_id})
    selected_answers: Dict[str, Any] = {}
    # Điểm tối đa mỗi câu
    item_points: Dict[str, float] = {}
