from typing import Any, Optional
import asyncio

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import AsyncSessionLocal
from app.models.exam import ExamForm, ExamFormQuestion, ExamSubmission, ExamParticipant, ExamSubmissionAnswer
from app.models.grading import ExamResult, IrtTask, ItemAnalysisResult
from app.models.question import Answer, Question, QuestionType

import numpy as np
import pandas as pd
from sqlalchemy import update, delete
from app.db.bulk import bulk_insert, bulk_update
from app.services.grading.irt_engine import mmle, theta_estimate, true_score, all_item_se, chi_square
from app.services.grading.ctt_engine import cal_diff, cal_disc, label_distractor, cal_pbcc
from datetime import datetime, timezone

# ─── Luật chấm điểm theo dạng câu (đồng bộ comment trong models/grading.py) ───
# SINGLE_CHOICE / MULTIPLE_CHOICE / FILL_IN_BLANK: 1 / 0 / -1 (bỏ trống)
# TRUE_FALSE: điểm theo số ý đúng — mặc định 1 ý = 0.1, 2 ý = 0.25, 3 ý = 0.5,
#             đủ hết ý = 1.0; tuỳ chỉnh qua Question.scoring_config {"1": 0.1, ...}
# COMPOSITE: tổng điểm cộng dồn các ý con (theo point_weight của từng ý)
TRUE_FALSE_DEFAULT_POINTS = {0: 0.0, 1: 0.1, 2: 0.25, 3: 0.5}


def _normalize_text(value: Optional[str]) -> str:
    """Chuẩn hoá text để so sánh đáp án FILL_IN_BLANK (không phân biệt hoa/thường/khoảng trắng)."""
    return " ".join((value or "").strip().lower().split())


def _true_false_point_map(scoring_config: Optional[dict]) -> dict[int, float]:
    """Điểm theo số ý đúng cho TRUE_FALSE; chấp nhận key là int hoặc str (JSON)."""
    if scoring_config:
        try:
            return {int(k): float(v) for k, v in scoring_config.items()}
        except (TypeError, ValueError):
            pass
    return dict(TRUE_FALSE_DEFAULT_POINTS)


def _has_answer(sa: Optional[ExamSubmissionAnswer]) -> bool:
    if sa is None:
        return False
    return bool(
        sa.selected_answer_id
        or sa.selected_answer_ids
        or sa.selected_subitem_answers
        or (sa.text_answer is not None and sa.text_answer.strip() != "")
    )


def _subitem_value(mapping: Optional[dict], sub_item_id: int) -> Any:
    """Lấy đáp án thí sinh chọn cho 1 ý con — key JSON có thể là int hoặc str."""
    if not mapping:
        return None
    if sub_item_id in mapping:
        return mapping[sub_item_id]
    return mapping.get(str(sub_item_id))


def _chosen_ids_for_subitem(value: Any) -> list[int]:
    """Chuẩn hoá lựa chọn của 1 ý con: int, list[int] hoặc None."""
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [int(v) for v in value if v is not None]
    try:
        return [int(value)]
    except (TypeError, ValueError):
        return []


def _score_subitem(kind: str, weight: float, correct_ids: list[int], chosen_ids: list[int]) -> float:
    """Điểm 1 ý con theo kind: single/tf chọn đúng 1 đáp án; multi khớp đúng bộ đáp án."""
    if not chosen_ids or not correct_ids:
        return 0.0
    if kind == "multi":
        return weight if set(chosen_ids) == set(correct_ids) else 0.0
    # tf / single: chọn 1 đáp án, đúng nếu trùng đáp án đúng của ý con
    return weight if len(chosen_ids) == 1 and chosen_ids[0] in correct_ids else 0.0


