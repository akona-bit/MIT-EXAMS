import inspect

from app.services import exam_session


def test_exam_session_module_has_expected_functions():
    expected = [
        "publish_exam",
        "assign_participants",
        "get_or_assign_exam_form",
        "get_exam_session_info",
        "autosave_answers",
        "submit_exam",
        "log_tracking_event",
        "suspend_exam_session",
    ]

    for name in expected:
        assert hasattr(exam_session, name), f"{name} missing in exam_session"

    # Most are async functions
    for name in expected:
        attr = getattr(exam_session, name)
        assert inspect.iscoroutinefunction(attr) or callable(attr)
