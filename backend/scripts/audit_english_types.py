import asyncio
import csv
import sys
import os
from pathlib import Path

# Fix windows console encoding for Vietnamese prints
sys.stdout.reconfigure(encoding='utf-8')

# Add backend to path so we can import app modules
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select
from app.models.question import Question, KnowledgeNode, QuestionType
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

async def audit_english_questions():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    anomalies = []
    
    async with async_session() as session:
        # Find Knowledge Nodes for English
        stmt = select(KnowledgeNode).where(KnowledgeNode.subject == 'Tiếng Anh')
        res = await session.execute(stmt)
        english_nodes = res.scalars().all()
        node_ids = [node.id for node in english_nodes]
        
        if not node_ids:
            print("Không tìm thấy KnowledgeNode nào môn Tiếng Anh.")
            return

        print(f"Đã tìm thấy {len(node_ids)} KnowledgeNodes môn Tiếng Anh.")
        
        # Load all questions in these nodes
        stmt = select(Question).where(Question.knowledge_node_id.in_(node_ids)).options(
            selectinload(Question.sub_items),
            selectinload(Question.answers)
        )
        res = await session.execute(stmt)
        questions = res.scalars().all()
        
        print(f"Đang kiểm tra {len(questions)} câu hỏi...")
        
        for q in questions:
            # Rule 1: COMPOSITE should have > 0 sub_items. If 0 sub_items, it should be SINGLE_CHOICE/FILL_IN_BLANK
            if q.type == QuestionType.COMPOSITE and len(q.sub_items) == 0:
                anomalies.append({
                    "id": q.id,
                    "content": q.content[:50].replace('\n', ' ') + "...",
                    "current_type": q.type.value,
                    "sub_items_count": len(q.sub_items),
                    "answers_count": len(q.answers),
                    "reason": "Type là COMPOSITE nhưng không có sub_items"
                })
            
            # Rule 2: SINGLE_CHOICE should NOT have sub_items
            if q.type == QuestionType.SINGLE_CHOICE and len(q.sub_items) > 0:
                anomalies.append({
                    "id": q.id,
                    "content": q.content[:50].replace('\n', ' ') + "...",
                    "current_type": q.type.value,
                    "sub_items_count": len(q.sub_items),
                    "answers_count": len(q.answers),
                    "reason": "Type là SINGLE_CHOICE nhưng lại chứa sub_items"
                })
            
            # Rule 3: FILL_IN_BLANK should NOT have sub_items (usually) or if it does, it's a composite
            if q.type == QuestionType.FILL_IN_BLANK and len(q.sub_items) > 0:
                anomalies.append({
                    "id": q.id,
                    "content": q.content[:50].replace('\n', ' ') + "...",
                    "current_type": q.type.value,
                    "sub_items_count": len(q.sub_items),
                    "answers_count": len(q.answers),
                    "reason": "Type là FILL_IN_BLANK nhưng lại chứa sub_items"
                })

    if not anomalies:
        print("Tất cả câu hỏi tiếng Anh đều hợp lệ!")
        return

    # Write CSV
    output_file = "audit_english_types_report.csv"
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["id", "content", "current_type", "sub_items_count", "answers_count", "reason"])
        writer.writeheader()
        writer.writerows(anomalies)
        
    print(f"Đã phát hiện {len(anomalies)} câu hỏi sai Type. Chi tiết xem tại {output_file}")

if __name__ == "__main__":
    asyncio.run(audit_english_questions())
