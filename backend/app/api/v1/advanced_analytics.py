from fastapi import APIRouter
import pandas as pd
import numpy as np
import os
import json
import scipy.stats as stats
from pygam import GAM, s
from app.api.v1.analytics import read_raw_students, read_responses

router = APIRouter()
DATA_DIR = r"d:\MIT\data"

# Cache for item parameters
_item_params_cache = None

def get_cached_item_params():
    global _item_params_cache
    if _item_params_cache is not None:
        return _item_params_cache

    # Because MMLE takes time and we don't want to block the API,
    # and we know the parameters were already saved in the markdown report,
    # we can parse them from the markdown report or run a fast mock if missing.
    # Here we will parse the markdown report to guarantee consistency with the static plots!
    report_path = r"d:\MIT\.obsidian\knowledge\bao-cao-phan-tich-703-thi-sinh.md"
    params = []
    
    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as f:
            for line in f:
                if "Độ phân biệt (a) =" in line and "Độ khó (b) =" in line:
                    # Example: - **Câu 1 (Toán)**: Độ phân biệt (a) = 2.26, Độ khó (b) = -1.89
                    try:
                        parts = line.split(":")
                        q_name = parts[0].replace("- **", "").replace("**", "").strip()
                        stats_part = parts[1]
                        a_str = stats_part.split(",")[0].split("=")[1].strip()
                        b_str = stats_part.split(",")[1].split("=")[1].strip()
                        
                        subject = "Toán" if "Toán" in q_name else "TDKH"
                        q_num = int(q_name.split("(")[0].replace("Câu", "").strip())
                        
                        params.append({
                            "question": q_num,
                            "subject": subject,
                            "a": float(a_str),
                            "b": float(b_str)
                        })
                    except:
                        pass

    _item_params_cache = params
    return params

@router.get("/distributions")
async def get_distributions():
    students = read_raw_students()
    
    math_raw = [s["tho_toan"] * 10 for s in students if s["tho_toan"] is not None]
    sci_raw = [s["tho_tdkh"] * 10 for s in students if s["tho_tdkh"] is not None]
    
    math_irt = [s["irt_toan"] for s in students if s["irt_toan"] is not None]
    sci_irt = [s["irt_tdkh"] for s in students if s["irt_tdkh"] is not None]
    
    # Generate KDE for total scores
    def calculate_kde(data, min_val, max_val, bandwidth=15):
        if not data: return [], []
        kde = stats.gaussian_kde(data, bw_method=bandwidth / np.std(data, ddof=1))
        x = np.linspace(min_val, max_val, 100)
        y = kde(x) * len(data) * (max_val - min_val) / 30  # Scale to match histogram bins
        return x.tolist(), y.tolist()

    math_irt_kde_x, math_irt_kde_y = calculate_kde(math_irt, 0, 300)
    sci_irt_kde_x, sci_irt_kde_y = calculate_kde(sci_irt, 0, 300)

    return {
        "math_raw": math_raw,
        "sci_raw": sci_raw,
        "math_irt": math_irt,
        "sci_irt": sci_irt,
        "kde": {
            "math": {"x": math_irt_kde_x, "y": math_irt_kde_y},
            "sci": {"x": sci_irt_kde_x, "y": sci_irt_kde_y}
        }
    }

@router.get("/item-parameters")
async def get_item_parameters():
    params = get_cached_item_params()
    return {"items": params}

