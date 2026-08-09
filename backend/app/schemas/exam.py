from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models.question import QuestionType
from app.models.exam import ExamStatus, ParticipantStatus

# --- MatrixRule Schemas ---
class MatrixRuleBase(BaseModel):
    knowledge_node_id: int
    question_type: QuestionType
    level: int = 1
    count: int = 1
    part: int = 1

class MatrixRuleCreate(MatrixRuleBase):
    pass

class MatrixRuleResponse(MatrixRuleBase):
    id: int
    matrix_id: int
    model_config = ConfigDict(from_attributes=True)

# --- Matrix Schemas ---
class MatrixBase(BaseModel):
    name: str
    description: Optional[str] = None

class MatrixCreate(MatrixBase):
    rules: List[MatrixRuleCreate]

class MatrixResponse(MatrixBase):
    id: int
    created_at: datetime
    rules: List[MatrixRuleResponse]
    model_config = ConfigDict(from_attributes=True)

# --- Exam Generation Request ---
class GenerateExamRequest(BaseModel):
    matrix_id: int
    exam_name: str
    exam_description: Optional[str] = None
    number_of_forms: int = 1

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
