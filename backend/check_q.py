import os, sys, asyncio
sys.path.append(os.getcwd())
from app.db.database import async_session_maker
from sqlalchemy import select
from app.models.question import Question, QuestionType

async def check():
    async with async_session_maker() as session:
        res = await session.execute(select(Question).filter(Question.passage_id.isnot(None)))
        passages = res.scalars().all()
        res = await session.execute(select(Question).filter(Question.type == QuestionType.COMPOSITE))
        composites = res.scalars().all()
        print(f'Passage questions: {len(passages)}')
        print(f'Composite questions: {len(composites)}')

asyncio.run(check())
