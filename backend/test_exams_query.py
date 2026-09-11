import asyncio
from sqlalchemy import select, func
from app.db.database import AsyncSessionLocal
from app.models.exam import Exam, ExamParticipant, ExamSubmission

async def main():
    async with AsyncSessionLocal() as db:
        filters = []
        subq = (
            select(ExamParticipant.exam_id, func.count(ExamSubmission.id).label("submission_count"))
            .join(ExamSubmission, ExamSubmission.exam_participant_id == ExamParticipant.id)
            .group_by(ExamParticipant.exam_id)
            .subquery()
        )

        stmt = (
            select(Exam, func.coalesce(subq.c.submission_count, 0).label("submission_count"))
            .outerjoin(subq, Exam.id == subq.c.exam_id)
            .where(*filters)
            .order_by(Exam.created_at.desc())
            .offset(0)
            .limit(10)
        )
        try:
            from app.schemas.exam import ExamResponse
            result = await db.execute(stmt)
            rows = result.all()
            for exam, count in rows:
                exam.submission_count = count
                print(f"Exam: {exam.name}, Count: {count}")
                try:
                    resp = ExamResponse.model_validate(exam)
                    print(resp.model_dump())
                except Exception as ex:
                    print("Validation error:", ex)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
