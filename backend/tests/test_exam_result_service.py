"""Unit test cho service exam_result (trang xem kết quả thí sinh).

Chạy: python -m pytest tests/test_exam_result_service.py -v
"""
import pytest
from types import SimpleNamespace

from fastapi import HTTPException

# Đảm bảo toàn bộ model được đăng ký mapper trước khi service chạy
# (app thật import tất cả qua main.py; khi test riêng lẻ phải import thủ công)
import app.models.passage  # noqa: F401
import app.models.omr  # noqa: F401

from app.models.exam import ParticipantStatus
from app.services import exam_result
from app.services.exam_result import resolve_irt_state, get_student_exam_result


class MockScalarResult:
    def __init__(self, items=None, single=None, scalar=None):
        self._items = items or []
        self._single = single
        self._scalar = scalar

    def scalars(self):
        return self

    def all(self):
        return list(self._items)

    def first(self):
        if self._single is not None:
            return self._single
        return self._items[0] if self._items else None

    def scalar_one_or_none(self):
        return self._single

    def scalar(self):
        return self._scalar


class MockDB:
    def __init__(self, execute_results):
        self._queue = list(execute_results)

    async def execute(self, stmt):
        if self._queue:
            item = self._queue.pop(0)
            if isinstance(item, Exception):
                raise item
            return item
        return MockScalarResult()


def _participant(status: str):
    return SimpleNamespace(
        id=1,
        exam_id=10,
        user_id=5,
        exam_form_id=77,
        status=ParticipantStatus(status),
        exam=SimpleNamespace(name="Kỳ thi ĐGNL thử nghiệm"),
    )


def _fake_exam_result(method="CTT", with_irt=False):
    return SimpleNamespace(
        ctt_score_part1=25.0,
        ctt_score_part2=25.0,
        ctt_score_part3=25.0,
        ctt_score_part4=25.0,
        raw_total_score=100.0,
        total_score=1050.0 if with_irt else None,
        irt_score_part1=280.0 if with_irt else None,
        irt_score_part2=265.0 if with_irt else None,
        irt_score_part3=255.0 if with_irt else None,
        irt_score_part4=250.0 if with_irt else None,
        item_scores={str(i): 1 for i in range(1, 101)},
        item_points={},
        score_method=method,
    )


# ---------------------------------------------------------------- IRT gate

def test_irt_state_no_task():
    state = resolve_irt_state(None, 500)
    assert state["state"] == "no_data"
    assert state["eligible"] is False


def test_irt_state_computing():
    for status in ("PENDING", "STARTED"):
        state = resolve_irt_state(status, 500)
        assert state["state"] == "computing"
        assert state["eligible"] is False


def test_irt_state_not_enough_data():
    state = resolve_irt_state("SUCCESS", 150)
    assert state["state"] == "not_enough_data"
    assert state["eligible"] is False
    assert "150/200" in state["message"]


def test_irt_state_done():
    state = resolve_irt_state("SUCCESS", 250)
    assert state["state"] == "done"
    assert state["eligible"] is True


def test_irt_state_failed():
    state = resolve_irt_state("FAILED", 500)
    assert state["eligible"] is False


# ------------------------------------------------- Điều kiện truy cập

