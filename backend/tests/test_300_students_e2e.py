"""
E2E Test: 300 thí sinh thi trắc nghiệm 120 câu, 4 phần.
Flow: Seed DB → Tạo Exam → Assign 300 participants → Submit → Grade CTT → Run IRT
"""
import pytest
import numpy as np
import random
from datetime import datetime, timezone
from sqlalchemy import create_engine, text, JSON
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


# SQLite adapter: JSONB → JSON
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


from app.models.base import Base
from app.models.user import Role, User
from app.models.passage import Passage
from app.models.question import (
    Question, Answer, KnowledgeNode, KnowledgeNodeType,
    QuestionType, QuestionStatus, QuestionSkillTag,
)
from app.models.exam import (
    Exam, ExamStatus, ExamForm, ExamFormQuestion, ExamFormAnswer,
    ExamParticipant, ParticipantStatus, ExamSubmission, ExamSubmissionAnswer,
    Matrix,
)
from app.models.grading import ExamResult
from app.services.grading.irt_engine import mmle, theta_estimate, true_score

import pandas as pd

# ── Fixtures ────────────────────────────────────────────────────────────────

NUM_STUDENTS = 300
NUM_QUESTIONS = 120
NUM_PARTS = 4
QUESTIONS_PER_PART = NUM_QUESTIONS // NUM_PARTS  # 30


@pytest.fixture(scope="module")
def engine():
    eng = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture(scope="module")
def Session(engine):
    return sessionmaker(bind=engine)


# ── Helpers ─────────────────────────────────────────────────────────────────

def seed_users(session, n_students=NUM_STUDENTS):
    """Tạo role STUDENT + ADMIN và n_students user."""
    student_role = Role(name="STUDENT", description="Student")
    admin_role = Role(name="ADMIN", description="Admin")
    session.add_all([student_role, admin_role])
    session.flush()

    admin = User(
        full_name="Admin",
        username="admin",
        email="admin@test.com",
        hashed_password="x",
        role_id=admin_role.id,
    )
    session.add(admin)
    session.flush()

    students = []
    for i in range(1, n_students + 1):
        u = User(
            full_name=f"Thí sinh {i:03d}",
            username=f"sv{i:04d}",
            email=f"sv{i:04d}@test.com",
            hashed_password="x",
            role_id=student_role.id,
        )
        students.append(u)
    session.add_all(students)
    session.flush()
    return admin, students


def seed_knowledge_and_questions(session, creator_id, n=NUM_QUESTIONS):
    """Tạo 1 knowledge node + n câu SINGLE_CHOICE, mỗi câu 4 đáp án."""
    kn = KnowledgeNode(
        name="Toán tổng hợp",
        node_type=KnowledgeNodeType.SKILL,
        subject="Toán",
    )
    session.add(kn)
    session.flush()

    questions = []
    all_answers = []
    for i in range(1, n + 1):
        part = (i - 1) // QUESTIONS_PER_PART + 1
        q = Question(
            content=f"Câu {i} - Phần {part}",
            level=random.choice([1, 2, 3]),
            type=QuestionType.SINGLE_CHOICE,
            status=QuestionStatus.APPROVED,
            public_code=f"Q{i:04d}",
            creator_id=creator_id,
        )
        q.skill_tags = [QuestionSkillTag(knowledge_node_id=kn.id, is_primary=True)]
        questions.append(q)
        session.add(q)
        session.flush()

        correct_idx = random.randint(0, 3)
        for j in range(4):
            a = Answer(
                question_id=q.id,
                content=f"Câu {i} đáp án {chr(65 + j)}",
                is_correct=(j == correct_idx),
                position=j,
            )
            all_answers.append(a)
    session.add_all(all_answers)
    session.flush()
    return questions


def seed_exam_with_forms(session, questions, admin):
    """Tạo Exam + 1 ExamForm (original) với 120 câu."""
    matrix = Matrix(name="Ma trận ĐGNL", subject="Toán")
    session.add(matrix)
    session.flush()

    exam = Exam(
        name="Thi thử ĐGNL 300 thí sinh",
        matrix_id=matrix.id,
        duration_minutes=150,
        status=ExamStatus.DRAFT,
    )
    session.add(exam)
    session.flush()

    # Original form
    form = ExamForm(exam_id=exam.id, code="101", is_original=True)
    session.add(form)
    session.flush()

    fq_list = []
    for pos, q in enumerate(questions[:NUM_QUESTIONS], start=1):
        part = (pos - 1) // QUESTIONS_PER_PART + 1
        fq = ExamFormQuestion(
            exam_form_id=form.id,
            question_id=q.id,
            position=pos,
            part=part,
        )
        fq_list.append(fq)
    session.add_all(fq_list)
    session.flush()

    # Tạo ExamFormAnswer cho mỗi ExamFormQuestion (map answer_id → new_position)
    efa_list = []
    for fq in fq_list:
        answers_result = session.execute(
            text("SELECT id FROM answer WHERE question_id = :qid ORDER BY position"),
            {"qid": fq.question_id},
        )
        ans_ids = [r[0] for r in answers_result.fetchall()]
        for idx, aid in enumerate(ans_ids):
            efa = ExamFormAnswer(
                exam_form_question_id=fq.id,
                answer_id=aid,
                new_position=idx + 1,
            )
            efa_list.append(efa)
    session.add_all(efa_list)
    session.flush()

    return exam, form, fq_list


