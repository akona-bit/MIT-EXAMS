import asyncio
import os
import sys
import uuid

# Add parent dir to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.models.question import Question, QuestionType, QuestionStatus, Answer, KnowledgeNode
from app.models.passage import Passage
from app.models.exam import Exam, ExamForm, ExamFormQuestion, ExamFormAnswer, Matrix

async def get_or_create_user(session):
    user = await session.get(User, 1)
    if not user:
        print("User 1 not found. Creating a generic admin user...")
        from app.core.security import get_password_hash
        user = User(
            id=1,
            email="admin_seed@example.com",
            hashed_password=get_password_hash("123456"),
            full_name="Admin Visual Seed",
            role_id=1
        )
        session.add(user)
        await session.flush()
    return user

async def seed():
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(session)
        
        # We need a knowledge node for these questions
        from sqlalchemy.future import select
        result = await session.execute(select(KnowledgeNode).limit(1))
        node = result.scalar_one_or_none()
        if not node:
            node = KnowledgeNode(name="Toán Học", description="Toán Học", level=1)
            session.add(node)
            await session.flush()
            
        print("Creating Visual Exam Form...")
        
        # Create a Matrix first because Exam needs one
        matrix = Matrix(name="Ma trận thi Visual")
        session.add(matrix)
        await session.flush()
        
        exam = Exam(
            name="Đề thi thử (Visual Test - Ảnh Ngang)",
            description="Đề thi này kiểm tra chức năng in ảnh song song 50% ra LaTeX",
            matrix_id=matrix.id
        )
        session.add(exam)
        await session.flush()
        
        exam_code = f"VISUAL-{uuid.uuid4().hex[:6].upper()}"
        exam_form = ExamForm(
            exam_id=exam.id,
            code=exam_code,
            is_original=True
        )
        session.add(exam_form)
        await session.flush()
        
        # 2 images side-by-side using the LaTeX output format from the editor
        # The frontend generates this exactly when size 50%, horizontal layout, latex format is chosen:
        latex_images_block = (
            "\\begin{figure}[H]\n\\centering\n"
            "\\includegraphics[width=0.48\\linewidth]{https://picsum.photos/400/300?random=1}\n\\hfill\n"
            "\\includegraphics[width=0.48\\linewidth]{https://picsum.photos/400/300?random=2}\n"
            "\\caption{Ảnh 1 - Ảnh 2}\n\\end{figure}\n\n"
        )
        
        # Create 2 standalone questions
        q1 = Question(
            public_code=f"Q-{uuid.uuid4().hex[:6].upper()}",
            content=f"Câu hỏi đơn 1:\n\n{latex_images_block}\nHãy chọn đáp án đúng.",
            level=1,
            type=QuestionType.SINGLE_CHOICE,
            status=QuestionStatus.APPROVED,
            creator_id=user.id,
            knowledge_node_id=node.id
        )
        q2 = Question(
            public_code=f"Q-{uuid.uuid4().hex[:6].upper()}",
            content=f"Câu hỏi đơn 2:\n\n{latex_images_block}\nCho biết ý nghĩa của hai bức ảnh trên?",
            level=2,
            type=QuestionType.SINGLE_CHOICE,
            status=QuestionStatus.APPROVED,
            creator_id=user.id,
            knowledge_node_id=node.id
        )
        session.add_all([q1, q2])
        await session.flush()
        
        # Create passage (câu chùm)
        passage = Passage(
            public_code=f"P-{uuid.uuid4().hex[:6].upper()}",
            source_title="Ngữ liệu về Hình ảnh Không gian",
            content=f"Đọc ngữ liệu sau và trả lời các câu hỏi bên dưới:\n\n{latex_images_block}\nĐây là ngữ liệu có chứa hình ảnh đặt song song (ngang).",
            creator_id=user.id
        )
        session.add(passage)
        await session.flush()
        
        # 3 questions for passage
        pq1 = Question(
            public_code=f"PQ-{uuid.uuid4().hex[:6].upper()}",
            content=f"Câu hỏi chùm 1:\n\n{latex_images_block}\nHình ảnh trên mang thông điệp gì?",
            level=1,
            type=QuestionType.SINGLE_CHOICE,
            status=QuestionStatus.APPROVED,
            creator_id=user.id,
            knowledge_node_id=node.id,
            passage_id=passage.id
        )
        pq2 = Question(
            public_code=f"PQ-{uuid.uuid4().hex[:6].upper()}",
            content=f"Câu hỏi chùm 2:\n\n{latex_images_block}\nHãy phân tích ảnh bên phải.",
            level=2,
            type=QuestionType.SINGLE_CHOICE,
            status=QuestionStatus.APPROVED,
            creator_id=user.id,
            knowledge_node_id=node.id,
            passage_id=passage.id
        )
        pq3 = Question(
            public_code=f"PQ-{uuid.uuid4().hex[:6].upper()}",
            content=f"Câu hỏi chùm 3:\n\n{latex_images_block}\nKết luận từ ảnh bên trái?",
            level=3,
            type=QuestionType.SINGLE_CHOICE,
            status=QuestionStatus.APPROVED,
            creator_id=user.id,
            knowledge_node_id=node.id,
            passage_id=passage.id
        )
        session.add_all([pq1, pq2, pq3])
        await session.flush()
        
        # Create answers for all
        questions = [q1, q2, pq1, pq2, pq3]
        for idx, q in enumerate(questions):
            ans_objects = []
            for i in range(4):
                ans = Answer(
                    question_id=q.id,
                    content=f"Đáp án {i+1} của câu hỏi {q.id}",
                    is_correct=(i == 0)
                )
                ans_objects.append(ans)
            session.add_all(ans_objects)
            await session.flush()
            
            # Link to exam form
            fq = ExamFormQuestion(
                exam_form_id=exam_form.id,
                question_id=q.id,
                position=idx+1,
                part=1
            )
            session.add(fq)
            await session.flush()
            
            # Link answers to exam form question
            for i, ans in enumerate(ans_objects):
                fqa = ExamFormAnswer(
                    exam_form_question_id=fq.id,
                    answer_id=ans.id,
                    new_position=i+1
                )
                session.add(fqa)
                
        await session.commit()
        print(f"Thành công! Đã tạo đề thi mã: {exam_form.code} với 2 câu đơn và 1 cụm 3 câu chùm.")

if __name__ == "__main__":
    asyncio.run(seed())
