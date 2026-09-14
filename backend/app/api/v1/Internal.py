"""
Internal endpoint: POST /api/v1/internal/process-pending-irt

Called on a schedule by GitHub Actions instead of via the Celery worker
(Render free tier has no Background Worker plan). This is a *reconciliation*
job: `complete_exam` already kicks off `background_run_irt` via FastAPI
BackgroundTasks when an exam hits COMPLETED, but that in-process background
task dies silently if the web dyno restarts/redeploys mid-run (Render free
web services do this on spin-down/deploy). This endpoint finds exams that
should have a finished IrtTask but don't, and (re)runs them.

Mount:
    # app/main.py
    from app.api.v1.internal import router as internal_router
    app.include_router(internal_router, prefix="/api/v1/internal", tags=["Internal"])
"""
import os
import time
import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.exam import Exam, ExamStatus, ExamSubmission, ExamParticipant
from app.models.grading import IrtTask
from app.services.grading.scorer import background_run_irt

router = APIRouter()
logger = logging.getLogger(__name__)

IRT_THRESHOLD = 200  # keep in sync with exams.py complete_exam
STALE_PENDING_MINUTES = 15  # keep in sync with grading.py get_task_status
MAX_RUNTIME_SECONDS = 100  # stay under GitHub Actions' curl --max-time 120


def verify_internal_token(x_internal_token: str = Header(default=None)):
    expected = os.environ.get("INTERNAL_TASK_TOKEN")
    if not expected or not x_internal_token or x_internal_token != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing internal token")


def _is_unresolved(task: IrtTask | None) -> bool:
    """Mirrors the stale-task guard in grading.py's get_task_status."""
    if task is None:
        return True
    if task.status == "SUCCESS":
        return False
    if task.status in ("PENDING", "STARTED") and task.created_at is not None:
        if datetime.now(timezone.utc) - task.created_at > timedelta(minutes=STALE_PENDING_MINUTES):
            return True  # stale -> treat as needing a retry
        return False  # still genuinely in-flight, don't touch it
    return True  # FAILED or unknown status


@router.post("/process-pending-irt")
async def process_pending_irt(
    _auth: None = Depends(verify_internal_token),
    db: AsyncSession = Depends(get_db),
):
    start = time.monotonic()

    completed_exams = (
        (await db.execute(select(Exam).where(Exam.status == ExamStatus.COMPLETED)))
        .scalars()
        .all()
    )

    processed, errors, skipped_out_of_time, skipped_below_threshold = [], [], [], []

    for exam in completed_exams:
        if time.monotonic() - start > MAX_RUNTIME_SECONDS:
            skipped_out_of_time.append(exam.id)
            continue

        latest_task = (
            (
                await db.execute(
                    select(IrtTask)
                    .where(IrtTask.exam_id == exam.id)
                    .order_by(IrtTask.id.desc())
                )
            )
            .scalars()
            .first()
        )
        if not _is_unresolved(latest_task):
            continue

        submission_count = (
            await db.execute(
                select(func.count())
                .select_from(ExamSubmission)
                .join(ExamParticipant, ExamParticipant.id == ExamSubmission.exam_participant_id)
                .where(ExamParticipant.exam_id == exam.id)
            )
        ).scalar() or 0

        if submission_count < IRT_THRESHOLD:
            skipped_below_threshold.append(exam.id)
            continue

        try:
            task_id = str(uuid.uuid4())
            irt_task = IrtTask(exam_id=exam.id, celery_task_id=task_id, status="PENDING")
            db.add(irt_task)
            await db.commit()

            await background_run_irt(exam.id, task_id)
            processed.append(exam.id)
        except Exception as exc:  # noqa: BLE001 - report, keep processing the rest
            logger.exception(f"process-pending-irt failed for exam {exam.id}: {exc}")
            errors.append({"exam_id": exam.id, "error": str(exc)})

    return {
        "processed": processed,
        "errors": errors,
        "skipped_out_of_time": skipped_out_of_time,
        "skipped_below_threshold": skipped_below_threshold,
        "remaining_next_run": len(skipped_out_of_time),
    }