@pytest.mark.asyncio
async def test_in_progress_is_blocked():
    """Đang thi (IN_PROGRESS) → 403, không trả kết quả."""
    db = MockDB([MockScalarResult(items=[_participant("IN_PROGRESS")])])
    user = SimpleNamespace(id=5, can_view_answers=False)
    with pytest.raises(HTTPException) as exc:
        await get_student_exam_result(db, 10, 5, user)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_not_started_is_blocked():
    db = MockDB([MockScalarResult(items=[_participant("NOT_STARTED")])])
    user = SimpleNamespace(id=5, can_view_answers=False)
    with pytest.raises(HTTPException) as exc:
        await get_student_exam_result(db, 10, 5, user)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_no_participant_404():
    db = MockDB([MockScalarResult(items=[])])
    user = SimpleNamespace(id=5, can_view_answers=False)
    with pytest.raises(HTTPException) as exc:
        await get_student_exam_result(db, 10, 5, user)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_suspended_can_view_result():
    """Bị đình chỉ (SUSPENDED) vẫn được xem điểm phần đã làm."""
    submission = SimpleNamespace(id=99, submit_time=None)

    db = MockDB([
        MockScalarResult(items=[_participant("SUSPENDED")]),   # participant
        MockScalarResult(items=[submission]),                  # submission
        MockScalarResult(items=[]),                            # load_exam_result -> None
        MockScalarResult(items=[]),                            # latest IrtTask -> None
        MockScalarResult(scalar=100),                          # submission count
    ])

    import app.services.exam_result as er

    fake_result = _fake_exam_result(method="CTT", with_irt=False)

    async def fake_grade(db_, submission_id):
        return fake_result

    original = er.grade_submission_ctt
    er.grade_submission_ctt = fake_grade
    try:
        user = SimpleNamespace(id=5, can_view_answers=False)
        data = await get_student_exam_result(db, 10, 5, user)
    finally:
        er.grade_submission_ctt = original

    assert data["participant_status"] == "SUSPENDED"
    assert data["is_suspended"] is True
    assert data["raw_scores"]["total"] == 100.0
    assert data["raw_scores"]["parts"][0]["raw_score"] == 25.0
    # Chưa đủ điều kiện IRT → không lộ số liệu IRT
    assert data["true_score"]["available"] is False
    assert data["true_score"]["eligible"] is False
    # Không có quyền xem đáp án → không trả review
    assert data["can_view_answers"] is False
    assert data["review"] is None


@pytest.mark.asyncio
async def test_irt_shown_when_eligible():
    """Đủ ngưỡng + task SUCCESS + đã có điểm IRT → trả điểm thực."""
    submission = SimpleNamespace(id=99, submit_time=None)

    db = MockDB([
        MockScalarResult(items=[_participant("SUBMITTED")]),   # participant
        MockScalarResult(items=[submission]),                  # submission
        MockScalarResult(items=[_fake_exam_result("IRT", True)]),  # ExamResult có sẵn
        MockScalarResult(items=[SimpleNamespace(status="SUCCESS")]),  # IrtTask
        MockScalarResult(scalar=250),                          # submission count
    ])

    import app.services.exam_result as er

    async def fake_grade(db_, submission_id):  # pragma: no cover
        raise AssertionError("Không được chấm lại khi ExamResult đã tồn tại")

    original = er.grade_submission_ctt
    er.grade_submission_ctt = fake_grade
    try:
        user = SimpleNamespace(id=5, can_view_answers=False)
        data = await get_student_exam_result(db, 10, 5, user)
    finally:
        er.grade_submission_ctt = original

    assert data["true_score"]["available"] is True
    assert data["true_score"]["irt_total"] == 1050.0
    assert data["raw_scores"]["parts"][0]["irt_score"] == 280.0


@pytest.mark.asyncio
async def test_irt_hidden_below_threshold():
    """Task SUCCESS nhưng N < 200 → KHÔNG hiển thị điểm IRT."""
    submission = SimpleNamespace(id=99, submit_time=None)

    db = MockDB([
        MockScalarResult(items=[_participant("SUBMITTED")]),
        MockScalarResult(items=[submission]),
        MockScalarResult(items=[_fake_exam_result("IRT", True)]),
        MockScalarResult(items=[SimpleNamespace(status="SUCCESS")]),
        MockScalarResult(scalar=120),  # dưới ngưỡng 200
    ])

    user = SimpleNamespace(id=5, can_view_answers=False)
    data = await get_student_exam_result(db, 10, 5, user)

    assert data["true_score"]["available"] is False
    assert data["true_score"]["state"] == "not_enough_data"
    # Điểm thô vẫn hiển thị bình thường
    assert data["raw_scores"]["total"] == 100.0

