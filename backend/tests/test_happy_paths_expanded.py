import pytest
from types import SimpleNamespace
from datetime import datetime, timezone

# Đảm bảo toàn bộ model được đăng ký mapper trước khi configure_mappers chạy
# (app thật import tất cả qua main.py; test riêng lẻ phải tự import)
import app.models.passage  # noqa: F401
import app.models.omr  # noqa: F401

from app.services import generator, exam_session
from app.services.grading import scorer


class MockScalarResult:
    def __init__(self, items=None, single=None):
        self._items = items or []
        self._single = single

    def scalars(self):
        return self

    def unique(self):
        # Mocks the unique() call that deduplicates results before all()
        return self

    def all(self):
        return list(self._items)

    def first(self):
        if self._items:
            return self._items[0]
        return None

    def scalar_one_or_none(self):
        if self._single is not None:
            return self._single
        return self._items[0] if self._items else None

    def scalar_one(self):
        if self._single is not None:
            return self._single
        if self._items:
            return self._items[0]
        raise Exception("No scalar")


class RichMockDB:
    def __init__(self, execute_results=None):
        self._queue = execute_results or []
        self.added = []
        self._id_counter = 100

    async def execute(self, stmt):
        if self._queue:
            return self._queue.pop(0)
        return MockScalarResult(items=[])

    async def flush(self):
        # assign ids to last added objects that have no id
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                self._id_counter += 1
                try:
                    obj.id = self._id_counter
                except Exception:
                    pass
        return None

    async def commit(self):
        return None

    async def refresh(self, obj):
        return None

    def add(self, obj):
        # emulate SQLAlchemy add and id assignment
        if getattr(obj, "id", None) is None:
            # do not assign immediately; flush will assign
            pass
        self.added.append(obj)


@pytest.mark.asyncio
async def test_generate_original_exam_happy_path_creates_form_and_questions():
    # Prepare matrix with one rule needing 2 questions in part 1
    rule = SimpleNamespace(knowledge_node_id=1, question_type="MCQ", level=1, count=2, part=1)
    matrix = SimpleNamespace(id=1, rules=[rule])

    # Prepare two question mocks with answers
    q1 = SimpleNamespace(id=11, answers=[SimpleNamespace(id=101), SimpleNamespace(id=102)])
    q2 = SimpleNamespace(id=12, answers=[SimpleNamespace(id=103), SimpleNamespace(id=104)])

    # DB query order inside generate_original_exam:
    # 1. get_all_descendant_leaves -> children of knowledge_node_id (empty => node is a leaf)
    # 2. select(Question) with answers -> available_questions
    exec_results = [MockScalarResult(items=[]), MockScalarResult(items=[q1, q2])]
    db = RichMockDB(execute_results=exec_results)

    exam = await generator.generate_original_exam(db, matrix, "Exam X", "desc")

    # verify exam object returned and adds were made for exam, form, questions, answers
    added_types = [type(o).__name__ for o in db.added]
    # Expect at least Exam, ExamForm, ExamFormQuestion objects added
    assert any(name in ("Exam", "Exam") for name in added_types)
    assert any("ExamForm" in name for name in added_types)
    # There should be ExamFormQuestion and ExamFormAnswer objects added too
    assert any("ExamFormQuestion" in name for name in added_types) or any("ExamFormQuestion" == name for name in added_types)


@pytest.mark.asyncio
async def test_get_or_assign_exam_form_happy_path_assigns_and_returns_form():
    # participant initially without exam_form_id
    participant = SimpleNamespace(id=201, exam_form_id=None, exam_id=2, user_id=3, is_banned=False, status="NOT_STARTED", start_time=None)
    # one shuffled form available
    form = SimpleNamespace(id=301, exam_id=2, code="101", is_original=False, questions=["q1"])

    # execute queue: first participant lookup -> returns participant
    # second: find forms -> returns form list
    # third: reload selected form -> return form
    exec_results = [MockScalarResult(items=[participant]), MockScalarResult(items=[form]), MockScalarResult(items=[form])]
    db = RichMockDB(execute_results=exec_results)

    returned = await exam_session.get_or_assign_exam_form(db, exam_id=2, user_id=3)

    assert returned is not None
    assert getattr(participant, "exam_form_id") == form.id
    assert participant.status == "IN_PROGRESS" or participant.status == "IN_PROGRESS"
    assert participant.start_time is not None


@pytest.mark.asyncio
async def test_grade_submission_ctt_happy_path_scores_correctly():
    # Build a submission with one participant and one answer correct and one incorrect
    # Submission.answers: list of objects with exam_form_question_id and selected_answer_id
    sa1 = SimpleNamespace(exam_form_question_id=401, selected_answer_id=501)
    sa2 = SimpleNamespace(exam_form_question_id=402, selected_answer_id=502)
    participant = SimpleNamespace(id=301, exam_form_id=201, exam_id=5)
    submission = SimpleNamespace(id=1001, participant=participant, answers=[sa1, sa2])

    # Form questions: two form questions mapping to question ids and parts
    # (scorer mới cần question_ref.type/.sub_items và fq.answers[].answer_id)
    q_ref = SimpleNamespace(type=SimpleNamespace(value="SINGLE_CHOICE"), sub_items=[], scoring_config=None)
    fq1 = SimpleNamespace(id=401, question_id=1001, position=1, part=1, question_ref=q_ref, answers=[SimpleNamespace(answer_id=501)])
    fq2 = SimpleNamespace(id=402, question_id=1002, position=2, part=1, question_ref=q_ref, answers=[SimpleNamespace(answer_id=502)])

    # No original form id (return None)
    # Answer rows cho toàn bộ đáp án trong form (is_correct True/False)
    ans1 = SimpleNamespace(id=501, is_correct=True, sub_item_id=None, content="A")
    ans2 = SimpleNamespace(id=502, is_correct=False, sub_item_id=None, content="B")

    # execute queue order inside grade_submission_ctt:
    # 1. select(ExamSubmission) -> submission
    # 2. select(ExamFormQuestion) -> form questions
    # 3. select(ExamForm.id) for original -> none
    # 4. select(Answer).where(...) -> answers
    # 5. select(ExamResult) -> none
    exec_results = [
        MockScalarResult(items=[submission]),
        MockScalarResult(items=[fq1, fq2]),
        MockScalarResult(items=[], single=None),
        MockScalarResult(items=[ans1, ans2]),
        MockScalarResult(items=[])
    ]

    db = RichMockDB(execute_results=exec_results)

    result = await scorer.grade_submission_ctt(db, submission_id=1001)
    assert result is not None
    # part_scores: one correct -> part1 = 1
    assert result.ctt_score_part1 == 1
    assert result.raw_total_score == 1
