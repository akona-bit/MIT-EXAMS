from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models.question import QuestionType, QuestionStatus, ResourceType, KnowledgeNodeType

# --- KnowledgeNode Schemas ---
class KnowledgeNodeBase(BaseModel):
    name: str
    description: Optional[str] = None
    note: Optional[str] = None
    parent_id: Optional[int] = None
    node_type: Optional[KnowledgeNodeType] = None

class KnowledgeNodeCreate(KnowledgeNodeBase):
    pass

class KnowledgeNodeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    note: Optional[str] = None
    parent_id: Optional[int] = None
    node_type: Optional[KnowledgeNodeType] = None

class KnowledgeNodeResponse(KnowledgeNodeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    question_count: int = 0

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    label: Optional[str] = None

class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

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
    primary_knowledge_node_id: int
    secondary_knowledge_node_ids: List[int] = []
    resource_id: Optional[int] = None
    passage_id: Optional[int] = None
    scoring_config: Optional[dict] = None
    source_author: Optional[str] = None
    source_title: Optional[str] = None

class QuestionCreate(QuestionBase):
    answers: List[AnswerCreate] = []
    sub_items: Optional[List[QuestionSubItemCreate]] = None

class QuestionUpdate(BaseModel):
    content: Optional[str] = None
    level: Optional[int] = None
    type: Optional[QuestionType] = None
    primary_knowledge_node_id: Optional[int] = None
    secondary_knowledge_node_ids: Optional[List[int]] = None
    resource_id: Optional[int] = None
    passage_id: Optional[int] = None
    scoring_config: Optional[dict] = None
    source_author: Optional[str] = None
    source_title: Optional[str] = None
    answers: Optional[List[AnswerCreate]] = None
    sub_items: Optional[List[QuestionSubItemCreate]] = None
    public_code: Optional[str] = None  # Dùng khi update bulk

class QuestionReviewRequest(BaseModel):
    approve: bool
    reject_reason: Optional[str] = None

class QuestionResponse(QuestionBase):
    id: int
    public_code: str
    status: QuestionStatus
    reject_reason: Optional[str] = None
    creator_id: int
    parent_question_id: Optional[int] = None
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime
    answers: List[AnswerResponse] = []
    sub_items: List[QuestionSubItemResponse] = []
    model_config = ConfigDict(from_attributes=True)

class QuestionSimilarityResponse(BaseModel):
    question_id: int
    similarity_score: float
    content: str
    status: str
