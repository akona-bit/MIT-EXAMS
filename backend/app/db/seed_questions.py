import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.config import settings
from app.models.question import Question, Answer, QuestionType, QuestionStatus, KnowledgeNode

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession)

async def seed():
    async with AsyncSessionLocal() as session:
        # Create a KnowledgeNode
        node = KnowledgeNode(name="Toán Học Cơ Bản")
        session.add(node)
        await session.flush()
        
        # Create 20 questions
        for i in range(20):
            q = Question(
                content=f"Câu hỏi Toán {i+1}",
                level=1,
                type=QuestionType.SINGLE_CHOICE,
                knowledge_node_id=node.id,
                status=QuestionStatus.APPROVED,
                creator_id=1 # Assuming admin is 1
            )
            session.add(q)
            await session.flush()
            
            for j, opt in enumerate(["A", "B", "C", "D"]):
                a = Answer(
                    question_id=q.id,
                    content=f"Đáp án {opt}",
                    is_correct=(j == 0), # always A is correct for testing
                    position=j+1
                )
                session.add(a)
                
        node_id = node.id
        await session.commit()
        print(f"Seeded KnowledgeNode ID: {node_id} and 20 questions successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
