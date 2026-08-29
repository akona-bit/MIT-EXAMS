from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.api.dependencies import RequireRole, get_current_active_user
from app.core.analytics import capture
from app.services.grading.scorer import grade_submission_ctt, run_irt_calibration_task
from app.models.grading import IrtTask

router = APIRouter()

class CttScoreResponse(BaseModel):
    submission_id: int
    ctt_score_part1: float
    ctt_score_part2: float
    ctt_score_part3: float
    ctt_score_part4: float
    raw_total_score: float
    score_method: str
    item_scores: dict[str, int]

@router.post("/submissions/{submission_id}/score", response_model=CttScoreResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER", "STUDENT"]))])
async def score_submission(submission_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_active_user)):
    result = await grade_submission_ctt(db, submission_id)
    if not result:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    response_data = {
        "submission_id": submission_id,
        "ctt_score_part1": result.ctt_score_part1,
        "ctt_score_part2": result.ctt_score_part2,
        "ctt_score_part3": result.ctt_score_part3,
        "ctt_score_part4": result.ctt_score_part4,
        "raw_total_score": result.raw_total_score,
        "score_method": result.score_method,
        "item_scores": result.item_scores
    }
    
    # Hide answers if the user does not have permission
    if not current_user.can_view_answers and current_user.role.name not in ["ADMIN", "TEACHER"]:
        response_data["item_scores"] = {}
        
    return response_data

@router.post("/exams/{exam_id}/run-irt", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def run_irt(request: Request, exam_id: int, db: AsyncSession = Depends(get_db)):
    # Trigger Celery Task
    task = run_irt_calibration_task.delay(exam_id)
    
    # Save to DB
    irt_task = IrtTask(exam_id=exam_id, celery_task_id=task.id, status="PENDING")
    db.add(irt_task)
    await db.commit()
    capture(request, "irt_calibration_started", {"exam_id": exam_id})
    
    return {"message": "IRT Calibration started", "task_id": task.id}

@router.get("/tasks/{task_id}", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def get_task_status(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IrtTask).where(IrtTask.celery_task_id == task_id))
    irt_task = result.scalars().first()
    
    if not irt_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    return {"task_id": task_id, "status": irt_task.status}