@router.get("/gam-curve")
async def get_gam_curve():
    students = read_raw_students()
    
    math_theta = [(s["irt_toan"] - 150) / 50 for s in students if s["irt_toan"] is not None] # Approximate Theta from IRT score
    math_raw = [s["tho_toan"] * 10 for s in students if s["tho_toan"] is not None]
    
    sci_theta = [(s["irt_tdkh"] - 150) / 50 for s in students if s["irt_tdkh"] is not None]
    sci_raw = [s["tho_tdkh"] * 10 for s in students if s["tho_tdkh"] is not None]

    def fit_gam(theta, raw):
        if not theta or not raw: return [], []
        X = np.array(theta).reshape(-1, 1)
        y = np.array(raw)
        gam = GAM(s(0, n_splines=20)).fit(X, y)
        x_grid = np.linspace(-3, 3, 100).reshape(-1, 1)
        y_pred = gam.predict(x_grid)
        return x_grid.flatten().tolist(), y_pred.flatten().tolist()

    math_gam_x, math_gam_y = fit_gam(math_theta, math_raw)
    sci_gam_x, sci_gam_y = fit_gam(sci_theta, sci_raw)

    return {
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
async def get_boxplots():
    students = read_raw_students()
    math_irt = [s["irt_toan"] for s in students if s["irt_toan"] is not None]
    sci_irt = [s["irt_tdkh"] for s in students if s["irt_tdkh"] is not None]
    math_raw = [s["tho_toan"] * 10 for s in students if s["tho_toan"] is not None]
    sci_raw = [s["tho_tdkh"] * 10 for s in students if s["tho_tdkh"] is not None]

    return {
        "math_irt": math_irt,
        "sci_irt": sci_irt,
        "math_raw": math_raw,
        "sci_raw": sci_raw
    }

@router.get("/penalty-vs-irt")
async def get_penalty_vs_irt():
    students = read_raw_students()
    
    math_scatter = [{"penalty": s["phat_toan"], "irt": s["irt_toan"]} for s in students if s["phat_toan"] is not None and s["irt_toan"] is not None]
    sci_scatter = [{"penalty": s["phat_tdkh"], "irt": s["irt_tdkh"]} for s in students if s["phat_tdkh"] is not None and s["irt_tdkh"] is not None]
    
    return {
        "math": math_scatter,
        "sci": sci_scatter
    }

@router.get("/leaderboard")
async def get_leaderboard():
    students = read_raw_students()
    valid_students = [s for s in students if s["irt_toan"] is not None and s["irt_tdkh"] is not None]
    
    # Sort by total IRT score
    sorted_students = sorted(valid_students, key=lambda x: x["irt_toan"] + x["irt_tdkh"], reverse=True)
    
    # Take top 10
    top_10 = []
    for i, s in enumerate(sorted_students[:10]):
        top_10.append({
            "rank": i + 1,
            "name": s["name"],
            "math_irt": round(s["irt_toan"], 2),
            "sci_irt": round(s["irt_tdkh"], 2),
            "total_irt": round(s["irt_toan"] + s["irt_tdkh"], 2)
        })
        
    return {"top_students": top_10}

@router.get("/descriptive-stats")
async def get_descriptive_stats():
    students = read_raw_students()
    
    math_raw = [s["tho_toan"] * 10 for s in students if s["tho_toan"] is not None]
    sci_raw = [s["tho_tdkh"] * 10 for s in students if s["tho_tdkh"] is not None]
    math_irt = [s["irt_toan"] for s in students if s["irt_toan"] is not None]
    sci_irt = [s["irt_tdkh"] for s in students if s["irt_tdkh"] is not None]
    
    def calc_stats(data):
        if not data:
            return {"mean": 0, "median": 0, "min": 0, "max": 0, "sd": 0}
        return {
            "mean": round(float(np.mean(data)), 2),
            "median": round(float(np.median(data)), 2),
            "min": round(float(np.min(data)), 2),
            "max": round(float(np.max(data)), 2),
            "sd": round(float(np.std(data, ddof=1)), 2)
        }
        
    return {
        "total_students": len(students),
        "math_raw": calc_stats(math_raw),
        "sci_raw": calc_stats(sci_raw),
        "math_irt": calc_stats(math_irt),
        "sci_irt": calc_stats(sci_irt)
    }

@router.get("/flagged-items")
async def get_flagged_items():
    params = get_cached_item_params()
    flagged = []
    
    for p in params:
        reasons = []
        if p["a"] < 0.5:
            reasons.append("Phân biệt thấp (a < 0.5)")
        if p["b"] < -3:
            reasons.append("Quá dễ (b < -3)")
        if p["b"] > 3:
            reasons.append("Quá khó (b > 3)")
            
        if reasons:
            flagged.append({
                "question": p["question"],
                "subject": p["subject"],
                "a": p["a"],
                "b": p["b"],
                "reasons": reasons
            })
            
    flagged.sort(key=lambda x: x["a"])
    
    return {"items": flagged}

@router.get("/fraud")
async def get_fraud_alerts(exam_id: int = None, threshold: int = 3):
    from app.db.database import AsyncSessionLocal
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    from app.models.exam import ExamParticipant, ExamTrackingLog, ParticipantStatus
    
    fraud_alerts = []
    async with AsyncSessionLocal() as session:
        stmt = select(
            ExamParticipant,
            func.count(ExamTrackingLog.id).label('risk_score')
        ).outerjoin(
            ExamTrackingLog, ExamParticipant.id == ExamTrackingLog.exam_participant_id
        ).where(
            ExamParticipant.status == ParticipantStatus.IN_PROGRESS
        )
        
        if exam_id:
            stmt = stmt.where(ExamParticipant.exam_id == exam_id)
            
        stmt = stmt.group_by(ExamParticipant.id).options(selectinload(ExamParticipant.user))
        
        result = await session.execute(stmt)
        for participant, risk_score in result.all():
            fraud_alerts.append({
                "session_id": participant.id,
                "exam_id": participant.exam_id,
                "user_id": participant.user_id,
                "student_name": participant.user.full_name if participant.user else "Unknown",
                "risk_score": risk_score,
                "status": participant.status.value,
                "flagged": risk_score > threshold
            })
            
    # Sort by risk_score descending
    fraud_alerts.sort(key=lambda x: x["risk_score"], reverse=True)
    return {"fraud_alerts": fraud_alerts}