def assign_participants(session, exam, students):
    """Assign tất cả students làm participant."""
    participants = []
    for s in students:
        p = ExamParticipant(
            exam_id=exam.id,
            user_id=s.id,
            status=ParticipantStatus.NOT_STARTED,
        )
        participants.append(p)
    session.add_all(participants)
    session.flush()
    return participants


def simulate_submissions(session, exam, participants, fq_list):
    """
    Mỗi thí sinh nộp bài: randomly chọn đáp án.
    Tạo các nhóm năng lực: 20% giỏi (70-90%), 60% trung bình (40-65%), 20% yếu (15-35%).
    """
    ability_groups = (
        [(0.70, 0.90)] * int(NUM_STUDENTS * 0.20)   # 60 giỏi
        + [(0.40, 0.65)] * int(NUM_STUDENTS * 0.60)  # 180 trung bình
        + [(0.15, 0.35)] * int(NUM_STUDENTS * 0.20)  # 60 yếu
    )
    random.shuffle(ability_groups)

    submissions = []
    for idx, participant in enumerate(participants):
        lo, hi = ability_groups[idx]
        ability = random.uniform(lo, hi)

        sub = ExamSubmission(exam_participant_id=participant.id)
        session.add(sub)
        session.flush()

        sa_list = []
        for fq in fq_list:
            # Lấy đáp án đúng
            correct_ans_result = session.execute(
                text("SELECT id FROM answer WHERE question_id = :qid AND is_correct = 1"),
                {"qid": fq.question_id},
            )
            correct_id = correct_ans_result.fetchone()[0]

            # Lấy tất cả đáp án
            all_ans_result = session.execute(
                text("SELECT id FROM answer WHERE question_id = :qid ORDER BY position"),
                {"qid": fq.question_id},
            )
            all_ids = [r[0] for r in all_ans_result.fetchall()]

            # Random chọn theo ability
            if random.random() < ability:
                chosen_id = correct_id
            else:
                wrong_ids = [a for a in all_ids if a != correct_id]
                chosen_id = random.choice(wrong_ids)

            sa = ExamSubmissionAnswer(
                exam_submission_id=sub.id,
                exam_form_question_id=fq.id,
                selected_answer_id=chosen_id,
            )
            sa_list.append(sa)
        session.add_all(sa_list)
        session.flush()
        submissions.append(sub)

    return submissions


def grade_all_ctt(session, submissions):
    """Chấm CTT cho tất cả submissions."""
    results = []
    for sub in submissions:
        # Giả lập grade_submission_ctt bằng cách tính trực tiếp
        participant = session.execute(
            text("SELECT exam_form_id, exam_id FROM exam_participant ep "
                 "JOIN exam_submission es ON es.exam_participant_id = ep.id "
                 "WHERE es.id = :sub_id"),
            {"sub_id": sub.id},
        ).fetchone()
        exam_form_id = participant[0]

        # Lấy original form position mapping
        original_form = session.execute(
            text("SELECT id FROM exam_form WHERE exam_id = :eid AND is_original = 1"),
            {"eid": participant[1]},
        ).fetchone()
        orig_fq = session.execute(
            text("SELECT question_id, position FROM exam_form_question WHERE exam_form_id = :fid"),
            {"fid": original_form[0]},
        ).fetchall()
        qid_to_pos = {r[0]: r[1] for r in orig_fq}

        # Lấy answers của thí sinh
        sub_answers = session.execute(
            text("SELECT esa.exam_form_question_id, esa.selected_answer_id "
                 "FROM exam_submission_answer esa "
                 "WHERE esa.exam_submission_id = :sub_id"),
            {"sub_id": sub.id},
        ).fetchall()

        item_scores = {}
        part_scores = {1: 0, 2: 0, 3: 0, 4: 0}

        for fq_id, selected_id in sub_answers:
            # Tìm question_id và position
            fq_info = session.execute(
                text("SELECT question_id, position, part FROM exam_form_question WHERE id = :fqid"),
                {"fqid": fq_id},
            ).fetchone()
            question_id = fq_info[0]
            orig_pos = qid_to_pos.get(question_id, fq_info[1])
            part = fq_info[2]

            if not (1 <= orig_pos <= 120):
                continue

            if selected_id:
                is_correct = session.execute(
                    text("SELECT is_correct FROM answer WHERE id = :aid"),
                    {"aid": selected_id},
                ).fetchone()
                score = 1 if is_correct and is_correct[0] else 0
            else:
                score = -1

            item_scores[str(orig_pos)] = score
            if score == 1:
                part_scores[part] += 1

        er = ExamResult(
            exam_submission_id=sub.id,
            ctt_score_part1=float(part_scores[1]),
            ctt_score_part2=float(part_scores[2]),
            ctt_score_part3=float(part_scores[3]),
            ctt_score_part4=float(part_scores[4]),
            raw_total_score=float(sum(part_scores.values())),
            item_scores=item_scores,
            score_method="CTT",
        )
        session.add(er)
        results.append(er)

    session.flush()
    return results


