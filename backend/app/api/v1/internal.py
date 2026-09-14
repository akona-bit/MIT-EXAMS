from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
import logging
import os

from app.db.database import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

async def verify_internal_token(x_internal_token: str = Header(...)):
    expected_token = os.getenv("INTERNAL_TASK_TOKEN")
    if not expected_token or x_internal_token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid internal token")

@router.post("/process-pending-irt")
async def process_pending_irt(
    _auth: None = Depends(verify_internal_token),
    db: AsyncSession = Depends(get_db),
):
    from app.models.grading import IrtTask
    from app.services.grading.scorer import background_run_irt

    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    stuck = (await db.execute(
        select(IrtTask).where(
            IrtTask.status.in_(["PENDING", "STARTED"]),
            IrtTask.created_at < stale_cutoff,
        )
    )).scalars().all()

    recovered = []
    for task in stuck:
        task.status = "PENDING"
        await db.commit()
        try:
            import asyncio
            asyncio.create_task(background_run_irt(task.exam_id, task.celery_task_id))
            recovered.append(task.id)
        except Exception as exc:
            logger.exception(f"process-pending-irt failed for task {task.id}: {exc}")

    return {"recovered": recovered}

@router.post("/process-pending-omr")
async def process_pending_omr(
    _auth: None = Depends(verify_internal_token),
    db: AsyncSession = Depends(get_db),
):
    from app.models.omr import OmrSheet, OmrSheetStatus
    from app.services.omr.tasks import process_sheet_async

    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    stuck = (await db.execute(
        select(OmrSheet).where(
            OmrSheet.status.in_([OmrSheetStatus.PENDING, OmrSheetStatus.PROCESSING]),
            OmrSheet.updated_at < stale_cutoff,
        )
    )).scalars().all()

    recovered = []
    for sheet in stuck:
        sheet.status = OmrSheetStatus.PENDING
        await db.commit()
        try:
            import asyncio
            asyncio.create_task(process_sheet_async(sheet.id, enable_gemini=True))
            recovered.append(sheet.id)
        except Exception as exc:
            logger.exception(f"process-pending-omr failed for sheet {sheet.id}: {exc}")

    return {"recovered": recovered}
