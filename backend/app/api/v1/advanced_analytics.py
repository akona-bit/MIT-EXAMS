from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from typing import Optional, List
from pydantic import BaseModel
import scipy.stats as stats
from pygam import GAM, s
import numpy as np
from typing import Dict, Any

from app.db.database import get_db
from app.models.grading import ItemAnalysisResult, ExamResult, IrtTask
from app.models.exam import ExamParticipant, ExamSubmission, ExamFormQuestion, ExamForm
from app.api.dependencies import RequireRole

router = APIRouter(dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])

@router.get("/status")
async def get_analysis_status(exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IrtTask).where(IrtTask.exam_id == exam_id).order_by(IrtTask.id.desc()))
    task = result.scalars().first()
    if not task:
        return {"status": "no_data", "message": "Kỳ thi chưa có dữ liệu phân tích. Đang chờ kết thúc kỳ thi."}
    if task.status == "PENDING" or task.status == "STARTED":
        return {"status": "computing", "message": "Hệ thống đang chạy ước lượng IRT/CTT..."}
    if task.status == "FAILED":
        return {"status": "failed", "message": task.error_details or "Không đủ dữ liệu thí sinh để ước lượng."}
    return {"status": "done", "message": "Phân tích hoàn tất"}

@router.get("/flagged-items")
async def get_flagged_items(exam_id: int, db: AsyncSession = Depends(get_db)):
    # Check status
    status = await get_analysis_status(exam_id, db)
    if status["status"] != "done":
        return status
        
    result = await db.execute(
        select(ItemAnalysisResult).where(ItemAnalysisResult.exam_id == exam_id)
    )
    items = result.scalars().all()
    
    flagged = []
    
    for idx, item in enumerate(items):
        reasons = []
        if item.chi_square_p is not None and item.chi_square_p < 0.05:
            reasons.append("Chỉ số Chi-square p-value < 0.05 (Misfit)")
        if item.irt_a_se is not None and item.irt_a_se > 3.0:
            reasons.append("Sai số chuẩn của độ phân biệt (SE_a) quá cao")
        if item.irt_b_se is not None and item.irt_b_se > 10.0:
            reasons.append("Sai số chuẩn của độ khó (SE_b) quá cao")
            
        if reasons:
            flagged.append({
                "question": getattr(item, "position", item.question_id),
                "subject": "Toán" if idx % 2 == 0 else "TDKH",
                "a": round(item.irt_a, 2) if item.irt_a else 0,
                "b": round(item.irt_b, 2) if item.irt_b else 0,
                "reasons": reasons
            })
            
    return {
        "status": "done",
        "items": flagged
    }

@router.get("/item-parameters")
async def get_item_parameters(
    exam_id: int, 
    page: int = 1, 
    limit: int = 20, 
    db: AsyncSession = Depends(get_db)
):
    status = await get_analysis_status(exam_id, db)
    if status["status"] != "done":
        return status
        
    offset = (page - 1) * limit
    
    count_query = await db.execute(select(func.count(ItemAnalysisResult.id)).where(ItemAnalysisResult.exam_id == exam_id))
    total = count_query.scalar()
    
    result = await db.execute(
        select(ItemAnalysisResult)
        .where(ItemAnalysisResult.exam_id == exam_id)
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()
    
    formatted_items = []
    for idx, item in enumerate(items):
        formatted_items.append({
            "question": getattr(item, "position", item.question_id),
            "subject": "Toán" if idx % 2 == 0 else "TDKH",
            "a": round(item.irt_a, 2) if item.irt_a else 0.0,
            "b": round(item.irt_b, 2) if item.irt_b else 0.0
        })
    
    return {
        "status": "done",
        "items": formatted_items,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.get("/distributions")
async def get_distributions(exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExamResult)
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamParticipant.exam_id == exam_id)
    )
    records = result.scalars().all()
    if not records:
        return {"status": "no_data"}
        
    # Example fields, depending on exactly what we want to plot.
    # Assuming part1 = Math, part2 = Sci for the plot
    math_raw = [r.ctt_score_part1 * 10 for r in records if r.ctt_score_part1 is not None]
    sci_raw = [r.ctt_score_part2 * 10 for r in records if r.ctt_score_part2 is not None]
    
    math_irt = [r.irt_score_part1 for r in records if r.irt_score_part1 is not None]
    sci_irt = [r.irt_score_part2 for r in records if r.irt_score_part2 is not None]
    
    # Generate KDE for total scores
    def calculate_kde(data, min_val, max_val, bandwidth=15):
        if not data or len(data) < 2: return [], []
        try:
            kde = stats.gaussian_kde(data, bw_method=bandwidth / np.std(data, ddof=1))
            x = np.linspace(min_val, max_val, 100)
            y = kde(x) * len(data) * (max_val - min_val) / 30
            return x.tolist(), y.tolist()
        except Exception:
            return [], []

    math_irt_kde_x, math_irt_kde_y = calculate_kde(math_irt, 0, 300)
    sci_irt_kde_x, sci_irt_kde_y = calculate_kde(sci_irt, 0, 300)

    return {
        "status": "done",
        "math_raw": math_raw,
        "sci_raw": sci_raw,
        "math_irt": math_irt,
        "sci_irt": sci_irt,
        "kde": {
            "math": {"x": math_irt_kde_x, "y": math_irt_kde_y},
            "sci": {"x": sci_irt_kde_x, "y": sci_irt_kde_y}
        }
    }

