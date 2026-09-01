import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import asyncio
from sqlalchemy import select, func, and_
from app.db.database import AsyncSessionLocal 

# Dòng thêm mới: Import passage để SQLAlchemy resolve được relationship trong Question
import app.models.passage 
from app.models.question import KnowledgeNode, Question 

async def run_audit():
    async with AsyncSessionLocal() as db:
        print("BẮT ĐẦU KIỂM TRA DỮ LIỆU VI PHẠM KNOWLEDGE NODE...\n")
        
        child_count_subq = (
            select(
                KnowledgeNode.parent_id,
                func.count(KnowledgeNode.id).label("child_count")
            )
            .where(KnowledgeNode.parent_id.isnot(None))
            .group_by(KnowledgeNode.parent_id)
            .subquery()
        )

        question_count_subq = (
            select(
                Question.knowledge_node_id,
                func.count(Question.id).label("question_count")
            )
            .where(Question.knowledge_node_id.isnot(None))
            .group_by(Question.knowledge_node_id)
            .subquery()
        )

        stmt = (
            select(
                KnowledgeNode.id,
                KnowledgeNode.name,
                child_count_subq.c.child_count,
                question_count_subq.c.question_count
            )
            .join(child_count_subq, KnowledgeNode.id == child_count_subq.c.parent_id)
            .join(question_count_subq, KnowledgeNode.id == question_count_subq.c.knowledge_node_id)
            .where(child_count_subq.c.child_count > 0)
            .where(question_count_subq.c.question_count > 0)
        )

        result = await db.execute(stmt)
        violating_nodes = result.all()

        if not violating_nodes:
            print("Tuyệt vời! Không có node nào vi phạm quy tắc 'Chỉ node lá mới được gắn câu hỏi'.")
        else:
            print(f"⚠️ PHÁT HIỆN {len(violating_nodes)} NODE VI PHẠM (Có con nhưng vẫn gắn câu hỏi):")
            print("-" * 70)
            print(f"{'ID':<40} | {'Tên Node':<25} | {'Số Node con':<12} | {'Số Câu hỏi':<10}")
            print("-" * 70)
            for node in violating_nodes:
                print(f"{str(node.id):<40} | {node.name:<25} | {node.child_count:<12} | {node.question_count:<10}")
            print("-" * 70)
            print("=> Vui lòng ghi nhận danh sách này. Admin cần truy cập UI để re-assign các câu hỏi này xuống đúng node con phù hợp.")

if __name__ == "__main__":
    asyncio.run(run_audit())