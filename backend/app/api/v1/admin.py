from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import os
import shutil
from datetime import datetime

from app.db.database import get_db
from app.api.dependencies import RequireRole, get_current_user
from app.models.user import User, Role
from app.core.security import get_password_hash
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

from pydantic import BaseModel

class UserAccessUpdate(BaseModel):
    can_view_answers: bool

@router.get("/users", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.id.desc()))
    users = result.scalars().all()
    return [{"id": u.id, "email": u.email, "username": u.username, "can_view_answers": u.can_view_answers} for u in users]

@router.put("/users/{user_id}/access", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def update_user_access(user_id: int, req: UserAccessUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.can_view_answers = req.can_view_answers
    await db.commit()
    return {"id": user.id, "can_view_answers": user.can_view_answers}

from typing import Optional

class StaffCreate(BaseModel):
    username: str
    email: str
    password: str
    role_name: str
    full_name: Optional[str] = None

class StaffUpdate(BaseModel):
    is_active: Optional[bool] = None
    role_name: Optional[str] = None
    full_name: Optional[str] = None

@router.get("/staff", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def get_staff_members(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).join(Role).where(Role.name.in_(["ADMIN", "TEACHER"])).order_by(User.id.desc()))
    users = result.scalars().all()
    return [{"id": u.id, "email": u.email, "username": u.username, "full_name": u.full_name, "is_active": u.is_active, "role": u.role.name} for u in users]

@router.post("/staff", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def create_staff(req: StaffCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    role_result = await db.execute(select(Role).where(Role.name == req.role_name))
    role = role_result.scalars().first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role name")
        
    existing = await db.execute(select(User).where((User.email == req.email) | (User.username == req.username)))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email or username already exists")
        
    user = User(
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        hashed_password=get_password_hash(req.password),
        role_id=role.id,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    await log_audit(db, current_user.id, AuditAction.CREATE_USER, "User", user.id, f"Created staff user {user.username} with role {role.name}")
    return {"id": user.id, "username": user.username, "role": role.name}

@router.put("/staff/{user_id}", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def update_staff(user_id: int, req: StaffUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if req.role_name:
        role_result = await db.execute(select(Role).where(Role.name == req.role_name))
        role = role_result.scalars().first()
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role name")
        user.role_id = role.id
        
    if req.is_active is not None:
        user.is_active = req.is_active
        
    if req.full_name is not None:
        user.full_name = req.full_name
        
    await db.commit()
    await log_audit(db, current_user.id, AuditAction.UPDATE_USER, "User", user.id, f"Updated staff user {user.username}")
    return {"id": user.id, "message": "Updated successfully"}

from app.models.system import SystemSetting
from app.models.audit import AuditLog
from sqlalchemy.orm import selectinload
from fastapi import Query

class SystemSettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None

@router.get("/settings", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemSetting))
    settings = result.scalars().all()
    return [{"key": s.key, "value": s.value, "description": s.description, "updated_at": s.updated_at} for s in settings]

@router.put("/settings/{key}", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def update_setting(key: str, req: SystemSettingUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalars().first()
    
    if not setting:
        setting = SystemSetting(key=key, value=req.value, description=req.description)
        db.add(setting)
        action = AuditAction.OTHER
        detail_msg = f"Created system setting {key}"
    else:
        setting.value = req.value
        if req.description is not None:
            setting.description = req.description
        action = AuditAction.OTHER
        detail_msg = f"Updated system setting {key}"
        
    await db.commit()
    await log_audit(db, current_user.id, action, "SystemSetting", None, detail_msg)
    
    return {"key": setting.key, "value": setting.value, "description": setting.description}

@router.get("/audit-logs", dependencies=[Depends(RequireRole(["ADMIN"]))])
async def get_audit_logs(
    skip: int = Query(0, ge=0), 
    limit: int = Query(50, ge=1, le=100),
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(AuditLog).options(selectinload(AuditLog.user)).order_by(AuditLog.id.desc())
    if action:
        query = query.where(AuditLog.action == action)
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    total_result = await db.execute(select(func.count(AuditLog.id)))
    total = total_result.scalar()
    
    return {
        "total": total,
        "items": [
            {
                "id": log.id,
                "user": {"id": log.user.id, "username": log.user.username} if log.user else None,
                "action": log.action.value if hasattr(log.action, 'value') else log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "details": log.details,
                "created_at": log.created_at
            }
            for log in logs
        ]
    }
