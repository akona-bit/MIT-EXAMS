import inspect
from types import SimpleNamespace

from app.services.grading import scorer
from app.services.grading.scorer import score_question_answer


def _answer(id, is_correct=False, sub_item_id=None, content=""):
    return SimpleNamespace(id=id, is_correct=is_correct, sub_item_id=sub_item_id, content=content)


def _sub_item(id, kind="tf", point_weight=0.25):
    return SimpleNamespace(id=id, kind=kind, point_weight=point_weight)


def _question(sub_items=None, scoring_config=None):
    return SimpleNamespace(sub_items=sub_items or [], scoring_config=scoring_config)


def _sa(**kwargs):
    defaults = dict(
        selected_answer_id=None,
        selected_answer_ids=None,
        selected_subitem_answers=None,
        text_answer=None,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_scorer_functions_exist_and_types():
    assert hasattr(scorer, "grade_submission_ctt"), "grade_submission_ctt missing"
    assert inspect.iscoroutinefunction(scorer.grade_submission_ctt)

    # The Celery task is a sync function decorated with shared_task; ensure callable
    assert hasattr(scorer, "run_irt_calibration_task"), "run_irt_calibration_task missing"
    assert callable(scorer.run_irt_calibration_task)


def test_single_choice_scoring():
    rows = [_answer(1, True), _answer(2), _answer(3), _answer(4)]
    q = _question()
    assert score_question_answer("SINGLE_CHOICE", q, rows, _sa(selected_answer_id=1))[0] == 1.0
    assert score_question_answer("SINGLE_CHOICE", q, rows, _sa(selected_answer_id=2))[0] == 0.0
    assert score_question_answer("SINGLE_CHOICE", q, rows, _sa())[0] == -1.0


def test_multiple_choice_scoring():
    q = _question()
    rows = [_answer(1, True), _answer(2, True), _answer(3), _answer(4)]
    assert score_question_answer("MULTIPLE_CHOICE", q, rows, _sa(selected_answer_ids=[2, 1]))[0] == 1.0
    assert score_question_answer("MULTIPLE_CHOICE", q, rows, _sa(selected_answer_ids=[1, 3]))[0] == 0.0
    assert score_question_answer("MULTIPLE_CHOICE", q, rows, _sa(selected_answer_ids=[]))[0] == -1.0


def test_fill_in_blank_scoring_normalizes_text():
    q = _question()
    rows = [_answer(1, True, content="  Hà Nội  "), _answer(2, False, content="Hải Phòng")]
    assert score_question_answer("FILL_IN_BLANK", q, rows, _sa(text_answer="hà nội"))[0] == 1.0
    assert score_question_answer("FILL_IN_BLANK", q, rows, _sa(text_answer="Đà Nẵng"))[0] == 0.0
    assert score_question_answer("FILL_IN_BLANK", q, rows, _sa(text_answer="   "))[0] == -1.0


def test_true_false_scoring_by_correct_count():
    sub_ids = [101, 102, 103, 104]
    sub_items = [_sub_item(sid) for sid in sub_ids]
    q = _question(sub_items)
    rows = []
    for i, sid in enumerate(sub_ids):
        rows.append(_answer(10 + i * 2, True, sub_item_id=sid))
        rows.append(_answer(11 + i * 2, False, sub_item_id=sid))

    # Đúng cả 4 ý -> 1.0
    sel_all = {sid: 10 + i * 2 for i, sid in enumerate(sub_ids)}
    assert score_question_answer("TRUE_FALSE", q, rows, _sa(selected_subitem_answers=sel_all))[0] == 1.0
    # Đúng 3 ý -> 0.5
    sel_3 = dict(sel_all)
    sel_3[104] = 11 + 3 * 2
    assert score_question_answer("TRUE_FALSE", q, rows, _sa(selected_subitem_answers=sel_3))[0] == 0.5
    # Đúng 2 ý -> 0.25
    sel_2 = {101: 10, 102: 12}
    assert score_question_answer("TRUE_FALSE", q, rows, _sa(selected_subitem_answers=sel_2))[0] == 0.25
    # Đúng 1 ý -> 0.1
    sel_1 = {104: 10 + 3 * 2}
    assert score_question_answer("TRUE_FALSE", q, rows, _sa(selected_subitem_answers=sel_1))[0] == 0.1
    # Đúng 0 ý (có trả lời) -> 0.0
    sel_0 = {sid: 11 + i * 2 for i, sid in enumerate(sub_ids)}
    assert score_question_answer("TRUE_FALSE", q, rows, _sa(selected_subitem_answers=sel_0))[0] == 0.0
    # Bỏ trống -> -1
    assert score_question_answer("TRUE_FALSE", q, rows, _sa())[0] == -1.0


def test_true_false_scoring_accepts_json_string_keys():
    sub_items = [_sub_item(101), _sub_item(102)]
    q = _question(sub_items)
    rows = [
        _answer(1, True, sub_item_id=101), _answer(2, False, sub_item_id=101),
        _answer(3, True, sub_item_id=102), _answer(4, False, sub_item_id=102),
    ]
    # Key dạng string như khi đọc lại từ cột JSON
    assert score_question_answer(
        "TRUE_FALSE", q, rows, _sa(selected_subitem_answers={"101": 1, "102": 3})
    )[0] == 1.0
    assert score_question_answer(
        "TRUE_FALSE", q, rows, _sa(selected_subitem_answers={"101": 2, "102": 3})
    )[0] == 0.1


def test_true_false_scoring_config_override():
    sub_items = [_sub_item(1), _sub_item(2)]
    q = _question(sub_items, scoring_config={"1": 0.5, "2": 1.0})
    rows = [
        _answer(1, True, sub_item_id=1), _answer(2, False, sub_item_id=1),
        _answer(3, True, sub_item_id=2), _answer(4, False, sub_item_id=2),
    ]
    assert score_question_answer("TRUE_FALSE", q, rows, _sa(selected_subitem_answers={1: 1}))[0] == 0.5
    assert score_question_answer("TRUE_FALSE", q, rows, _sa(selected_subitem_answers={1: 1, 2: 3}))[0] == 1.0


def test_true_false_legacy_without_sub_items():
    q = _question()
    rows = [_answer(1, True), _answer(2, False)]
    assert score_question_answer("TRUE_FALSE", q, rows, _sa(selected_answer_id=1))[0] == 1.0
    assert score_question_answer("TRUE_FALSE", q, rows, _sa(selected_answer_id=2))[0] == 0.0


def test_composite_scoring_sums_point_weights():
    sub_items = [
        _sub_item(1, kind="single", point_weight=0.5),
        _sub_item(2, kind="tf", point_weight=0.25),
        _sub_item(3, kind="tf", point_weight=0.25),
    ]
    q = _question(sub_items)
    rows = [
        _answer(1, True, sub_item_id=1), _answer(2, False, sub_item_id=1),
        _answer(3, True, sub_item_id=2), _answer(4, False, sub_item_id=2),
        _answer(5, False, sub_item_id=3), _answer(6, True, sub_item_id=3),
    ]
    # Đúng ý 1 (0.5) + ý 2 (0.25), bỏ ý 3
    result = score_question_answer(
        "COMPOSITE", q, rows, _sa(selected_subitem_answers={1: 1, 2: 3})
    )
    assert result[0] == 0.75
    # Điểm tối đa = tổng point_weight = 1.0
    assert result[4] == 1.0
    # Điểm từng ý con
    assert result[1] == {1: 0.5, 2: 0.25, 3: 0.0}
    # Bỏ trống hoàn toàn -> -1
    assert score_question_answer("COMPOSITE", q, rows, _sa())[0] == -1.0
