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
    model_config = ConfigDict(from_attributes=True)

# --- Answer Schemas ---
class AnswerBase(BaseModel):
    content: str
    is_correct: bool = False
    position: int = 0

class AnswerCreate(AnswerBase):
    pass

class AnswerResponse(AnswerBase):
    id: int
    question_id: int
    model_config = ConfigDict(from_attributes=True)

# --- Question Schemas ---
class QuestionBase(BaseModel):
    content: str
    level: int = 1
    type: QuestionType = QuestionType.SINGLE_CHOICE
    knowledge_node_id: int
    resource_id: Optional[int] = None

class QuestionCreate(QuestionBase):
    answers: List[AnswerCreate]

class QuestionUpdate(BaseModel):
    content: Optional[str] = None
    level: Optional[int] = None
    type: Optional[QuestionType] = None
    knowledge_node_id: Optional[int] = None
    resource_id: Optional[int] = None
    answers: Optional[List[AnswerCreate]] = None

class QuestionResponse(QuestionBase):
    id: int
    status: QuestionStatus
    creator_id: int
    parent_question_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    answers: List[AnswerResponse]
    model_config = ConfigDict(from_attributes=True)
