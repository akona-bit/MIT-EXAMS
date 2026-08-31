import pytest
from types import SimpleNamespace
from fastapi import HTTPException

from app.services import exam_session
from app.models.exam import ParticipantStatus


class MockScalarResult:
    def __init__(self, items=None):
        self._items = items or []

    def scalars(self):
        return self

    def first(self):
        return self._items[0] if self._items else None

    def all(self):
        return list(self._items)


class MockDB:
    def __init__(self, queue):
        self._queue = queue

    async def execute(self, stmt):
        if self._queue:
            return self._queue.pop(0)
        return MockScalarResult([])

    async def commit(self):
        return None

    async def flush(self):
        return None

    def add(self, obj):
        return None


@pytest.mark.asyncio
async def test_suspend_then_autosave_blocks():
    participant = SimpleNamespace(id=1, exam_id=10, user_id=20, status=ParticipantStatus.IN_PROGRESS, is_banned=False)

    # First execute (suspend) returns participant; second execute (autosave) returns the same participant now suspended
    db = MockDB([MockScalarResult(items=[participant]), MockScalarResult(items=[participant])])

    # Suspend the participant
    res = await exam_session.suspend_exam_session(db, exam_id=10, user_id=20, admin_user_id=99)
    assert res is True

    # Now autosave should be blocked (403)
    with pytest.raises(HTTPException) as excinfo:
        await exam_session.autosave_answers(db, exam_id=10, user_id=20, req=SimpleNamespace(answers=[]))

    assert excinfo.value.status_code == 403
