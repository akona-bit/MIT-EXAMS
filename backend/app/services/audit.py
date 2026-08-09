from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog, AuditAction

async def log_audit(
    db: AsyncSession, 
    user_id: int, 
    action: AuditAction, 
    target_type: str = None, 
    target_id: int = None, 
    details: str = None
):
    audit = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details
    )
    db.add(audit)
    await db.commit()
