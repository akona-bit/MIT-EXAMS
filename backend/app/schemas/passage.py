from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime
from .question import QuestionCreate, QuestionUpdate, QuestionResponse, QuestionType, AnswerCreate

class PassageBase(BaseModel):
    content: str
    source_author: Optional[str] = None
    source_title: Optional[str] = None

class PassageCreate(PassageBase):
    pass

class PassageUpdate(BaseModel):
    content: Optional[str] = None
    source_author: Optional[str] = None
    source_title: Optional[str] = None

class PassageResponse(PassageBase):
    id: int
    public_code: str
    creator_id: int
    created_at: datetime
    updated_at: datetime
    question_count: int = 0
    questions: List[QuestionResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

class PassageSearchResponse(BaseModel):
    public_code: str
    preview: str
    source_title: Optional[str] = None
    question_count: int = 0

# --- Bulk Schemas ---

class QuestionBulkItem(QuestionCreate):
    @field_validator('answers')
    @classmethod
    def validate_answers(cls, v, info):
        # We only validate strictly for SINGLE_CHOICE right now
        # But assuming all bulk items here are SINGLE_CHOICE as per prompt
        if len(v) != 4:
            raise ValueError("Must have exactly 4 answers")
        correct_count = sum(1 for a in v if a.is_correct)
        if correct_count != 1:
            raise ValueError("Must have exactly 1 correct answer")
        return v

class QuestionBulkCreateRequest(BaseModel):
    questions: List[QuestionBulkItem]

class QuestionBulkUpdateItem(QuestionCreate):
    public_code: Optional[str] = None
    
    @field_validator('answers')
    @classmethod
    def validate_answers(cls, v, info):
        if len(v) != 4:
            raise ValueError("Must have exactly 4 answers")
        correct_count = sum(1 for a in v if a.is_correct)
        if correct_count != 1:
            raise ValueError("Must have exactly 1 correct answer")
        return v

class QuestionBulkUpdateRequest(BaseModel):
    questions: List[QuestionBulkUpdateItem]
