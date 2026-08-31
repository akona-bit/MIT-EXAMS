import inspect

from app.api.v1 import passages


def test_passages_api_has_handlers():
    handlers = ["search_passages", "get_passage", "create_passage", "update_passage", "create_questions_bulk", "update_questions_bulk"]
    for h in handlers:
        assert hasattr(passages, h), f"Handler {h} missing in passages module"
        attr = getattr(passages, h)
        # FastAPI route handlers are async functions
        assert inspect.iscoroutinefunction(attr) or callable(attr)
