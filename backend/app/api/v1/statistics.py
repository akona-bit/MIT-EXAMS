from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Any

from app.db.database import get_db
from app.api.dependencies import RequireRole
from app.models.grading import ExamResult
from app.models.exam import ExamSubmission, Exam, ExamForm, ExamFormQuestion
from app.models.question import Question

router = APIRouter()

@router.get("/exams/{exam_id}/overview", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def get_exam_overview(exam_id: int, db: AsyncSession = Depends(get_db)):
    # Lấy tổng số lượng nộp bài
    result = await db.execute(select(ExamSubmission).where(ExamSubmission.exam_id == exam_id))
    submissions = result.scalars().all()
    
    if not submissions:
        return {
            "total_participants": 0,
            "average_score": 0,
            "max_score": 0,
            "min_score": 0,
            "distribution": []
        }
        
    submission_ids = [s.id for s in submissions]
    
    # Tính điểm
    # Lưu ý: CTT có 4 phần, nếu thi trắc nghiệm ĐGNL tối đa 120 câu, ta có thể dùng sum ctt_score
    r_res = await db.execute(select(ExamResult).where(ExamResult.exam_submission_id.in_(submission_ids)))
    exam_results = r_res.scalars().all()
    
    total_scores = []
    for r in exam_results:
        # Nếu chưa có IRT score, tính tạm raw ctt score
        if r.total_score is not None:
            total_scores.append(r.total_score)
        else:
            total_scores.append(r.ctt_score_part1 + r.ctt_score_part2 + r.ctt_score_part3 + r.ctt_score_part4)
            
    if not total_scores:
        return {"total_participants": len(submissions), "message": "No grading results found"}
        
    avg_score = sum(total_scores) / len(total_scores)
    
    # Tính phổ điểm (distribution)
    # Ví dụ chia 10 bucket: 0-12, 12-24, ... (nếu 120 điểm), hoặc 0-120, 120-240 (nếu 1200 điểm)
    # Ở đây giả định max 120 điểm cho đơn giản
    buckets = {f"{i*12}-{(i+1)*12}": 0 for i in range(10)}
    for score in total_scores:
        idx = int(score // 12)
        if idx >= 10:
            idx = 9
        buckets[f"{idx*12}-{(idx+1)*12}"] += 1
        
    distribution = [{"range": k, "count": v} for k, v in buckets.items()]
    
    return {
        "total_participants": len(total_scores),
        "average_score": round(avg_score, 2),
        "max_score": round(max(total_scores), 2),
        "min_score": round(min(total_scores), 2),
        "distribution": distribution
    }

@router.get("/exams/{exam_id}/items", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def get_exam_item_analysis(exam_id: int, db: AsyncSession = Depends(get_db)):
    # Tìm các mã đề của kỳ thi
    f_res = await db.execute(select(ExamForm).where(ExamForm.exam_id == exam_id))
    forms = f_res.scalars().all()
    form_ids = [f.id for f in forms]
    
    if not form_ids:
        return []
        
    # Tìm các câu hỏi trong đề
    q_res = await db.execute(
        select(Question).join(ExamFormQuestion, ExamFormQuestion.question_id == Question.id)
        .where(ExamFormQuestion.exam_form_id.in_(form_ids))
        .distinct()
    )
    questions = q_res.scalars().all()
    
    analysis = []
    for q in questions:
        flags = []
        if q.a_param < 0.3:
            flags.append("POOR_DISCRIMINATION")
        if q.b_param > 3.0:
            flags.append("TOO_HARD")
        elif q.b_param < -3.0:
            flags.append("TOO_EASY")
            
        analysis.append({
            "question_id": q.id,
            "content": q.content[:50] + "...",
            "difficulty_b": round(q.b_param, 2),
            "discrimination_a": round(q.a_param, 2),
            "guessing_c": round(q.c_param, 2),
            "is_calibrated": q.is_calibrated,
            "warning_flags": flags
        })
        
    return analysis
