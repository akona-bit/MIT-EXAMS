import asyncio
import csv
import sys
import os
from pathlib import Path

# Fix windows console encoding for Vietnamese prints
sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select
from app.models.question import Question, QuestionType
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

async def audit_answer_counts():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    anomalies = []
    
    async with async_session() as session:
        # Load all SINGLE_CHOICE questions
        stmt = select(Question).where(Question.type == QuestionType.SINGLE_CHOICE).options(
            selectinload(Question.answers)
        )
        res = await session.execute(stmt)
        questions = res.scalars().all()
        
        print(f"Đang kiểm tra {len(questions)} câu hỏi SINGLE_CHOICE...")
        
        for q in questions:
            answers = q.answers
            
            # Check length
            if len(answers) != 4:
                anomalies.append({
                    "id": q.id,
                    "content": q.content[:50].replace('\n', ' ') + "...",
                    "answers_count": len(answers),
                    "correct_count": sum(1 for a in answers if a.is_correct),
                    "reason": f"Có {len(answers)} đáp án (yêu cầu đúng 4)"
                })
                continue
                
            # Check correct answers count
            correct_count = sum(1 for a in answers if a.is_correct)
            if correct_count != 1:
                anomalies.append({
                    "id": q.id,
                    "content": q.content[:50].replace('\n', ' ') + "...",
                    "answers_count": len(answers),
                    "correct_count": correct_count,
                    "reason": f"Có {correct_count} đáp án đúng (yêu cầu đúng 1)"
                })

    if not anomalies:
        print("Tất cả câu hỏi SINGLE_CHOICE đều có đúng 4 đáp án và 1 đáp án đúng!")
        return

    # Write CSV
    output_file = "audit_missing_answers_report.csv"
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["id", "content", "answers_count", "correct_count", "reason"])
        writer.writeheader()
        writer.writerows(anomalies)
        
    print(f"Đã phát hiện {len(anomalies)} câu hỏi vi phạm rules. Chi tiết xem tại {output_file}")

if __name__ == "__main__":
    asyncio.run(audit_answer_counts())
