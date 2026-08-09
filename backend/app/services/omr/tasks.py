import asyncio
from celery import shared_task
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.omr import OmrSheet, OmrSheetStatus, OmrJob, OmrJobStatus
from app.services.omr.pipeline import OMREngine
from app.db.database import async_session_maker

async def _process_omr_sheet_async(sheet_id: int):
    async with async_session_maker() as db:
        # Load the sheet
        result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
        sheet = result.scalars().first()
        if not sheet:
            return
            
        try:
            # Update status to PROCESSING
            sheet.status = OmrSheetStatus.PROCESSING
            await db.commit()
            
            # Run OMREngine
            engine = OMREngine(sheet.image_path)
            res = engine.process()
            
            sheet.student_id_raw = res["student_id_raw"]
            sheet.form_code_raw = res["form_code_raw"]
            sheet.answers_raw = res["answers_raw"]
            sheet.confidence_score = res["confidence_score"]
            
            if res["needs_review"]:
                sheet.status = OmrSheetStatus.NEEDS_REVIEW
            else:
                sheet.status = OmrSheetStatus.COMPLETED
                
        except Exception as e:
            sheet.status = OmrSheetStatus.FAILED
            sheet.error_message = str(e)
            
        await db.commit()
        
        # Check if job is completed
        job_result = await db.execute(select(OmrJob).where(OmrJob.id == sheet.job_id))
        job = job_result.scalars().first()
        if job:
            job.processed_files += 1
            if job.processed_files >= job.total_files:
                job.status = OmrJobStatus.COMPLETED
            await db.commit()

@shared_task(bind=True)
def process_omr_sheet_task(self, sheet_id: int):
    # Run the async function in Celery's sync context
    asyncio.run(_process_omr_sheet_async(sheet_id))
    return {"status": "SUCCESS", "sheet_id": sheet_id}
