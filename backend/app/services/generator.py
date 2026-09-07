import random
from typing import List, Tuple, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.exam import Matrix, MatrixRule, Exam, ExamForm, ExamFormQuestion, ExamFormAnswer
from app.models.question import Question, Answer
from app.services.exam_matrix_generator import (
    load_pool_from_db,
    parse_matrix_rules,
    generate_exam,
    generate_multiple_versions,
    build_form_layout,
    GenerationReport
)

async def _save_form_from_report(
    db: AsyncSession, 
    exam_id: int, 
    code: str, 
    is_original: bool, 
    report: GenerationReport,
    questions_cache: Dict[int, Question]
) -> ExamForm:
    
    new_form = ExamForm(
        exam_id=exam_id,
        code=code,
        is_original=is_original
    )
    db.add(new_form)
    await db.flush()
    
    # Dùng build_form_layout để lấy danh sách (question_id, part, rule_id) đã được sắp xếp & xáo khối
    layout = build_form_layout(report.cell_results)
    
    for pos, (qid, part, rule_id) in enumerate(layout, start=1):
        q = questions_cache.get(qid)
        if not q:
            continue
            
        form_q = ExamFormQuestion(
            exam_form_id=new_form.id,
            question_id=qid,
            position=pos,
            part=part
        )
        db.add(form_q)
        await db.flush()
        
        # Shuffle answers
        orig_answers = list(q.answers)
        random.shuffle(orig_answers)
        for k, oa in enumerate(orig_answers):
            form_a = ExamFormAnswer(
                exam_form_question_id=form_q.id,
                answer_id=oa.id,
                new_position=k + 1
            )
            db.add(form_a)
            
    return new_form

async def generate_original_exam(db: AsyncSession, matrix: Matrix, exam_name: str, exam_description: str) -> Exam:
    # 1. Khởi tạo Exam
    exam = Exam(
        name=exam_name,
        description=exam_description,
        matrix_id=matrix.id
    )
    db.add(exam)
    await db.flush()
    
    # 2. Parse rules sang cấu trúc của Engine mới
    rules = sorted(matrix.rules, key=lambda r: (getattr(r, "part", 1) or 1, getattr(r, "position", 0) or 0))
    cells = await parse_matrix_rules(db, rules)
    
    # 3. Lấy pool câu hỏi thoả mãn
    pool = await load_pool_from_db(db, rules)
    
    # 4. Chạy Engine sinh đề
    report = generate_exam(cells, pool)
    
    if not report.ok:
        error_msg = "\n".join(report.warnings)
        raise HTTPException(status_code=400, detail=f"Không đủ câu hỏi thoả mãn cấu trúc ma trận:\n{error_msg}")
        
    # 5. Lấy danh sách câu hỏi chi tiết kèm answers để lưu database
    stmt = select(Question).options(selectinload(Question.answers)).where(Question.id.in_(report.selected_ids))
    result = await db.execute(stmt)
    questions_cache = {q.id: q for q in result.scalars().all()}
    
    # 6. Lưu đề gốc
    await _save_form_from_report(db, exam.id, "ORIGINAL", True, report, questions_cache)
    
    await db.commit()
    return exam

async def generate_shuffled_forms(db: AsyncSession, original_form: ExamForm, number_of_forms: int):
    # Lấy thông tin matrix_id từ exam
    stmt_exam = select(Exam).where(Exam.id == original_form.exam_id)
    exam_result = await db.execute(stmt_exam)
    exam = exam_result.scalar_one()
    
    stmt_matrix = select(Matrix).options(selectinload(Matrix.rules)).where(Matrix.id == exam.matrix_id)
    matrix_result = await db.execute(stmt_matrix)
    matrix = matrix_result.scalar_one()
    
    # Parse rules
    rules = sorted(matrix.rules, key=lambda r: (getattr(r, "part", 1) or 1, getattr(r, "position", 0) or 0))
    cells = await parse_matrix_rules(db, rules)
    
    # Thay vì tự xáo ngẫu nhiên, ta gọi Engine để sinh lại report với cùng pool câu hỏi của đề gốc
    # Đề gốc đã dùng những câu nào?
    stmt_q = select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == original_form.id)
    orig_q_result = await db.execute(stmt_q)
    orig_qids = [q.question_id for q in orig_q_result.scalars().all()]
    
    # Mock một pool chỉ chứa những câu hỏi đã được chọn ở đề gốc (để đảm bảo cùng dữ liệu)
    pool = await load_pool_from_db(db, rules)
    mock_pool = [q for q in pool if q.id in orig_qids]
    
    # Tải chi tiết câu hỏi (kèm answers)
    stmt_questions = select(Question).options(selectinload(Question.answers)).where(Question.id.in_(orig_qids))
    questions_result = await db.execute(stmt_questions)
    questions_cache = {q.id: q for q in questions_result.scalars().all()}
    
    # Sinh các đề trộn (vì dùng cùng 1 pool vừa đúng số lượng -> generate_multiple_versions sẽ tạo ra các report cùng câu hỏi)
    # Nhưng build_form_layout() sẽ thực hiện xáo trộn khối (block shuffling) cho mỗi report!
    reports = generate_multiple_versions(cells, mock_pool, n_versions=number_of_forms, distinct_questions=False)
    
    # Lấy code lớn nhất hiện tại
    stmt_max_code = select(ExamForm.code).where(ExamForm.exam_id == original_form.exam_id).order_by(ExamForm.id.desc())
    res_code = await db.execute(stmt_max_code)
    existing_codes = [c for c in res_code.scalars().all() if c != "ORIGINAL" and c.isdigit()]
    start_code = int(max(existing_codes)) + 1 if existing_codes else 101
    
    for i, report in enumerate(reports):
        if not report.ok:
            raise HTTPException(status_code=400, detail="Lỗi trong quá trình sinh mã đề xáo trộn")
            
        new_code = str(start_code + i)
        await _save_form_from_report(db, original_form.exam_id, new_code, False, report, questions_cache)
        
    await db.commit()
