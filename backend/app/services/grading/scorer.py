from typing import Any, Optional
import asyncio
import gc
import logging

logger = logging.getLogger(__name__)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exam import ExamForm, ExamFormQuestion, ExamSubmission, ExamParticipant, ExamSubmissionAnswer
from app.models.grading import ExamResult, IrtTask, ItemAnalysisResult
from app.models.question import Answer, Question, QuestionType

import numpy as np
import pandas as pd
from sqlalchemy import delete
from app.db.bulk import bulk_insert, bulk_update
from app.services.grading.irt_engine import mmle, theta_estimate_eap, true_score, all_item_se, chi_square
from app.services.grading.ctt_engine import cal_diff, cal_disc
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

    item_scores: dict[str, float] = {}
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

        item_scores[str(form_question.question_id)] = score
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

    exam_result.ctt_score_part1 = part_scores[1] * 10
    exam_result.ctt_score_part2 = part_scores[2] * 10
    exam_result.ctt_score_part3 = part_scores[3] * 10
    exam_result.ctt_score_part4 = part_scores[4] * 10
    exam_result.raw_total_score = sum(part_scores.values()) * 10
    exam_result.item_scores = item_scores
    exam_result.item_subitem_scores = item_subitem_scores
    exam_result.item_types = item_types
    exam_result.item_points = item_points
    exam_result.correct_answers = correct_answers
    exam_result.selected_answers = selected_answers
    exam_result.total_points = sum(item_points.values()) * 10 if item_points else None
    exam_result.score_method = "CTT"

    await db.commit()
    await db.refresh(exam_result)

    # Hook: cập nhật hồ sơ tiến độ học sinh (activity + knowledge mastery)
    try:
        from app.services.grading.profile_hook import update_student_profile_after_grading
        await update_student_profile_after_grading(db, submission_id)
    except Exception as e:
        # Log nhưng không fail toàn bộ quá trình chấm điểm
        import logging
        logging.getLogger(__name__).warning(f"Profile hook failed for submission {submission_id}: {e}")

    return exam_result


