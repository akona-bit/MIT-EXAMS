from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import os
import uuid
import shutil

from app.db.database import get_db
from app.api.dependencies import RequireRole, get_current_user
from app.core.analytics import capture
from app.core.supabase_client import supabase_client
from app.models.omr import OmrJob, OmrSheet, OmrJobStatus, OmrSheetStatus
from app.models.user import User
from app.services.omr.tasks import process_omr_sheet_task

router = APIRouter()

@router.post("/upload")
async def upload_omr_sheets(
    request: Request,
    exam_id: int, 
    files: List[UploadFile] = File(...), 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name not in ["ADMIN", "TEACHER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    job = OmrJob(
        exam_id=exam_id,
        uploader_id=current_user.id,
        total_files=len(files),
        status=OmrJobStatus.PROCESSING
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    for file in files:
        ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filename = f"{uuid.uuid4()}.{ext}"
        
        try:
            content = await file.read()
            supabase_client.storage.from_("omr-sheets").upload(
                file=content,
                path=filename,
                file_options={"content-type": file.content_type}
            )
            public_url = supabase_client.storage.from_("omr-sheets").get_public_url(filename)
        except Exception as e:
            import logging
            logging.error(f"Failed to upload OMR sheet: {e}")
            continue # Skip failed file
            
        sheet = OmrSheet(
            job_id=job.id,
            image_path=public_url,
            status=OmrSheetStatus.PENDING
        )
        db.add(sheet)
        await db.commit()
        await db.refresh(sheet)
        
        # Trigger Celery Task
        process_omr_sheet_task.delay(sheet.id)
        
    capture(request, "omr_upload_started", {"exam_id": exam_id, "job_id": job.id, "file_count": len(files)})
    return {"message": "Upload successful, processing started.", "job_id": job.id}

@router.get("/jobs/{job_id}")
async def get_omr_job(job_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OmrJob).where(OmrJob.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Also get all sheets for this job
    sheets_res = await db.execute(select(OmrSheet).where(OmrSheet.job_id == job_id))
    sheets = sheets_res.scalars().all()
    
    return {
        "job": job,
        "sheets": sheets
    }

@router.get("/sheets/{sheet_id}")
async def get_omr_sheet(sheet_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
    sheet = result.scalars().first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet

@router.post("/sheets/{sheet_id}/confirm")
async def confirm_omr_sheet(
    request: Request,
    sheet_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name not in ["ADMIN", "TEACHER"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
    sheet = result.scalars().first()
    
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
        
    if sheet.status != OmrSheetStatus.NEEDS_REVIEW:
        raise HTTPException(status_code=400, detail="Sheet does not need review")
        
    # User manually verified via UI, change status
    sheet.status = OmrSheetStatus.COMPLETED
    # Here we would create an ExamSubmission object based on student_id_raw and form_code_raw
    # (Simulated for now)
    
    await db.commit()
    capture(request, "omr_sheet_confirmed", {"sheet_id": sheet_id, "job_id": sheet.job_id})
    return {"message": "Sheet confirmed successfully"}