def score_question_answer(
    qtype: QuestionType,
    question: Optional[Question],
    answer_rows: list[Answer],
    sa: Optional[ExamSubmissionAnswer],
) -> tuple[float, dict, Any, Any, float]:
    """Hàm thuần chấm 1 câu theo dạng câu — không đụng DB, dễ unit test.

    Returns (score, subitem_scores, correct_map, selected_map, max_points)
    - score = -1 nếu bỏ trống, ngược lại >= 0
    - subitem_scores: {sub_item_id: điểm ý con} (rỗng nếu câu không có ý con)
    - correct_map / selected_map: list[int] với đáp án trực tiếp,
      dict {sub_item_id: ...} với câu có ý con — dùng lưu ExamResult
    """
    sub_items = list(question.sub_items) if question is not None else []
    direct_correct = [a.id for a in answer_rows if a.sub_item_id is None and a.is_correct]

    # Điểm tối đa + đáp án đúng (dùng cả khi thí sinh bỏ trống)
    if sub_items:
        correct_map = {
            si.id: [a.id for a in answer_rows if a.sub_item_id == si.id and a.is_correct]
            for si in sub_items
        }
        max_points = (
            sum(si.point_weight or 0.0 for si in sub_items)
            if qtype == QuestionType.COMPOSITE
            else 1.0
        )
    else:
        correct_map = direct_correct
        max_points = 1.0

    if not _has_answer(sa):
        return -1.0, {}, correct_map, {}, max_points

    # ─── Câu có ý con: TRUE_FALSE / COMPOSITE ───
    if sub_items and qtype in (QuestionType.TRUE_FALSE, QuestionType.COMPOSITE):
        subitem_scores: dict[int, float] = {}
        selected_map: dict[int, Any] = {}
        n_correct = 0
        total = 0.0
        for si in sub_items:
            chosen = _chosen_ids_for_subitem(
                _subitem_value(sa.selected_subitem_answers if sa else None, si.id)
            )
            correct_ids = correct_map.get(si.id, [])
            pts = _score_subitem(si.kind or "tf", si.point_weight or 0.0, correct_ids, chosen)
            subitem_scores[si.id] = pts
            selected_map[si.id] = _subitem_value(
                sa.selected_subitem_answers if sa else None, si.id
            )
            if pts > 0:
                n_correct += 1
            total += pts
        if qtype == QuestionType.COMPOSITE:
            score = total
        else:
            # TRUE_FALSE: điểm theo số ý đúng, đủ hết ý = 1.0
            point_map = _true_false_point_map(question.scoring_config if question else None)
            score = 1.0 if n_correct == len(sub_items) else point_map.get(n_correct, 0.0)
        return score, subitem_scores, correct_map, selected_map, max_points

    # ─── Câu không ý con ───
    if qtype == QuestionType.MULTIPLE_CHOICE:
        chosen = set(int(a) for a in (sa.selected_answer_ids or []) if a is not None)
        score = 1.0 if chosen and chosen == set(direct_correct) else 0.0
        return score, {}, correct_map, sorted(chosen), max_points

    if qtype == QuestionType.FILL_IN_BLANK:
        text = _normalize_text(sa.text_answer)
        correct_texts = {_normalize_text(a.content) for a in answer_rows if a.is_correct}
        score = 1.0 if text and text in correct_texts else 0.0
        return score, {}, correct_map, sa.text_answer, max_points

    # SINGLE_CHOICE (và TRUE_FALSE legacy không có ý con — chỉ 1 ô Đúng/Sai)
    chosen_id = sa.selected_answer_id
    score = 1.0 if chosen_id is not None and chosen_id in direct_correct else 0.0
    return score, {}, correct_map, ([chosen_id] if chosen_id else []), max_points


