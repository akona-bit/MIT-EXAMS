from pydantic import BaseModel, ConfigDict, field_validator, Field
from typing import Optional, List, Dict, Any
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
    # Advanced mode target ratios are removed because allocator splits into separate rules.
    count: int = 1
    part: int = 1
    target_irt_b: Optional[float] = None
    position: int = 0

class MatrixRuleCreate(MatrixRuleBase):
    group_local_id: Optional[str] = None

class MatrixRuleResponse(MatrixRuleBase):
    id: int
    matrix_id: int
    group_id: Optional[int] = None
    knowledge_node: Optional[Dict[str, Any]] = None
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
    duration_minutes: Optional[int] = None
    show_score_mode: str
    show_answer_mode: str

class ExamUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    show_score_mode: Optional[str] = None
    show_answer_mode: Optional[str] = None

# --- Matrix Import Schemas ---
class MatrixImportPreviewRequest(BaseModel):
    content: str
    level_ratios: Dict[int, float] # {1: 0.2, 2: 0.3, 3: 0.3, 4: 0.2}
    type_ratios: Dict[str, float]  # {"SINGLE_CHOICE": 1.0}

class MatrixImportPreviewRow(BaseModel):
    topic: str
    concept: str
    skill: str
    original_count: int
    status: str
    node_id: Optional[int] = None
    suggestions: List[Dict[str, Any]] = []
    distributed_rules: List[Dict[str, Any]] = []

class MatrixImportPreviewResponse(BaseModel):
    preview: List[MatrixImportPreviewRow]

class MatrixImportExecuteRequest(BaseModel):
    confirmed_rows: List[MatrixImportPreviewRow]
    strategy: str # "add" or "replace"
class ExamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    matrix_id: int
    created_at: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
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


# --- Smart Matrix Builder Schemas ---
class SmartMatrixLeafNode(BaseModel):
    node_id: int
    name: str
    node_type: str
    path: str
    question_count: int  # APPROVED questions in bank
    topic_name: Optional[str] = None
    concept_name: Optional[str] = None

class SmartMatrixLeavesRequest(BaseModel):
    node_ids: List[int] = Field(..., min_length=1, description="Selected scope node IDs")

class SmartMatrixLeavesResponse(BaseModel):
    leaves: List[SmartMatrixLeafNode]
    total_questions_in_bank: int

class SmartMatrixProposeRequest(BaseModel):
    node_ids: List[int] = Field(..., min_length=1)
    total_questions: int = Field(..., gt=0, description="Total questions wanted")
    level_ratios: Dict[int, float] = Field(default={1: 0.25, 2: 0.30, 3: 0.30, 4: 0.15})
    type_ratios: Dict[str, float] = Field(default={"SINGLE_CHOICE": 1.0})

class SmartMatrixProposedSkill(BaseModel):
    node_id: int
    name: str
    path: str
    question_count: int  # actual in bank
    proposed_count: int  # suggested allocation
    percentage: float    # percentage of total proposed
    has_warning: bool    # proposed > available

class SmartMatrixProposeResponse(BaseModel):
    skills: List[SmartMatrixProposedSkill]
    total_proposed: int
    total_in_bank: int

class SmartMatrixSkillAllocation(BaseModel):
    node_id: int
    proposed_count: int

class SmartMatrixConfirmRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    subject: Optional[str] = None
    allocations: List[SmartMatrixSkillAllocation] = Field(..., min_length=1)
    total_questions: int = Field(..., gt=0)
    level_ratios: Dict[int, float]
    type_ratios: Dict[str, float]
