"""
API endpoints cho OMR processing.
Upload ảnh, theo dõi job, review thủ công, confirm kết quả.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional, Dict
import os
import uuid
import json

from app.db.database import get_db
from app.api.dependencies import RequireRole, get_current_user
from app.core.analytics import capture
from app.core.supabase_client import supabase_client
from app.models.omr import OmrJob, OmrSheet, OmrJobStatus, OmrSheetStatus
from app.models.exam import Exam, ExamForm
from app.models.user import User
from app.services.omr.tasks import (
    process_omr_sheet_task,
    process_omr_batch_task,
    confirm_omr_sheet_task,
)

router = APIRouter()


# ─── Upload & Process ────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_omr_sheets(
    request: Request,
    exam_id: int,
    files: List[UploadFile] = File(...),
    enable_gemini: bool = Query(True, description="Bật Gemini layer cho needs_review"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "TEACHER"])),
):
    """
    Upload hàng loạt ảnh phiếu OMR để xử lý.
    Trả về job_id để track tiến trình.
    """
    job = OmrJob(
        exam_id=exam_id,
        uploader_id=current_user.id,
        total_files=len(files),
        status=OmrJobStatus.PROCESSING,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    created_sheets = []
    for file in files:
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4()}.{ext}"

        try:
            content = await file.read()
            supabase_client.storage.from_("omr-sheets").upload(
                file=content,
                path=filename,
                file_options={"content-type": file.content_type},
            )
            public_url = supabase_client.storage.from_("omr-sheets").get_public_url(filename)
        except Exception as e:
            import logging
            logging.error(f"Failed to upload OMR sheet: {e}")
            continue

        sheet = OmrSheet(
            job_id=job.id,
            image_path=public_url,
            status=OmrSheetStatus.PENDING,
        )
        db.add(sheet)
        await db.commit()
        await db.refresh(sheet)

        created_sheets.append(sheet.id)

        # Trigger Celery task
        process_omr_sheet_task.delay(sheet.id, enable_gemini)

    capture(request, "omr_upload_started", {
        "exam_id": exam_id,
        "job_id": job.id,
        "file_count": len(files),
        "enable_gemini": enable_gemini,
    })

    return {
        "data": {
            "job_id": job.id,
            "sheet_ids": created_sheets,
            "total_files": len(files),
        },
        "meta": {"message": "Upload thành công, đang xử lý."},
    }


# ─── Job Status ──────────────────────────────────────────────────────────────

@router.get("/jobs/{job_id}")
async def get_omr_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin job OMR và danh sách sheets."""
    result = await db.execute(select(OmrJob).where(OmrJob.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    sheets_result = await db.execute(
        select(OmrSheet).where(OmrSheet.job_id == job_id)
    )
    sheets = sheets_result.scalars().all()

    return {
        "data": {
            "job": {
                "id": job.id,
                "exam_id": job.exam_id,
                "status": job.status.value,
                "total_files": job.total_files,
                "processed_files": job.processed_files,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            },
            "sheets": [
                {
                    "id": s.id,
                    "status": s.status.value,
                    "student_id_raw": s.student_id_raw,
                    "form_code_raw": s.form_code_raw,
                    "confidence_score": s.confidence_score,
                    "error_message": s.error_message,
                }
                for s in sheets
            ],
        }
    }


# ─── Sheet Detail ────────────────────────────────────────────────────────────

@router.get("/sheets/{sheet_id}")
async def get_omr_sheet(
    sheet_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Lấy chi tiết 1 phiếu OMR (kể cả kết quả đọc)."""
    result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
    sheet = result.scalars().first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    # Parse answers_raw để trả chi tiết
    answers_data = {}
    if sheet.answers_raw:
        try:
            answers_data = json.loads(sheet.answers_raw)
        except json.JSONDecodeError:
            pass

    return {
        "data": {
            "id": sheet.id,
            "job_id": sheet.job_id,
            "image_path": sheet.image_path,
            "student_id_raw": sheet.student_id_raw,
            "form_code_raw": sheet.form_code_raw,
            "confidence_score": sheet.confidence_score,
            "status": sheet.status.value,
            "error_message": sheet.error_message,
            "exam_submission_id": sheet.exam_submission_id,
            "answers": answers_data,
        }
    }


# ─── Review & Confirm ────────────────────────────────────────────────────────

@router.post("/sheets/{sheet_id}/review")
async def review_omr_sheet(
    request: Request,
    sheet_id: int,
    answers_override: Optional[Dict[int, str]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "TEACHER"])),
):
    """
    Review thủ công và confirm phiếu OMR.
    
    - answers_override: dict {question_no: "A"/"B"/"C"/"D"/null} 
      để override kết quả OpenCV/Gemini
    """
    result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
    sheet = result.scalars().first()

    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    if sheet.status not in (OmrSheetStatus.NEEDS_REVIEW, OmrSheetStatus.COMPLETED):
        raise HTTPException(
            status_code=400,
            detail=f"Sheet status is {sheet.status.value}, cannot review"
        )

    # Trigger confirm task
    task = confirm_omr_sheet_task.delay(
        sheet_id, current_user.id, answers_override
    )

    capture(request, "omr_sheet_review_started", {
        "sheet_id": sheet_id,
        "has_overrides": bool(answers_override),
    })

    return {
        "data": {
            "task_id": task.id,
            "message": "Đang xác nhận phiếu, vui lòng đợi.",
        }
    }


@router.post("/sheets/{sheet_id}/reject")
async def reject_omr_sheet(
    request: Request,
    sheet_id: int,
    reason: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequireRole(["ADMIN", "TEACHER"])),
):
    """Từ chối phiếu OMR (không hợp lệ, ảnh mờ, etc.)."""
    result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
    sheet = result.scalars().first()

    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    sheet.status = OmrSheetStatus.FAILED
    sheet.error_message = f"Rejected by {current_user.id}: {reason}"
    await db.commit()

    capture(request, "omr_sheet_rejected", {"sheet_id": sheet_id, "reason": reason})

    return {"data": {"message": "Đã từ chối phiếu."}}


# ─── Calibration ─────────────────────────────────────────────────────────────

@router.post("/calibrate")
async def calibrate_layout(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(RequireRole(["ADMIN"])),
):
    """
    Upload ảnh phiếu trống để calibrate toạ độ bubble.
    Trả về file JSON config + ảnh visualization.
    """
    from app.services.omr.calibration import CalibrationTool
    import cv2
    import numpy as np

    # Read image
    content = await file.read()
    nparr = np.frombuffer(content, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh")

    # Run calibration
    tool = CalibrationTool()
    try:
        result = tool.calibrate(image)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Export layout JSON
    layout_json = result["layout"].to_json()

    # Visualize
    vis = tool.visualize_calibration(
        result["warped_image"],
        result["clustered"],
    )

    # Encode visualization to base64
    _, vis_buf = cv2.imencode('.jpg', vis, [cv2.IMWRITE_JPEG_QUALITY, 85])
    import base64
    vis_base64 = base64.b64encode(vis_buf.tobytes()).decode()

    capture(request, "omr_calibration", {
        "detected_bubbles": {
            "sbd": len(result["clustered"].get("sbd", [])),
            "ma_de": len(result["clustered"].get("ma_de", [])),
            "questions": len(result["clustered"].get("questions", [])),
        }
    })

    return {
        "data": {
            "layout_json": json.loads(layout_json),
            "visualization_base64": vis_base64,
            "detected_counts": {
                "sbd": len(result["clustered"].get("sbd", [])),
                "ma_de": len(result["clustered"].get("ma_de", [])),
                "questions": len(result["clustered"].get("questions", [])),
                "type": len(result["clustered"].get("type", [])),
            },
        }
    }