def run_irt_on_results(session, exam_id, fq_list):
    """Chạy IRT: MMLE → theta → true_score → cập nhật ExamResult."""
    # Lấy original form mapping
    original_form = session.execute(
        text("SELECT id FROM exam_form WHERE exam_id = :eid AND is_original = 1"),
        {"eid": exam_id},
    ).fetchone()
    orig_fq = session.execute(
        text("SELECT question_id, position FROM exam_form_question WHERE exam_form_id = :fid"),
        {"fid": original_form[0]},
    ).fetchall()
    position_to_qid = {r[1]: r[0] for r in orig_fq}

    # Lấy tất cả ExamResult
    all_results = session.execute(
        text("SELECT er.id, er.item_scores "
             "FROM exam_result er "
             "JOIN exam_submission es ON es.id = er.exam_submission_id "
             "JOIN exam_participant ep ON ep.id = es.exam_participant_id "
             "WHERE ep.exam_id = :eid"),
        {"eid": exam_id},
    ).fetchall()

    N = len(all_results)
    J = NUM_QUESTIONS

    # Build response matrix U
    U = np.full((N, J), -1, dtype=int)
    result_ids = []
    for i, (er_id, item_scores_json) in enumerate(all_results):
        import json
        item_scores = json.loads(item_scores_json) if isinstance(item_scores_json, str) else (item_scores_json or {})
        result_ids.append(er_id)
        for pos_str, score in item_scores.items():
            try:
                pos = int(pos_str)
                if 1 <= pos <= J:
                    U[i, pos - 1] = int(score) if score != -1 else -1
            except (ValueError, TypeError):
                pass

    # Run MMLE
    a_est, b_est = mmle(U, name="IRT_300_test", max_iter=30, K=41, verbose=False)

    # Theta estimation
    clean_responses = []
    for i in range(N):
        row = U[i, :].copy()
        row[row == -1] = 0
        clean_responses.append(row)

    item_params_list = [(float(a), float(b)) for a, b in zip(a_est, b_est)]
    theta_est = np.array(theta_estimate(clean_responses, item_params_list))

    # Calculate true scores
    cau_names = [f"Cau{i}" for i in range(1, J + 1)]
    item_params_df = pd.DataFrame(item_params_list, columns=["a", "b"], index=cau_names)

    for i, er_id in enumerate(result_ids):
        theta = float(theta_est[i])
        student_data = pd.Series(clean_responses[i], index=cau_names)

        parts_scores = []
        for p in range(4):
            start_idx = p * QUESTIONS_PER_PART
            end_idx = (p + 1) * QUESTIONS_PER_PART
            part_data = student_data.iloc[start_idx:end_idx]
            part_params = item_params_df.iloc[start_idx:end_idx]
            part_raw = int(part_data.sum())
            p_score = true_score(theta, part_raw, part_data, part_params)
            parts_scores.append(p_score)

        session.execute(
            text("UPDATE exam_result SET "
                 "irt_score_part1 = :p1, irt_score_part2 = :p2, "
                 "irt_score_part3 = :p3, irt_score_part4 = :p4, "
                 "total_score = :total, score_method = 'IRT' "
                 "WHERE id = :er_id"),
            {
                "p1": float(parts_scores[0]),
                "p2": float(parts_scores[1]),
                "p3": float(parts_scores[2]),
                "p4": float(parts_scores[3]),
                "total": float(sum(parts_scores)),
                "er_id": er_id,
            },
        )

    session.flush()
    return a_est, b_est, theta_est


# ── TEST ────────────────────────────────────────────────────────────────────


