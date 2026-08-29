from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class AnswerItem(BaseModel):
    exam_form_question_id: int
    # SINGLE_CHOICE: truyền 1 id vào selected_answer_id
    selected_answer_id: Optional[int] = None
    # MULTIPLE_CHOICE: truyền list id vào selected_answer_ids
    selected_answer_ids: Optional[List[int]] = None
    # TRUE_FALSE / COMPOSITE: truyền { sub_item_id: answer_id }
    selected_subitem_answers: Optional[Dict[int, int]] = None

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

class ExamSessionInfoResponse(BaseModel):
    exam_id: int
    exam_name: str
    form_code: str
    remaining_seconds: int
    server_time: datetime
    participant_status: str
