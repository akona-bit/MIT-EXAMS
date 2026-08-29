from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models.question import QuestionType, QuestionStatus, ResourceType

# --- KnowledgeNode Schemas ---
class KnowledgeNodeBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None

class KnowledgeNodeCreate(KnowledgeNodeBase):
    pass

class KnowledgeNodeResponse(KnowledgeNodeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- Resource Schemas ---
class ResourceBase(BaseModel):
    type: ResourceType
    content_url: str

class ResourceCreate(ResourceBase):
    pass

class ResourceResponse(ResourceBase):
    id: int
    uploader_id: int
    original_name: str
    mime_type: Optional[str] = None
    size_bytes: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Answer Schemas ---
class AnswerBase(BaseModel):
    content: str
    is_correct: bool = False
    position: int = 0
    sub_item_id: Optional[int] = None  # nếu đáp án thuộc về một ý con

class AnswerCreate(AnswerBase):
    pass

class AnswerResponse(AnswerBase):
    id: int
    question_id: int
    model_config = ConfigDict(from_attributes=True)

# --- QuestionSubItem Schemas ---
class QuestionSubItemBase(BaseModel):
    label: str
    prompt: Optional[str] = None
    position: int = 0
    point_weight: float = 0.25
    kind: str = "tf"  # "tf" / "single" / "multi"

class QuestionSubItemCreate(QuestionSubItemBase):
    answers: Optional[List[AnswerCreate]] = None


class QuestionSubItemResponse(QuestionSubItemBase):
    id: int
    answers: List[AnswerResponse] = []
    model_config = ConfigDict(from_attributes=True)

# --- Question Schemas ---
class QuestionBase(BaseModel):
    content: str
    level: int = 1
    type: QuestionType = QuestionType.SINGLE_CHOICE
    knowledge_node_id: int
    resource_id: Optional[int] = None
    scoring_config: Optional[dict] = None

class QuestionCreate(QuestionBase):
    answers: List[AnswerCreate] = []
    sub_items: Optional[List[QuestionSubItemCreate]] = None

class QuestionUpdate(BaseModel):
    content: Optional[str] = None
    level: Optional[int] = None
    type: Optional[QuestionType] = None
    knowledge_node_id: Optional[int] = None
    resource_id: Optional[int] = None
    scoring_config: Optional[dict] = None
    answers: Optional[List[AnswerCreate]] = None
    sub_items: Optional[List[QuestionSubItemCreate]] = None

class QuestionResponse(QuestionBase):
    id: int
    status: QuestionStatus
    creator_id: int
    parent_question_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    answers: List[AnswerResponse] = []
    sub_items: List[QuestionSubItemResponse] = []
    model_config = ConfigDict(from_attributes=True)
