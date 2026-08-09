from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import os
import shutil
from datetime import datetime

from app.db.database import get_db
from app.api.dependencies import RequireRole, get_current_user
from app.models.user import User
from app.models.exam import ExamParticipant
from app.models.audit import AuditAction
from app.services.audit import log_audit

router = APIRouter()

@router.post("/exams/{exam_id}/participants/{user_id}/ban", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def ban_participant(exam_id: int, user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(ExamParticipant)
        .where(ExamParticipant.exam_id == exam_id)
        .where(ExamParticipant.user_id == user_id)
    )
    participant = result.scalars().first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
        
    participant.is_banned = True
    await db.commit()
    
    await log_audit(db, current_user.id, AuditAction.BAN_STUDENT, "ExamParticipant", participant.id, f"Banned student {user_id} from exam {exam_id}")
    
    return {"message": f"Student {user_id} has been banned from the exam."}

@router.post("/exams/{exam_id}/participants/{user_id}/unban", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def unban_participant(exam_id: int, user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(ExamParticipant)
        .where(ExamParticipant.exam_id == exam_id)
        .where(ExamParticipant.user_id == user_id)
    )
    participant = result.scalars().first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
        
    participant.is_banned = False
    await db.commit()
    
    await log_audit(db, current_user.id, AuditAction.UNBAN_STUDENT, "ExamParticipant", participant.id, f"Unbanned student {user_id} from exam {exam_id}")
    
    return {"message": f"Student {user_id} has been unbanned."}

@router.post("/backup-db", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def backup_database(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_path = "mit_exams.db"
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found")
        
    backup_dir = "backups"
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"mit_exams_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_filename)
    
    shutil.copy2(db_path, backup_path)
    
    await log_audit(db, current_user.id, AuditAction.BACKUP_DB, "System", None, f"Created database backup: {backup_filename}")
    
    return {"message": "Database backed up successfully", "file": backup_filename}
