import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.exam_matrix_generator import (
    MatrixCell,
    CandidateQuestion,
    generate_exam,
)

def run_test():
    # 1. MOCK POOL
    # Passage 1 có đủ 3 câu
    pool = [
        CandidateQuestion(id=1, topic="Toán", concept="Hàm số", skill="Tìm m", level="VD", question_type="MCQ", passage_id=1, status="APPROVED"),
        CandidateQuestion(id=2, topic="Toán", concept="Hàm số", skill="Đồ thị", level="VD", question_type="MCQ", passage_id=1, status="APPROVED"),
        CandidateQuestion(id=3, topic="Toán", concept="Hàm số", skill="Cực trị", level="VD", question_type="MCQ", passage_id=1, status="APPROVED"),
        # Passage 2 chỉ có 2 câu (thiếu)
        CandidateQuestion(id=4, topic="Toán", concept="Hàm số", skill="Tìm m", level="VD", question_type="MCQ", passage_id=2, status="APPROVED"),
        CandidateQuestion(id=5, topic="Toán", concept="Hàm số", skill="Đồ thị", level="VD", question_type="MCQ", passage_id=2, status="APPROVED"),
        
        # Các câu độc lập không có passage_id
        CandidateQuestion(id=6, topic="Lý", concept="Động học", skill="Tính S", level="TH", question_type="MCQ", passage_id=None, status="APPROVED"),
        CandidateQuestion(id=7, topic="Lý", concept="Động học", skill="Tính V", level="TH", question_type="MCQ", passage_id=None, status="APPROVED"),
    ]

    # 2. MOCK MATRIX
    matrix = [
        MatrixCell(topic="Lý", concept="Động học", skill="Tính S", level="TH", question_type="MCQ", count=1, position=1),
        MatrixCell(topic="Toán", concept="Hàm số", skill="Tìm m", level="VD", question_type="MCQ", count=1, position=97, group_id=1, group_label="Nhóm 97-99"),
        MatrixCell(topic="Toán", concept="Hàm số", skill="Đồ thị", level="VD", question_type="MCQ", count=1, position=98, group_id=1, group_label="Nhóm 97-99"),
        MatrixCell(topic="Toán", concept="Hàm số", skill="Cực trị", level="VD", question_type="MCQ", count=1, position=99, group_id=1, group_label="Nhóm 97-99"),
    ]

    print("--- TEST 1: Đủ passage ---")
    report = generate_exam(matrix, pool)
    print("OK:", report.ok)
    print("Selected IDs:", report.selected_ids)
    if report.ok:
        selected_questions = [q for q in pool if q.id in report.selected_ids]
        group_questions = [q for q in selected_questions if q.id in [1, 2, 3, 4, 5]]
        print("Group questions passages:", [q.passage_id for q in group_questions])
        assert all(q.passage_id == 1 for q in group_questions), "Không dùng chung 1 passage!"

    print("\n--- TEST 2: Thiếu câu hỏi trong passage (STRICT FAIL) ---")
    # Xoá câu hỏi 3 (passage 1) để nhóm 1 bị thiếu
    pool = [q for q in pool if q.id != 3]
    report2 = generate_exam(matrix, pool)
    print("OK:", report2.ok)
    print("Warnings:", report2.warnings)
    assert not report2.ok, "Cần phải FAIL vì không passage nào thoả mãn đủ 3 ô"
    assert any("Nhóm 'Nhóm 97-99'" in w for w in report2.warnings), "Cần báo lỗi chính xác Nhóm nào"

    print("\n--- TEST 3: Độc lập ---")
    matrix_indep = [
        MatrixCell(topic="Lý", concept="Động học", skill="Tính S", level="TH", question_type="MCQ", count=1, position=1),
        MatrixCell(topic="Toán", concept="Hàm số", skill="Tìm m", level="VD", question_type="MCQ", count=1, position=97),
        MatrixCell(topic="Toán", concept="Hàm số", skill="Đồ thị", level="VD", question_type="MCQ", count=1, position=98),
    ]
    report3 = generate_exam(matrix_indep, pool)
    print("OK:", report3.ok)
    if report3.ok:
        print("Selected IDs:", report3.selected_ids)

if __name__ == "__main__":
    run_test()
