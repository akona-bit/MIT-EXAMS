import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock
from fastapi import HTTPException

from app.services import generator, exam_session
from app.services.grading import scorer


class MockScalarResult:
    def __init__(self, items=None, single=None):
        self._items = items or []
        self._single = single

    def scalars(self):
        return self

    def all(self):
        return list(self._items)

    def first(self):
        if self._items:
            return self._items[0]
        return None

    def scalar_one_or_none(self):
        if self._items:
            return self._items[0]
        return None

    def scalar_one(self):
        if self._single is not None:
            return self._single
        if self._items:
            return self._items[0]
        raise Exception("No scalar")


class MockDB:
    def __init__(self, execute_results=None):
        # execute_results is a queue of MockScalarResult to return sequentially
        self._queue = execute_results or []
        self.added = []

    async def execute(self, stmt):
        # pop next result if available
        if self._queue:
            return self._queue.pop(0)
        return MockScalarResult([])

    async def flush(self):
        return None

    async def commit(self):
        return None

    async def refresh(self, obj):
        return None

    def add(self, obj):
        self.added.append(obj)


@pytest.mark.asyncio
async def test_generate_original_exam_raises_when_not_enough_questions():
    # matrix with one rule requiring 1 question but DB returns none
    rule = SimpleNamespace(knowledge_node_id=1, question_type="MCQ", level=1, status=None, count=1, part=1)
    matrix = SimpleNamespace(id=10, rules=[rule])

    mock_db = MockDB(execute_results=[MockScalarResult(items=[])])

    with pytest.raises(HTTPException) as excinfo:
        await generator.generate_original_exam(mock_db, matrix, "Exam A", "desc")

    assert excinfo.value.status_code == 400


@pytest.mark.asyncio
async def test_get_or_assign_exam_form_raises_when_exam_not_found():
    mock_db = MockDB(execute_results=[MockScalarResult(items=[])])  # participant lookup -> rỗng

    # Exam lookup cũng rỗng (queue cạn -> mặc định rỗng) -> 404
    with pytest.raises(HTTPException) as excinfo:
        await exam_session.get_or_assign_exam_form(mock_db, exam_id=1, user_id=2)
    assert excinfo.value.status_code == 404


@pytest.mark.asyncio
async def test_get_or_assign_exam_form_self_enrolls_published_exam():
    """Học sinh chưa được ghi danh vẫn tự tham gia được kỳ thi PUBLISHED."""
    from app.models.exam import ExamStatus

    form = SimpleNamespace(id=301, exam_id=1, code="101", is_original=False, questions=["q1"])
    exam = SimpleNamespace(id=1, status=ExamStatus.PUBLISHED)

    mock_db = MockDB(execute_results=[
        MockScalarResult(items=[]),      # participant lookup -> chưa ghi danh
        MockScalarResult(items=[exam]),  # exam lookup -> PUBLISHED
        MockScalarResult(items=[form]),  # danh sách mã đề khả dụng
        MockScalarResult(items=[form]),  # reload form được gán
    ])

    returned = await exam_session.get_or_assign_exam_form(mock_db, exam_id=1, user_id=2)

    assert returned is form
    # Đã tự tạo ExamParticipant
    assert any(type(o).__name__ == "ExamParticipant" for o in mock_db.added)


@pytest.mark.asyncio
async def test_get_or_assign_exam_form_rejects_draft_exam():
    """Kỳ thi chưa PUBLISHED -> vẫn chặn 403 như cũ."""
    from app.models.exam import ExamStatus

    exam = SimpleNamespace(id=1, status=ExamStatus.DRAFT)
    mock_db = MockDB(execute_results=[
        MockScalarResult(items=[]),      # participant lookup -> chưa ghi danh
        MockScalarResult(items=[exam]),  # exam lookup -> DRAFT
    ])

    with pytest.raises(HTTPException) as excinfo:
        await exam_session.get_or_assign_exam_form(mock_db, exam_id=1, user_id=2)
    assert excinfo.value.status_code == 403


@pytest.mark.asyncio
async def test_grade_submission_ctt_returns_none_when_no_submission():
    # grade_submission_ctt returns None if submission not found
    mock_db = MockDB(execute_results=[MockScalarResult(items=[])])

    res = await scorer.grade_submission_ctt(mock_db, submission_id=9999)
    assert res is None
