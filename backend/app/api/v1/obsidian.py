from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user import User
from app.api.dependencies import RequireRole, get_current_active_user
from app.services.obsidian_sync import ObsidianSyncService
from app.models.obsidian import ObsidianSyncRun

router = APIRouter()

class SyncLocalApiRequest(BaseModel):
    api_url: str
    api_key: str


@router.get("/history", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def get_sync_history(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ObsidianSyncRun)
        .order_by(ObsidianSyncRun.started_at.desc())
        .limit(max(1, min(limit, 100)))
    )
    return result.scalars().all()

@router.post("/sync-local-api", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def sync_obsidian_local_api(
    req: SyncLocalApiRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        return await ObsidianSyncService(db, current_user.id).sync(
            api_url=req.api_url,
            api_key=req.api_key,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to communicate with Obsidian Local REST API: {str(e)}")
