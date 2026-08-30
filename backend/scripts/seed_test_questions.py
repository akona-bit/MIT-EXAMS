import asyncio
import os
import sys

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Bắt buộc cho Windows để print tiếng Việt không bị lỗi
sys.stdout.reconfigure(encoding='utf-8')

# Cấu hình db url
load_dotenv()
url = os.getenv('DATABASE_URL').replace('postgres://', 'postgresql+asyncpg://', 1)
engine = create_async_engine(url)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

from app.models.question import Question, Answer, KnowledgeNode

async def seed_questions():
    async with async_session() as session:
        # Tìm các node tên 'Test Skill E2E'
        res = await session.execute(select(KnowledgeNode).where(KnowledgeNode.name == 'Test Skill E2E'))
        nodes = res.scalars().all()
        
        if not nodes:
            print("Không tìm thấy Node 'Test Skill E2E'")
            return
        
        print(f"Tìm thấy {len(nodes)} nodes 'Test Skill E2E'. Tiến hành thêm câu hỏi...")
        
        count = 0
        for node in nodes:
            # Thêm 5 câu hỏi cho mỗi level (1 đến 4) để chắc chắn cover đủ ma trận
            for level in range(1, 5):
                for i in range(5):
                    q = Question(
                        content=f"<p>Câu hỏi E2E test cho level {level} - số {i+1}</p>",
                        type="SINGLE_CHOICE",
                        level=level,
                        knowledge_node_id=node.id,
                        status="APPROVED", # phải APPROVED thì ma trận mới lấy
                        creator_id=7, # Add valid creator_id
                        source_author="Hệ thống tự động",
                        source_title="Dữ liệu Test E2E"
                    )
                    
                    # 4 đáp án
                    for j in range(4):
                        is_correct = (j == 0)
                        a = Answer(
                            content=f"Đáp án {['A', 'B', 'C', 'D'][j]}",
                            is_correct=is_correct,
                            position=j+1
                        )
                        q.answers.append(a)
                    
                    session.add(q)
                    count += 1
        
        await session.commit()
        print(f"Đã thêm thành công {count} câu hỏi vào ngân hàng cho các skill E2E.")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_questions())
