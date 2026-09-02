from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.system import SystemSetting

router = APIRouter()

@router.get("/maintenance")
async def get_maintenance_settings(db: AsyncSession = Depends(get_db)):
    """
    Public endpoint to get maintenance settings.
    Used by the frontend to block student access during maintenance.
    """
    result = await db.execute(
        select(SystemSetting).where(
            SystemSetting.key.in_([
                "maintenance_mode_all",
                "maintenance_mode_exam",
                "maintenance_mode_result"
            ])
        )
    )
    settings = result.scalars().all()
    
    # Default to false if not set
    maintenance_status = {
        "maintenance_mode_all": False,
        "maintenance_mode_exam": False,
        "maintenance_mode_result": False
    }
    
    for s in settings:
        maintenance_status[s.key] = str(s.value).lower() == "true"
        
    return maintenance_status
