from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Dict
from datetime import datetime
from app.models.question import QuestionType
from app.models.exam import ExamStatus, ParticipantStatus

# --- MatrixRuleGroup Schemas ---
class MatrixRuleGroupBase(BaseModel):
    label: Optional[str] = None
    required_passage_id: Optional[int] = None

class MatrixRuleGroupCreate(MatrixRuleGroupBase):
    local_id: str

class MatrixRuleGroupResponse(MatrixRuleGroupBase):
    id: int
    matrix_id: int
    model_config = ConfigDict(from_attributes=True)

# --- MatrixRule Schemas ---
class MatrixRuleBase(BaseModel):
    knowledge_node_id: int
    # Optional từ Matrix 2.1: rule "đơn giản" chỉ cần node + count.
    # Khi question_type/level null → engine tự cân bằng theo phân bố ngân hàng (proportional sampling).
    question_type: Optional[QuestionType] = None
    level: Optional[int] = None
    # Advanced mode: target tỷ lệ mức độ {"NB":0.4,...}. Các giá trị ngoài NB/TH/VD/VDC bị bỏ qua.
    level_distribution: Optional[Dict[str, float]] = None
    count: int = 1
    part: int = 1
    target_irt_b: Optional[float] = None
    position: int = 0

    @field_validator("level_distribution")
    @classmethod
    def validate_level_distribution(cls, v):
        if v is None:
            return v
        allowed = {"NB", "TH", "VD", "VDC"}
        cleaned = {k.strip().upper(): float(val) for k, val in v.items() if k.strip().upper() in allowed}
        total = sum(cleaned.values())
        if total <= 0:
            return None
        # Chuẩn hoá về tổng 1.0
        return {k: val / total for k, val in cleaned.items()}

class MatrixRuleCreate(MatrixRuleBase):
    group_local_id: Optional[str] = None

class MatrixRuleResponse(MatrixRuleBase):
    id: int
    matrix_id: int
    group_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# --- Matrix Schemas ---
class MatrixBase(BaseModel):
    name: str
    description: Optional[str] = None
    subject: Optional[str] = None

class MatrixCreate(MatrixBase):
    rules: List[MatrixRuleCreate]
    groups: Optional[List[MatrixRuleGroupCreate]] = None

class MatrixResponse(MatrixBase):
    id: int
    created_at: datetime
    rules: List[MatrixRuleResponse]
    groups: List[MatrixRuleGroupResponse] = []
    model_config = ConfigDict(from_attributes=True)

# --- Exam Generation Request ---
class GenerateExamRequest(BaseModel):
    exam_id: int
    number_of_forms: int = 1
    distinct_questions: bool = False

# --- Exam Config Request ---
class ExamPublishRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    show_score_mode: str
    show_answer_mode: str

# --- Exam Response ---
class ExamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    matrix_id: int
    created_at: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: int
    show_score_mode: str
    show_answer_mode: str
    status: ExamStatus
    model_config = ConfigDict(from_attributes=True)

# --- Exam Participant ---
class ExamParticipantCreate(BaseModel):
    user_ids: List[int]

class ExamParticipantResponse(BaseModel):
    id: int
    exam_id: int
    user_id: int
    exam_form_id: Optional[int] = None
    status: ParticipantStatus
    start_time: Optional[datetime] = None
    submit_time: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
