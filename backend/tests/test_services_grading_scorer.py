import inspect

from app.services.grading import scorer


def test_scorer_functions_exist_and_types():
    assert hasattr(scorer, "grade_submission_ctt"), "grade_submission_ctt missing"
    assert inspect.iscoroutinefunction(scorer.grade_submission_ctt)

    # The Celery task is a sync function decorated with shared_task; ensure callable
    assert hasattr(scorer, "run_irt_calibration_task"), "run_irt_calibration_task missing"
    assert callable(scorer.run_irt_calibration_task)