async def grade_submission_ctt(db: AsyncSession, submission_id: int) -> ExamResult | None:
    result = await db.execute(
        select(ExamSubmission)
        .options(
            selectinload(ExamSubmission.answers),
            selectinload(ExamSubmission.participant),
        )
        .where(ExamSubmission.id == submission_id)
    )
    submission = result.scalars().first()
    if not submission or not submission.participant:
        return None

    participant = submission.participant
    if not participant.exam_form_id:
        return None

    form_questions_result = await db.execute(
        select(ExamFormQuestion)
        .options(
            selectinload(ExamFormQuestion.answers),
            selectinload(ExamFormQuestion.question_ref).selectinload(Question.sub_items),
        )
        .where(ExamFormQuestion.exam_form_id == participant.exam_form_id)
    )
    form_questions = form_questions_result.scalars().unique().all()

    original_form_result = await db.execute(
        select(ExamForm.id).where(
            ExamForm.exam_id == participant.exam_id,
            ExamForm.is_original.is_(True),
        )
    )
    original_form_id = original_form_result.scalar_one_or_none()
    original_positions: dict[int, int] = {}
    if original_form_id:
        original_questions_result = await db.execute(
            select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == original_form_id)
        )
        original_positions = {
            question.question_id: question.position
            for question in original_questions_result.scalars().all()
        }

    # Load toàn bộ Answer gốc được tham chiếu bởi form (cần is_correct + sub_item_id)
    all_answer_ids = [fa.answer_id for fq in form_questions for fa in fq.answers]
    answer_rows_by_id: dict[int, Answer] = {}
    if all_answer_ids:
        answers_result = await db.execute(select(Answer).where(Answer.id.in_(all_answer_ids)))
        answer_rows_by_id = {a.id: a for a in answers_result.scalars().all()}

    # Map exam_form_question_id -> đáp án thí sinh (cần ghi điểm từng câu)
    submission_answers_by_fq = {
        answer.exam_form_question_id: answer for answer in submission.answers
    }

    item_scores: dict[str, float] = {str(position): -1 for position in range(1, 121)}
    item_subitem_scores: dict[str, float] = {}
    item_types: dict[str, str] = {}
    item_points: dict[str, float] = {}
    correct_answers: dict[str, Any] = {}
    selected_answers: dict[str, Any] = {}
    part_scores = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0}

    for form_question in form_questions:
        original_position = original_positions.get(form_question.question_id, form_question.position)
        if not 1 <= original_position <= 120:
            continue

        question = form_question.question_ref
        qtype = question.type if question is not None else QuestionType.SINGLE_CHOICE
        answer_rows = [
            answer_rows_by_id[fa.answer_id]
            for fa in form_question.answers
            if fa.answer_id in answer_rows_by_id
        ]
        sa = submission_answers_by_fq.get(form_question.id)

        score, subitem_scores, correct_map, selected_map, max_points = score_question_answer(
            qtype, question, answer_rows, sa
        )

        item_scores[str(original_position)] = score
        q_key = f"q_{form_question.question_id}"
        item_types[q_key] = qtype.value
        item_points[q_key] = max_points
        correct_answers[q_key] = correct_map
        selected_answers[q_key] = selected_map
        for sid, pts in subitem_scores.items():
            item_subitem_scores[f"{q_key}_sub_{sid}"] = pts
        if sa is not None:
            sa.score = max(score, 0.0)
        if form_question.part in part_scores:
            part_scores[form_question.part] += max(score, 0.0)

    result_query = await db.execute(
        select(ExamResult).where(ExamResult.exam_submission_id == submission_id)
    )
    exam_result = result_query.scalars().first()
    if not exam_result:
        exam_result = ExamResult(exam_submission_id=submission_id)
        db.add(exam_result)

    exam_result.ctt_score_part1 = part_scores[1]
    exam_result.ctt_score_part2 = part_scores[2]
    exam_result.ctt_score_part3 = part_scores[3]
    exam_result.ctt_score_part4 = part_scores[4]
    exam_result.raw_total_score = sum(part_scores.values())
    exam_result.item_scores = item_scores
    exam_result.item_subitem_scores = item_subitem_scores
    exam_result.item_types = item_types
    exam_result.item_points = item_points
    exam_result.correct_answers = correct_answers
    exam_result.selected_answers = selected_answers
    exam_result.total_points = sum(item_points.values()) if item_points else None
    exam_result.score_method = "CTT"

    await db.commit()
    await db.refresh(exam_result)
    return exam_result


