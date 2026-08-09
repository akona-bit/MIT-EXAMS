from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AnswerItem(BaseModel):
    exam_form_question_id: int
    selected_answer_id: Optional[int]

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
