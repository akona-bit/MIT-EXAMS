import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import app
from app.api import dependencies
from app.schemas.question import QuestionCreate, AnswerCreate
from app.models.question import QuestionType, QuestionStatus, KnowledgeNodeType


@pytest.fixture(autouse=True)
def setup_client():
    def mock_db():
        db = AsyncMock()
        # db.execute() phải trả về object đồng bộ có .scalars() (không phải coroutine)
        execute_result = MagicMock()
        fake_kn = MagicMock()
        fake_kn.node_type = "SKILL"
        fake_kn.id = 1
        execute_result.scalars.return_value.first.return_value = fake_kn
        execute_result.scalars.return_value.all.return_value = []
        db.execute.return_value = execute_result
        def _question_obj():
            q = MagicMock()
            q.id = 1
            q.content = "Test question"
            q.level = 1
            q.type = QuestionType.SINGLE_CHOICE
            q.knowledge_node_id = 1
            q.resource_id = None
            q.passage_id = None
            q.scoring_config = None
            q.source_author = None
            q.source_title = None
            q.public_code = "QTEST0001"
            q.status = QuestionStatus.PENDING
            q.reject_reason = None
            q.creator_id = 1
            q.parent_question_id = None
            q.usage_count = 0
            q.created_at = datetime.now()
            q.updated_at = datetime.now()
            q.answers = []
            q.sub_items = []
            return q

        def _execute_side_effect(stmt, *args, **kwargs):
            result = MagicMock()
            stmt_str = str(stmt).lower()
            if "knowledge_node_parent" in stmt_str:
                # is_leaf or calculate_path_code parent query
                result.scalar.return_value = 0
                result.scalar_one_or_none.return_value = None
                result.scalars.return_value.first.return_value = _question_obj()
                result.scalars.return_value.all.return_value = []
            elif "from knowledge_node" in stmt_str:
                # select(KnowledgeNode) query — only match "FROM knowledge_node" not "knowledge_node_id"
                fake_kn = MagicMock()
                fake_kn.node_type = KnowledgeNodeType.SKILL
                fake_kn.id = 1
                fake_kn.short_code = "KN01"
                result.scalar.return_value = 1
                result.scalar_one_or_none.return_value = fake_kn
                result.scalars.return_value.first.return_value = fake_kn
                result.scalars.return_value.all.return_value = []
            elif "count()" in stmt_str:
                # func.count() queries (e.g. public_code sequence)
                result.scalar.return_value = 0
                result.scalar_one_or_none.return_value = 0
                result.scalars.return_value.first.return_value = _question_obj()
                result.scalars.return_value.all.return_value = []
            else:
                result.scalar.return_value = 0
                result.scalar_one_or_none.return_value = None
                result.scalars.return_value.first.return_value = _question_obj()
                result.scalars.return_value.all.return_value = []
            return result

        db.execute.side_effect = _execute_side_effect
        return db

    def mock_user():
        user = MagicMock()
        user.role.name = "ADMIN"
        user.is_active = True
        return user

    app.dependency_overrides[dependencies.get_db] = mock_db
    app.dependency_overrides[dependencies.get_current_active_user] = mock_user
    yield
    app.dependency_overrides.clear()


def _make_answers(count, correct_indices):
    answers = []
    for i in range(count):
        answers.append(AnswerCreate(content=f"Answer {i+1}", is_correct=(i in correct_indices), position=i))
    return answers


def test_create_question_singles_choice_3_answers_returns_400():
    payload = QuestionCreate(
        content="Test question",
        level=1,
        type=QuestionType.SINGLE_CHOICE,
        knowledge_node_id=1,
        answers=_make_answers(3, [0]),
    )
    with TestClient(app) as client:
        response = client.post("/api/v1/questions/", json=payload.model_dump())
    assert response.status_code == 400


def test_create_question_singles_choice_4_answers_2_correct_returns_400():
    payload = QuestionCreate(
        content="Test question",
        level=1,
        type=QuestionType.SINGLE_CHOICE,
        knowledge_node_id=1,
        answers=_make_answers(4, [0, 1]),
    )
    with TestClient(app) as client:
        response = client.post("/api/v1/questions/", json=payload.model_dump())
    assert response.status_code == 400


def test_create_question_singles_choice_4_answers_1_correct_returns_200():
    payload = QuestionCreate(
        content="Test question",
        level=1,
        type=QuestionType.SINGLE_CHOICE,
        knowledge_node_id=1,
        answers=_make_answers(4, [0]),
    )
    with TestClient(app) as client:
        response = client.post("/api/v1/questions/", json=payload.model_dump())
    assert response.status_code in (200, 201)