@router.get("/gam-curve")
async def get_gam_curve(exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExamResult)
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamParticipant.exam_id == exam_id)
    )
    records = result.scalars().all()
    if not records:
        return {"status": "no_data"}
        
    math_theta = [(r.irt_score_part1 - 150) / 50 for r in records if r.irt_score_part1 is not None]
    math_raw = [r.ctt_score_part1 * 10 for r in records if r.ctt_score_part1 is not None]
    
    sci_theta = [(r.irt_score_part2 - 150) / 50 for r in records if r.irt_score_part2 is not None]
    sci_raw = [r.ctt_score_part2 * 10 for r in records if r.ctt_score_part2 is not None]

    def fit_gam(theta, raw):
        if not theta or not raw or len(theta) < 10: return [], []
        try:
            X = np.array(theta).reshape(-1, 1)
            y = np.array(raw)
            gam = GAM(s(0, n_splines=20)).fit(X, y)
            x_grid = np.linspace(-3, 3, 100).reshape(-1, 1)
            y_pred = gam.predict(x_grid)
            return x_grid.flatten().tolist(), y_pred.flatten().tolist()
        except Exception:
            return [], []

    math_gam_x, math_gam_y = fit_gam(math_theta, math_raw)
    sci_gam_x, sci_gam_y = fit_gam(sci_theta, sci_raw)

    return {
        "status": "done",
        "scatter": {
            "math": [{"theta": t, "raw": r} for t, r in zip(math_theta, math_raw)],
            "sci": [{"theta": t, "raw": r} for t, r in zip(sci_theta, sci_raw)]
        },
        "gam": {
            "math": {"x": math_gam_x, "y": math_gam_y},
            "sci": {"x": sci_gam_x, "y": sci_gam_y}
        }
    }

@router.get("/boxplots")
async def get_boxplots(exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExamResult)
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamParticipant.exam_id == exam_id)
    )
    records = result.scalars().all()
    if not records:
        return {"status": "no_data"}
        
    math_irt = [r.irt_score_part1 for r in records if r.irt_score_part1 is not None]
    sci_irt = [r.irt_score_part2 for r in records if r.irt_score_part2 is not None]
    
    return {
        "status": "done",
        "math_irt": math_irt,
        "sci_irt": sci_irt
    }

@router.get("/descriptive-stats")
async def get_descriptive_stats(exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExamResult)
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamParticipant.exam_id == exam_id)
    )
    records = result.scalars().all()
    if not records:
        return {"status": "no_data"}
        
    math_raw = [r.ctt_score_part1 * 10 for r in records if r.ctt_score_part1 is not None]
    sci_raw = [r.ctt_score_part2 * 10 for r in records if r.ctt_score_part2 is not None]
    math_irt = [r.irt_score_part1 for r in records if r.irt_score_part1 is not None]
    sci_irt = [r.irt_score_part2 for r in records if r.irt_score_part2 is not None]
    
    def calc_stats(arr):
        if not arr: return {"mean": 0, "median": 0, "sd": 0, "min": 0, "max": 0}
        return {
            "mean": round(np.mean(arr), 2),
            "median": round(np.median(arr), 2),
            "sd": round(np.std(arr, ddof=1) if len(arr) > 1 else 0, 2),
            "min": round(np.min(arr), 2),
            "max": round(np.max(arr), 2)
        }
        
    return {
        "status": "done",
        "total_students": len(records),
        "math_raw": calc_stats(math_raw),
        "sci_raw": calc_stats(sci_raw),
        "math_irt": calc_stats(math_irt),
        "sci_irt": calc_stats(sci_irt)
    }

@router.get("/penalty-vs-irt")
async def get_penalty_vs_irt(exam_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExamResult)
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .where(ExamParticipant.exam_id == exam_id)
    )
    records = result.scalars().all()
    if not records:
        return {"status": "no_data"}
        
    math_data = []
    sci_data = []
    
    for r in records:
        penalty_math = max(0, 150 - (r.ctt_score_part1 * 10 if r.ctt_score_part1 else 0)) / 10.0
        penalty_sci = max(0, 150 - (r.ctt_score_part2 * 10 if r.ctt_score_part2 else 0)) / 10.0
        
        if r.irt_score_part1 is not None:
            math_data.append({"penalty": round(penalty_math, 2), "irt": round(r.irt_score_part1, 2)})
        if r.irt_score_part2 is not None:
            sci_data.append({"penalty": round(penalty_sci, 2), "irt": round(r.irt_score_part2, 2)})
            
    return {
        "status": "done",
        "math": math_data,
        "sci": sci_data
    }

@router.get("/leaderboard")
async def get_leaderboard(exam_id: int, db: AsyncSession = Depends(get_db)):
    from app.models.user import User
    result = await db.execute(
        select(ExamResult, User)
        .join(ExamSubmission, ExamSubmission.id == ExamResult.exam_submission_id)
        .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
        .join(User, User.id == ExamParticipant.user_id)
        .where(ExamParticipant.exam_id == exam_id)
    )
    records = result.all()
    if not records:
        return {"status": "no_data"}
        
    students = []
    for r, u in records:
        math_irt = r.irt_score_part1 or 0
        sci_irt = r.irt_score_part2 or 0
        total_irt = r.total_score or (math_irt + sci_irt)
        students.append({
            "name": u.full_name or u.username,
            "math_irt": round(math_irt, 2),
            "sci_irt": round(sci_irt, 2),
            "total_irt": round(total_irt, 2)
        })
        
    students.sort(key=lambda x: x["total_irt"], reverse=True)
    top_students = students[:10]
    
    for i, s in enumerate(top_students):
        s["rank"] = i + 1
        
    return {
        "status": "done",
        "top_students": top_students
    }
