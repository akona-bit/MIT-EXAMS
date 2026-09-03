from pydantic import BaseModel
from typing import Any, Optional, List, Dict
from datetime import datetime

class AnswerItem(BaseModel):
    exam_form_question_id: int
    # SINGLE_CHOICE: truyền 1 id vào selected_answer_id
    selected_answer_id: Optional[int] = None
    # MULTIPLE_CHOICE: truyền list id vào selected_answer_ids
    selected_answer_ids: Optional[List[int]] = None
    # TRUE_FALSE / COMPOSITE: truyền { sub_item_id: answer_id }
    # (với ý con dạng multi, value là list[int])
    selected_subitem_answers: Optional[Dict[int, Any]] = None
    # FILL_IN_BLANK: đáp án dạng text do học sinh nhập
    text_answer: Optional[str] = None

class AutosaveRequest(BaseModel):
    answers: List[AnswerItem]

class AutosaveResponse(BaseModel):
    success: bool
    saved_count: int
    timestamp: datetime

class TrackingEventRequest(BaseModel):
    action_type: str

class TrackingEventResponse(BaseModel):
    success: bool
    timestamp: datetime

class SessionQuestionOption(BaseModel):
    id: int
    content: str

class SessionSubItemOption(BaseModel):
    id: int
    content: str
    position: int

class SessionSubItem(BaseModel):
    """Một ý con của câu TRUE_FALSE / COMPOSITE (không gửi is_correct cho thí sinh)."""
    id: int
    label: str
    prompt: Optional[str] = None
    kind: str = "tf"  # tf | single | multi
    options: List[SessionSubItemOption] = []

class SessionQuestion(BaseModel):
    exam_form_question_id: int
    question_id: int
    public_code: str
    content: str
    type: str
    part: int
    position: int
    passage_id: Optional[int] = None
    options: List[SessionQuestionOption]
    sub_items: List[SessionSubItem] = []

class ExamSessionInfoResponse(BaseModel):
    exam_id: int
    exam_name: str
    form_code: str
    remaining_seconds: Optional[int] = None
    server_time: datetime
    participant_status: str
    questions: List[SessionQuestion] = []
    saved_answers: List[AnswerItem] = []
