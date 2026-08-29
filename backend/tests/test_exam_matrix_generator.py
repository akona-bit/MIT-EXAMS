import pytest
from app.services.exam_matrix_generator import (
    MatrixCell, CandidateQuestion, generate_exam, generate_multiple_versions
)

def test_generate_exam_success():
    matrix = [
        MatrixCell("Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE", count=2),
        MatrixCell("Algebra", "Quadratic", "Max Min", "VD", "SINGLE_CHOICE", count=1)
    ]
    
    pool = [
        CandidateQuestion(1, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE"),
        CandidateQuestion(2, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE"),
        CandidateQuestion(3, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE"),
        CandidateQuestion(4, "Algebra", "Quadratic", "Max Min", "VD", "SINGLE_CHOICE"),
        CandidateQuestion(5, "Algebra", "Quadratic", "Max Min", "VD", "SINGLE_CHOICE")
    ]
    
    report = generate_exam(matrix, pool)
    assert report.ok is True
    assert len(report.selected_ids) == 3
    assert len(report.shortages) == 0

def test_generate_exam_shortage_strict_fail():
    matrix = [
        MatrixCell("Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE", count=2),
        MatrixCell("Algebra", "Quadratic", "Max Min", "VD", "SINGLE_CHOICE", count=2) # Needs 2, only has 1
    ]
    
    pool = [
        CandidateQuestion(1, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE"),
        CandidateQuestion(2, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE"),
        CandidateQuestion(4, "Algebra", "Quadratic", "Max Min", "VD", "SINGLE_CHOICE")
    ]
    
    report = generate_exam(matrix, pool)
    assert report.ok is False
    assert len(report.selected_ids) == 0 # STRICT mode returns 0
    assert len(report.shortages) == 1
    assert report.shortages[0].shortage == 1
    
def test_generate_multiple_versions_distinct():
    matrix = [
        MatrixCell("Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE", count=1)
    ]
    
    pool = [
        CandidateQuestion(1, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE"),
        CandidateQuestion(2, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE"),
        CandidateQuestion(3, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE")
    ]
    
    reports = generate_multiple_versions(matrix, pool, n_versions=2, distinct_questions=True)
    assert len(reports) == 2
    assert reports[0].ok is True
    assert reports[1].ok is True
    
    # Assert distinct ids
    assert reports[0].selected_ids[0] != reports[1].selected_ids[0]

def test_exposure_control():
    # We need 2 questions, but there are 4 available.
    # Q1 and Q2 have high exposure. Q3 and Q4 have 0 exposure.
    # The algorithm should pick Q3 and Q4.
    matrix = [
        MatrixCell("Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE", count=2)
    ]
    
    pool = [
        CandidateQuestion(1, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE", exposure_count=10),
        CandidateQuestion(2, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE", exposure_count=5),
        CandidateQuestion(3, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE", exposure_count=0),
        CandidateQuestion(4, "Algebra", "Quadratic", "Find Vertex", "NB", "SINGLE_CHOICE", exposure_count=0)
    ]
    
    report = generate_exam(matrix, pool)
    assert report.ok is True
    # The selected IDs must be exactly 3 and 4, because they have the lowest exposure penalty
    assert set(report.selected_ids) == {3, 4}