async def background_run_irt(exam_id: int, task_id: str) -> dict[str, Any]:
    from contextlib import asynccontextmanager
    
    @asynccontextmanager
    async def isolated_session():
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from sqlalchemy.pool import NullPool
        from app.core.config import settings
        
        local_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
        local_session_maker = async_sessionmaker(local_engine, expire_on_commit=False)
        try:
            async with local_session_maker() as db:
                yield db
        finally:
            await local_engine.dispose()

    async def process_irt() -> dict[str, Any]:
        async with isolated_session() as db:
            # 1. Mark as started
            result = await db.execute(
                select(IrtTask).where(IrtTask.celery_task_id == task_id)
            )
            task = result.scalars().first()
            
            # Buffer log giữ trong biến local (KHÔNG mutate task.logs in-place —
            # bẫy JSON SQLAlchemy: old-value == new-value do cùng tham chiếu list
            # khiến ORM bỏ qua UPDATE). Persist bằng direct UPDATE từng lần ghi.
            log_buffer: list[dict] = []

            async def append_log(msg: str):
                if not task:
                    return
                log_buffer.append({
                    "time": datetime.now(timezone.utc).isoformat(),
                    "msg": msg,
                })
                from sqlalchemy import update as sa_update
                await db.execute(
                    sa_update(IrtTask)
                    .where(IrtTask.id == task.id)
                    .values(logs=list(log_buffer))
                )
                await db.commit()
            
            if task:
                task.status = "STARTED"
                await db.commit()
                await append_log("Bắt đầu tiến trình phân tích IRT...")
            
            # 2. Get ALL unique question_ids used in this exam's forms
            form_q_result = await db.execute(
                select(ExamFormQuestion.question_id, ExamFormQuestion.part)
                .join(ExamForm, ExamForm.id == ExamFormQuestion.exam_form_id)
                .where(ExamForm.exam_id == exam_id)
            )
            all_fqs = form_q_result.all()
            unique_qids = sorted(list(set(row.question_id for row in all_fqs)))
            if not unique_qids:
                if task:
                    task.status = "FAILED"
                    await append_log("Lỗi: Không tìm thấy câu hỏi nào trong đề thi này!")
                    await db.commit()
                return {"status": "FAILED", "reason": "No questions found in this exam"}
                
            await append_log(f"Đã tải {len(unique_qids)} câu hỏi duy nhất từ ma trận đề thi.")
                
            qid_to_index = {qid: i for i, qid in enumerate(unique_qids)}
            J = len(unique_qids)
            
            # Map question_id to part for part-score calculation later
            qid_to_part = {row.question_id: row.part for row in all_fqs}

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
                    await append_log("Không có bài làm nào để chấm.")
                    await db.commit()
                return {"status": "SUCCESS", "message": "No submissions found"}
                
            N = len(records)
            if N < 200:
                if task:
                    task.status = "FAILED"
                    await append_log(f"Lỗi: Số lượng bài làm (N={N}) chưa đạt ngưỡng tối thiểu (N≥200) để ước lượng tham số IRT. Vui lòng sử dụng kết quả CTT.")
                    await db.commit()
                return {"status": "FAILED", "reason": f"Insufficient records: {N} < 200"}

            await append_log(f"Tìm thấy {N} bài làm. Đang trích xuất ma trận phản hồi (Response Matrix)...")
            
            # 4. Build full response matrix U (N x J) + group questions by part
            U = np.full((N, J), -1, dtype=int)
            for i, (exam_result, submission) in enumerate(records):
                item_scores = exam_result.item_scores or {}
                for qid_str, score in item_scores.items():
                    try:
                        qid = int(qid_str)
                        if qid in qid_to_index:
                            idx = qid_to_index[qid]
                            U[i, idx] = 1 if score > 0 else 0
                    except ValueError:
                        pass
            
            # Group question indices by part (1-4)
            part_groups: dict[int, list[int]] = {1: [], 2: [], 3: [], 4: []}
            for j, qid in enumerate(unique_qids):
                p = qid_to_part.get(qid)
                if p in part_groups:
                    part_groups[p].append(j)
            
            active_parts = [p for p in [1, 2, 3, 4] if part_groups[p]]
            await append_log(f"Phát hiện {len(active_parts)} phần thi: {', '.join(f'P{p}({len(part_groups[p])}câu)' for p in active_parts)}")

            # Load anchor items from DB (once, shared across parts)
            anchor_result = await db.execute(
                select(Question.id, Question.a_param, Question.b_param)
                .where(Question.id.in_(unique_qids), Question.is_anchor == True)
            )
            anchor_rows = anchor_result.all()
            anchor_map = {}
            if anchor_rows:
                for qid, a_val, b_val in anchor_rows:
                    anchor_map[qid] = (a_val or 1.0, b_val or 0.0)
                await append_log(f"Đã tìm thấy {len(anchor_rows)} câu neo (anchor items) — tham số sẽ được giữ cố định.")
            
            # 5-8. Run MMLE + Theta + TrueScore PER PART
            all_a_est = np.zeros(J, dtype=float)
            all_b_est = np.zeros(J, dtype=float)
            all_se_a = np.full(J, np.inf, dtype=float)
            all_se_b = np.full(J, np.inf, dtype=float)
            part_theta: dict[int, np.ndarray] = {}  # per-part theta for chi-square
            
            for part_num in active_parts:
                part_indices = part_groups[part_num]
                J_part = len(part_indices)
                part_qids = [unique_qids[j] for j in part_indices]
                
                # Skip parts with too few items for stable MMLE (< 5 items)
                if J_part < 5:
                    await append_log(f"--- Phần {part_num}: bỏ qua ({J_part} câu < 5 câu tối thiểu) ---")
                    continue
                
                await append_log(f"--- Phần {part_num}: {J_part} câu hỏi ---")
                
                # Build U_part (N x J_part)
                U_part = U[:, part_indices]
                
                # 5. Run MMLE per-part
                gc.collect()
                try:
                    # Anchor mask for this part
                    p_anchor_mask = np.zeros(J_part, dtype=bool)
                    p_anchor_a = np.zeros(J_part, dtype=float)
                    p_anchor_b = np.zeros(J_part, dtype=float)
                    has_anchors = False
                    for local_j, global_j in enumerate(part_indices):
                        qid = unique_qids[global_j]
                        if qid in anchor_map:
                            p_anchor_mask[local_j] = True
                            p_anchor_a[local_j] = anchor_map[qid][0]
                            p_anchor_b[local_j] = anchor_map[qid][1]
                            has_anchors = True
                    
                    a_part, b_part = await asyncio.to_thread(
                        mmle, U_part, name=f"IRT_Exam_{exam_id}_P{part_num}",
                        max_iter=20, K=21, verbose=False,
                        anchor_mask=p_anchor_mask if has_anchors else None,
                        anchor_a=p_anchor_a if has_anchors else None,
                        anchor_b=p_anchor_b if has_anchors else None,
                    )
                    
                    # Store results back to global arrays
                    for local_j, global_j in enumerate(part_indices):
                        all_a_est[global_j] = a_part[local_j]
                        all_b_est[global_j] = b_part[local_j]
                    
                    # Item SE per-part
                    item_params_part = [(float(a_part[k]), float(b_part[k])) for k in range(J_part)]
                    se_matrix_part = await asyncio.to_thread(all_item_se, item_params_part)
                    se_matrix_part = np.asarray(se_matrix_part)
                    if se_matrix_part.ndim == 2 and se_matrix_part.shape[1] >= 2:
                        for local_j, global_j in enumerate(part_indices):
                            all_se_a[global_j] = se_matrix_part[local_j, 0]
                            all_se_b[global_j] = se_matrix_part[local_j, 1]
                    
                    await append_log(f"  MMLE P{part_num} thành công: a=[{a_part.min():.2f},{a_part.max():.2f}], b=[{b_part.min():.2f},{b_part.max():.2f}]")
                except Exception as e:
                    await append_log(f"  MMLE P{part_num} lỗi: {e} — bỏ qua phần này")
                    gc.collect()
                    continue
                
                # 6. Update Question parameters for this part
                question_updates_part = []
                for local_j, global_j in enumerate(part_indices):
                    qid = unique_qids[global_j]
                    question_updates_part.append({
                        "id": qid,
                        "a_param": float(a_part[local_j]),
                        "b_param": float(b_part[local_j]),
                        "is_calibrated": True
                    })
                if question_updates_part:
                    await bulk_update(db, Question, question_updates_part)
                
                # 7. Estimate Theta per-part (EAP)
                U_part_float = U_part.astype(float)
                U_part_float[U_part_float == -1] = 0
                item_params_part_list = [(float(a_part[k]), float(b_part[k])) for k in range(J_part)]
                
                try:
                    theta_part = await asyncio.to_thread(
                        theta_estimate_eap, U_part_float, item_params_part_list, 41
                    )
                    theta_part = np.array(theta_part)
                except Exception as e:
                    await append_log(f"  Theta P{part_num} lỗi: {e} — dùng theta=0")
                    theta_part = np.zeros(N)
                
                part_theta[part_num] = theta_part  # store for chi-square
                
                # 8. Compute true_score per-part per-student
                cau_names_part = [f"Q_{unique_qids[gj]}" for gj in part_indices]
                item_params_df_part = pd.DataFrame(
                    [(float(a_part[k]), float(b_part[k])) for k in range(J_part)],
                    columns=["a", "b"], index=cau_names_part
                )
                
                for i in range(N):
                    student_part_data = pd.Series(U_part_float[i], index=cau_names_part)
                    part_raw = int(student_part_data.sum())
                    p_score = true_score(float(theta_part[i]), part_raw, student_part_data, item_params_df_part)
                    setattr(records[i][0], f"irt_score_part{part_num}", p_score)
                
                del U_part_float, item_params_df_part, cau_names_part
                gc.collect()
                await append_log(f"  True Score P{part_num} tính xong cho {N} thí sinh.")
            
            # Finalize: total_score + score_method
            exam_result_updates = []
            for exam_result, submission in records:
                s1 = getattr(exam_result, 'irt_score_part1', 0) or 0
                s2 = getattr(exam_result, 'irt_score_part2', 0) or 0
                s3 = getattr(exam_result, 'irt_score_part3', 0) or 0
                s4 = getattr(exam_result, 'irt_score_part4', 0) or 0
                exam_result_updates.append({
                    "id": exam_result.id,
                    "irt_score_part1": s1,
                    "irt_score_part2": s2,
                    "irt_score_part3": s3,
                    "irt_score_part4": s4,
                    "total_score": s1 + s2 + s3 + s4,
                    "score_method": "IRT"
                })
            
            if exam_result_updates:
                await bulk_update(db, ExamResult, exam_result_updates)
                await append_log(f"Đã cập nhật điểm chuẩn (True Score) cho {N} bài làm.")
            
            # Keep U for CTT — delete after
            gc.collect()
            
            # Compute CTT and Chi-Square (per-part)
            await append_log("Đang phân tích chất lượng câu hỏi (CTT & Chi-Square Fit)...")
            try:
                # Clear previous results for this exam
                await db.execute(delete(ItemAnalysisResult).where(ItemAnalysisResult.exam_id == exam_id))
                
                analysis_inserts = []
                for part_num in active_parts:
                    part_indices = part_groups[part_num]
                    part_qids = [unique_qids[j] for j in part_indices]
                    cau_names_part = [f"Q_{qid}" for qid in part_qids]
                    
                    U_part = U[:, part_indices]
                    U_df = pd.DataFrame(U_part, columns=cau_names_part)
                    U_df['SBD'] = range(1, N + 1)
                    U_df['Raw'] = U_part.sum(axis=1)
                    U_df['Null'] = (U_part == -1).sum(axis=1)
                    U_df['MaDe'] = 'default'
                    U_df['Gioi'] = 0
                    
                    diff = cal_diff(U_df)
                    disc = cal_disc(U_df)
                    
                    # Chi-square per-part
                    item_params_part_df = pd.DataFrame(
                        [(float(all_a_est[j]), float(all_b_est[j])) for j in part_indices],
                        columns=["a", "b"], index=cau_names_part
                    )
                    df_for_chi2 = U_df.copy()
                    # Use theta from this part's own IRT model
                    df_for_chi2["Theta"] = part_theta.get(part_num, np.zeros(N))
                    chi2 = chi_square(df_for_chi2, item_params_part_df)
                    
                    for local_j, global_j in enumerate(part_indices):
                        qid = unique_qids[global_j]
                        cau_name = cau_names_part[local_j]
                        c_p_val = chi2.loc[cau_name, "p_value"] if cau_name in chi2.index else np.nan
                        
                        analysis_inserts.append({
                            "exam_id": exam_id,
                            "question_id": qid,
                            "ctt_difficulty": float(diff[cau_name]) if cau_name in diff and not pd.isna(diff[cau_name]) else None,
                            "ctt_discrimination": float(disc[cau_name]) if cau_name in disc and not pd.isna(disc[cau_name]) else None,
                            "ctt_distractor_label": "Bình thường",
                            "irt_a": float(all_a_est[global_j]),
                            "irt_b": float(all_b_est[global_j]),
                            "irt_a_se": float(all_se_a[global_j]),
                            "irt_b_se": float(all_se_b[global_j]),
                            "chi_square_p": float(c_p_val) if not pd.isna(c_p_val) else None
                        })
                
                if analysis_inserts:
                    await bulk_insert(db, ItemAnalysisResult, analysis_inserts)
                    await append_log(f"Đã lưu {len(analysis_inserts)} kết quả phân tích (Item Analysis) vào lưu trữ.")
            except Exception as e:
                if task:
                    task.error_details = f"Item analysis generation failed: {str(e)}"
            
            del U
            gc.collect()
                
            # 9. Mark success
            await append_log("Hoàn tất quá trình IRT!")
            if task:
                task.status = "SUCCESS"
                task.completed_at = datetime.now(timezone.utc)
            
            await db.commit()
            
            return {
                "participants_scored": N
            }
            
    # Run the native async function
    try:
        return await process_irt()
    except Exception as e:
        # Background task crashed ngoài các nhánh try/except bên trong —
        # phải đánh dấu FAILED để client không poll vô hạn.
        logger.exception(f"Unhandled IRT background error for task {task_id}: {e}")
        try:
            from app.core.error_log import log_error
            log_error(f"IRT background task {task_id} crashed: {e}")
        except Exception:
            pass
        try:
            async with isolated_session() as db:
                result = await db.execute(
                    select(IrtTask).where(IrtTask.celery_task_id == task_id)
                )
                failed_task = result.scalars().first()
                if failed_task and failed_task.status not in ("SUCCESS", "FAILED"):
                    failed_task.status = "FAILED"
                    failed_task.error_details = f"Unhandled background error: {str(e)}"
                    failed_task.logs = list(failed_task.logs or []) + [
                        {
                            "time": datetime.now(timezone.utc).isoformat(),
                            "msg": f"Lỗi không mong muốn: {str(e)}",
                        }
                    ]
                    await db.commit()
        except Exception:
            logger.exception(f"Could not mark IrtTask {task_id} as FAILED")
        raise


from celery import shared_task

@shared_task(bind=True)
def run_irt_task(self, exam_id: int, task_id: str):
    """
    Celery task — thay cho FastAPI BackgroundTasks.
    Chạy trong Celery worker process riêng, không tranh CPU với web server.
    """
    asyncio.run(background_run_irt(exam_id, task_id))
    return {"status": "SUCCESS", "exam_id": exam_id}