@shared_task(bind=True)
def run_irt_calibration_task(self: Any, exam_id: int) -> dict[str, Any]:
    async def process_irt() -> dict[str, Any]:
        async with AsyncSessionLocal() as db:
            # 1. Mark as started
            result = await db.execute(
                select(IrtTask).where(IrtTask.celery_task_id == self.request.id)
            )
            task = result.scalars().first()
            if task:
                task.status = "STARTED"
                await db.commit()
            
            # 2. Get original form
            original_form_result = await db.execute(
                select(ExamForm.id).where(
                    ExamForm.exam_id == exam_id,
                    ExamForm.is_original.is_(True),
                )
            )
            original_form_id = original_form_result.scalar_one_or_none()
            if not original_form_id:
                if task:
                    task.status = "FAILED"
                    await db.commit()
                return {"status": "FAILED", "reason": "No original form found"}
            
            # Get original form questions to map position -> question_id
            form_q_result = await db.execute(
                select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == original_form_id)
            )
            form_questions = form_q_result.scalars().all()
            position_to_qid = {q.position: q.question_id for q in form_questions}
            
            # 3. Get all submissions and their results for this exam
            sub_res = await db.execute(
                select(ExamResult, ExamSubmission)
                .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
                .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
                .where(ExamParticipant.exam_id == exam_id)
            )
            records = sub_res.all()
            if not records:
                if task:
                    task.status = "SUCCESS" # No data to run
                    await db.commit()
                return {"status": "SUCCESS", "message": "No submissions found"}
                
            N = len(records)
            J = 120
            
            # 4. Build response matrix U
            U = np.full((N, J), -1, dtype=int)
            for i, (exam_result, submission) in enumerate(records):
                item_scores = exam_result.item_scores or {}
                for pos_str, score in item_scores.items():
                    try:
                        pos = int(pos_str)
                        if 1 <= pos <= J:
                            U[i, pos - 1] = 1 if score > 0 else 0
                    except ValueError:
                        pass
            
            # 5. Run MMLE to get a, b parameters
            try:
                # K=41 to speed up, max_iter=30
                a_est, b_est = mmle(U, name=f"IRT_Exam_{exam_id}", max_iter=30, K=41, verbose=False)
                item_params_for_se = [(float(a), float(b)) for a, b in zip(a_est, b_est)]
                se_a, se_b = all_item_se(item_params_for_se)
            except Exception as e:
                if task:
                    task.status = "FAILED"
                    task.error_details = f"MMLE/SE failed: {str(e)}"
                    await db.commit()
                return {"status": "FAILED", "reason": f"MMLE failed: {str(e)}"}
            
            # 6. Update Question parameters in DB
            item_params_list = []
            question_updates = []
            for j in range(J):
                pos = j + 1
                qid = position_to_qid.get(pos)
                a_val, b_val = float(a_est[j]), float(b_est[j])
                item_params_list.append((a_val, b_val))
                if qid:
                    question_updates.append({
                        "id": qid,
                        "a_param": a_val,
                        "b_param": b_val,
                        "is_calibrated": True
                    })
            if question_updates:
                await bulk_update(db, Question, question_updates)
            
            # 7. Estimate Theta for all students
            # Prepare clean responses for theta estimation (replace -1 with 0)
            clean_responses = []
            for i in range(N):
                row = U[i, :].copy()
                row[row == -1] = 0
                clean_responses.append(row)
                
            try:
                theta_est = theta_estimate(clean_responses, item_params_list)
            except Exception as e:
                if task:
                    task.status = "FAILED"
                    task.error_details = f"Theta estimation failed: {str(e)}"
                    await db.commit()
                return {"status": "FAILED", "reason": f"Theta estimation failed: {str(e)}"}
            
            # 8. Calculate true scores and update ExamResult
            cau_names = [f"Cau{i}" for i in range(1, J+1)]
            item_params_df = pd.DataFrame(item_params_list, columns=["a", "b"], index=cau_names)
            
            exam_result_updates = []
            for i, (exam_result, submission) in enumerate(records):
                theta = float(theta_est[i])
                student_responses = clean_responses[i]
                student_data = pd.Series(student_responses, index=cau_names)
                
                # Split into 4 parts (30 items each)
                parts_scores = []
                for p in range(4):
                    start_idx = p * 30
                    end_idx = (p + 1) * 30
                    part_data = student_data.iloc[start_idx:end_idx]
                    part_params = item_params_df.iloc[start_idx:end_idx]
                    part_raw = int(part_data.sum())
                    
                    p_score = true_score(theta, part_raw, part_data, part_params)
                    parts_scores.append(p_score)
                    
                exam_result_updates.append({
                    "id": exam_result.id,
                    "irt_score_part1": parts_scores[0],
                    "irt_score_part2": parts_scores[1],
                    "irt_score_part3": parts_scores[2],
                    "irt_score_part4": parts_scores[3],
                    "total_score": sum(parts_scores),
                    "score_method": "IRT"
                })
            
            if exam_result_updates:
                await bulk_update(db, ExamResult, exam_result_updates)
            
            # Compute CTT and Chi-Square
            try:
                # Calculate CTT
                U_df = pd.DataFrame(U, columns=cau_names)
                # Add columns expected by cal_diff/cal_disc
                U_df['SBD'] = range(1, N + 1)
                U_df['Raw'] = U.sum(axis=1)
                U_df['Null'] = (U == -1).sum(axis=1)
                U_df['MaDe'] = 'default'
                U_df['Gioi'] = 0
                ctt_diff = cal_diff(U_df)
                ctt_disc = cal_disc(U_df)
                
                # Calculate Chi-Square
                df_for_chi2 = U_df.copy()
                df_for_chi2["Theta"] = theta_est
                chi2_df = chi_square(df_for_chi2, item_params_df)
                
                # Clear previous results for this exam
                await db.execute(delete(ItemAnalysisResult).where(ItemAnalysisResult.exam_id == exam_id))
                
                # Save into ItemAnalysisResult
                analysis_inserts = []
                for j in range(J):
                    pos = j + 1
                    qid = position_to_qid.get(pos)
                    if not qid:
                        continue
                    
                    cau_name = f"Cau{pos}"
                    
                    c_p_val = chi2_df.loc[j, "p_value"] if j < len(chi2_df) else np.nan
                    
                    analysis_inserts.append({
                        "exam_id": exam_id,
                        "question_id": qid,
                        "ctt_difficulty": float(ctt_diff[cau_name]) if not pd.isna(ctt_diff[cau_name]) else None,
                        "ctt_discrimination": float(ctt_disc[cau_name]) if not pd.isna(ctt_disc[cau_name]) else None,
                        "ctt_distractor_label": "Bình thường", # Mocking for now as full distractor calculation needs more DB queries
                        "irt_a": float(a_est[j]),
                        "irt_b": float(b_est[j]),
                        "irt_a_se": float(se_a[j]),
                        "irt_b_se": float(se_b[j]),
                        "chi_square_p": float(c_p_val) if not pd.isna(c_p_val) else None
                    })
                if analysis_inserts:
                    await bulk_insert(db, ItemAnalysisResult, analysis_inserts)
            except Exception as e:
                # Log but do not fail the whole task if just analysis generation fails
                if task:
                    task.error_details = f"Item analysis generation failed: {str(e)}"
                
            # 9. Mark success
            if task:
                task.status = "SUCCESS"
                task.completed_at = datetime.now(timezone.utc)
            
            await db.commit()
            
            return {
                "status": "SUCCESS", 
                "exam_id": exam_id, 
                "participants_scored": N
            }

    # Run the async logic synchronously in Celery
    return asyncio.run(process_irt())
