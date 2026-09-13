import os, sys, asyncio
sys.path.append(os.getcwd())
from app.db.database import async_session_maker
from app.services.latex_service import LatexService
from sqlalchemy import select
from app.models.exam import Exam

async def test_latex():
    async with async_session_maker() as session:
        # Find an exam
        exam = (await session.execute(select(Exam).limit(1))).scalars().first()
        if not exam:
            print("No exam found")
            return
            
        print(f"Testing latex export for exam {exam.id}...")
        try:
            zip_bytes = await LatexService.generate_latex_zip(session, exam.id)
            print(f"Success! Zip length: {len(zip_bytes)}")
        except Exception as e:
            import traceback
            traceback.print_exc()

asyncio.run(test_latex())