def test_300_students_full_flow(Session):
    """Test end-to-end: 300 thí sinh thi, chấm CTT, chạy IRT."""
    session = Session()

    # 1. Seed data
    admin, students = seed_users(session, NUM_STUDENTS)
    questions = seed_knowledge_and_questions(session, admin.id, NUM_QUESTIONS)
    exam, form, fq_list = seed_exam_with_forms(session, questions, admin)
    participants = assign_participants(session, exam, students)
    session.commit()

    assert len(participants) == NUM_STUDENTS, f"Expected {NUM_STUDENTS} participants"

    # 2. Simulate submissions
    submissions = simulate_submissions(session, exam, participants, fq_list)
    session.commit()

    assert len(submissions) == NUM_STUDENTS, f"Expected {NUM_STUDENTS} submissions"

    # 3. Grade CTT
    results = grade_all_ctt(session, submissions)
    session.commit()

    assert len(results) == NUM_STUDENTS, f"Expected {NUM_STUDENTS} results"

    # Verify CTT scores are in valid range
    for r in results:
        assert 0 <= r.ctt_score_part1 <= QUESTIONS_PER_PART
        assert 0 <= r.ctt_score_part2 <= QUESTIONS_PER_PART
        assert 0 <= r.ctt_score_part3 <= QUESTIONS_PER_PART
        assert 0 <= r.ctt_score_part4 <= QUESTIONS_PER_PART
        assert 0 <= r.raw_total_score <= NUM_QUESTIONS
        assert r.score_method == "CTT"

    # Statistics
    ctt_totals = [r.raw_total_score for r in results]
    print(f"\n{'='*60}")
    print(f"CTT Results ({NUM_STUDENTS} students):")
    print(f"  Mean:   {np.mean(ctt_totals):.1f}/{NUM_QUESTIONS}")
    print(f"  Median: {np.median(ctt_totals):.1f}")
    print(f"  Std:    {np.std(ctt_totals):.1f}")
    print(f"  Min:    {min(ctt_totals):.0f}")
    print(f"  Max:    {max(ctt_totals):.0f}")

    # 4. Run IRT (N=300 >= threshold 200)
    print(f"\nRunning IRT calibration on {NUM_STUDENTS} submissions...")
    a_est, b_est, theta_est = run_irt_on_results(session, exam.id, fq_list)
    session.commit()

    # Verify IRT scores
    irt_results = session.execute(
        text("SELECT irt_score_part1, irt_score_part2, irt_score_part3, irt_score_part4, total_score "
             "FROM exam_result er "
             "JOIN exam_submission es ON es.id = er.exam_submission_id "
             "JOIN exam_participant ep ON ep.id = es.exam_participant_id "
             "WHERE ep.exam_id = :eid"),
        {"eid": exam.id},
    ).fetchall()

    assert len(irt_results) == NUM_STUDENTS

    irt_totals = []
    for r in irt_results:
        assert r[0] is not None, "irt_score_part1 should not be None"
        assert r[1] is not None, "irt_score_part2 should not be None"
        assert r[2] is not None, "irt_score_part3 should not be None"
        assert r[3] is not None, "irt_score_part4 should not be None"
        assert r[4] is not None, "total_score should not be None"
        for part_score in r[:4]:
            assert 0 <= part_score <= 300, f"IRT part score {part_score} out of range"
        assert 0 <= r[4] <= 1200, f"IRT total {r[4]} out of range"
        irt_totals.append(r[4])

    print(f"\nIRT Results ({NUM_STUDENTS} students):")
    print(f"  Mean:   {np.mean(irt_totals):.1f}/1200")
    print(f"  Median: {np.median(irt_totals):.1f}")
    print(f"  Std:    {np.std(irt_totals):.1f}")
    print(f"  Min:    {min(irt_totals):.1f}")
    print(f"  Max:    {max(irt_totals):.1f}")

    # Verify item parameters
    print(f"\nIRT Item Parameters (120 items):")
    print(f"  a_param range: [{a_est.min():.3f}, {a_est.max():.3f}]")
    print(f"  b_param range: [{b_est.min():.3f}, {b_est.max():.3f}]")
    print(f"  Mean a: {a_est.mean():.3f}")
    print(f"  Mean b: {b_est.mean():.3f}")

    # Verify theta distribution
    print(f"\nTheta Distribution:")
    print(f"  Mean:   {theta_est.mean():.3f}")
    print(f"  Std:    {theta_est.std():.3f}")
    print(f"  Range:  [{theta_est.min():.3f}, {theta_est.max():.3f}]")

    print(f"\n{'='*60}")
    print(f"ALL CHECKS PASSED for {NUM_STUDENTS} students!")
    print(f"{'='*60}")

    session.close()
