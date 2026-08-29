import asyncio
import os
import sys
from fastapi import HTTPException

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import get_db, async_session_maker
from app.models.exam import Matrix, MatrixRule, Exam, ExamForm, ExamFormQuestion, ExamGenerationRun
from app.models.question import Question, KnowledgeNode, QuestionType
from app.models.user import User
from app.api.v1.matrix import generate_exam_from_matrix
from app.schemas.exam import GenerateExamRequest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

async def run_e2e_tests():
    print("=== STARTING E2E INTEGRATION TESTS ===")
    
    async with async_session_maker() as db:
        # 1. SETUP DUMMY DATA
        print("Setting up dummy data...")
        
        # Create or get user
        user_res = await db.execute(select(User).where(User.email == "admin_e2e@example.com"))
        user = user_res.scalars().first()
        if not user:
            user = User(username="admin_e2e", email="admin_e2e@example.com", hashed_password="pw", role_id=1, is_active=True)
            db.add(user)
            await db.flush()

        # Create knowledge nodes
        topic = KnowledgeNode(name="Test Topic E2E")
        db.add(topic)
        await db.flush()
        
        concept = KnowledgeNode(name="Test Concept E2E", parent_id=topic.id)
        db.add(concept)
        await db.flush()
        
        skill = KnowledgeNode(name="Test Skill E2E", parent_id=concept.id)
        db.add(skill)
        await db.flush()
        
        # Create 2 questions for this skill
        q1 = Question(content="Q1", level=1, type=QuestionType.SINGLE_CHOICE, status="APPROVED", knowledge_node_id=skill.id, b_param=0.0, creator_id=user.id)
        q2 = Question(content="Q2", level=1, type=QuestionType.SINGLE_CHOICE, status="APPROVED", knowledge_node_id=skill.id, b_param=0.0, creator_id=user.id)
        db.add_all([q1, q2])
        await db.flush()
        
        # Create a Matrix requiring 3 questions (intentionally causing a shortage since we only have 2)
        matrix = Matrix(name="Test Matrix E2E", subject="Math")
        db.add(matrix)
        await db.flush()
        
        rule = MatrixRule(matrix_id=matrix.id, knowledge_node_id=skill.id, question_type=QuestionType.SINGLE_CHOICE, level=1, count=3)
        db.add(rule)
        
        # Create an Exam
        exam = Exam(name="Test Exam E2E", matrix_id=matrix.id)
        db.add(exam)
        await db.commit()
        
        # Force session clear so that relationships load properly
        db.expunge_all()
        
        # ---------------------------------------------------------------------
        # TEST CASE 1: SHORTAGE (Expect 422 with shortages JSON)
        # ---------------------------------------------------------------------
        print("\n--- TEST CASE 1: SHORTAGE ERROR ---")
        req1 = GenerateExamRequest(exam_id=exam.id, number_of_forms=1, distinct_questions=False)
        try:
            await generate_exam_from_matrix(matrix_id=matrix.id, req=req1, db=db)
            print("ERROR: Expected HTTPException 422, but succeeded.")
        except HTTPException as e:
            if e.status_code == 422 and "shortages" in e.detail:
                print(f"SUCCESS: Caught 422 with shortages: {e.detail['shortages']}")
            else:
                print(f"ERROR: Caught HTTPException but unexpected detail: {e.detail}")
                
        # Check if ExamGenerationRun(FAILED) is stored in DB
        result = await db.execute(select(ExamGenerationRun).where(ExamGenerationRun.matrix_id == matrix.id))
        runs = result.scalars().all()
        if len(runs) == 1 and runs[0].status == "FAILED":
            print("SUCCESS: ExamGenerationRun(FAILED) correctly logged to DB.")
        else:
            print(f"ERROR: ExamGenerationRun log missing or incorrect status. Found {len(runs)} runs.")

        # ---------------------------------------------------------------------
        # PREPARE FOR NEXT TESTS (Fix the shortage)
        # ---------------------------------------------------------------------
        # Update rule count to 2, so it exactly matches our 2 questions
        await db.execute(text("UPDATE matrix_rule SET count = 2 WHERE id = :id"), {"id": rule.id})
        await db.commit()
        
        # ---------------------------------------------------------------------
        # TEST CASE 2 & 3: SUCCESSFUL GENERATION TWICE (Test Unique Constraint & distinct_questions)
        # ---------------------------------------------------------------------
        print("\n--- TEST CASE 2: SUCCESSFUL GENERATION (RUN 1) ---")
        # Run 1: generate 2 forms, distinct=False.
        req2 = GenerateExamRequest(exam_id=exam.id, number_of_forms=2, distinct_questions=False)
        res2 = await generate_exam_from_matrix(matrix_id=matrix.id, req=req2, db=db)
        print(f"SUCCESS: Run 1 completed. Response: {res2}")
        
        # Check if forms are in DB
        forms_res1 = await db.execute(select(ExamForm).where(ExamForm.exam_id == exam.id))
        forms1 = forms_res1.scalars().all()
        if len(forms1) == 2:
            print("SUCCESS: 2 ExamForms successfully stored in DB without unique constraint violations.")
        else:
            print(f"ERROR: Expected 2 forms, found {len(forms1)}")

        print("\n--- TEST CASE 3: SUCCESSFUL GENERATION (RUN 2, DISTINCT=TRUE, EXACT POOL) ---")
        # Run 2: generate 1 form with distinct=True (which shouldn't matter since it's just 1 form, but let's test generating AGAIN on the same exam)
        # Wait, the user specifically asked: "Thử distinct_questions=true với ngân hàng câu hỏi vừa đủ (không dư) cho 2 mã đề"
        # We need 2 questions PER form. So for 2 forms, we need 4 questions.
        # But we only have 2 questions! If distinct_questions=true, form 1 takes 2 questions, leaving 0 for form 2.
        # This SHOULD trigger a shortage error on Form 2!
        req3 = GenerateExamRequest(exam_id=exam.id, number_of_forms=2, distinct_questions=True)
        try:
            await generate_exam_from_matrix(matrix_id=matrix.id, req=req3, db=db)
            print("ERROR: Expected shortage on second form, but succeeded.")
        except HTTPException as e:
            if e.status_code == 422 and "shortages" in e.detail:
                print(f"SUCCESS: Caught 422 because pool is exhausted by distinct_questions=True. Shortages: {e.detail['shortages']}")
            else:
                print(f"ERROR: Caught unexpected error: {e.detail}")

        # Let's add 2 more questions to make the pool = 4
        q3 = Question(content="Q3", level=1, type=QuestionType.SINGLE_CHOICE, status="APPROVED", knowledge_node_id=skill.id, b_param=0.0, creator_id=user.id)
        q4 = Question(content="Q4", level=1, type=QuestionType.SINGLE_CHOICE, status="APPROVED", knowledge_node_id=skill.id, b_param=0.0, creator_id=user.id)
        db.add_all([q3, q4])
        await db.commit()
        
        # Now try again with distinct_questions=True, it should succeed
        print("\n--- TEST CASE 4: DISTINCT=TRUE WITH EXACT POOL (4 questions, 2 needed per form) ---")
        res4 = await generate_exam_from_matrix(matrix_id=matrix.id, req=req3, db=db)
        print(f"SUCCESS: Run 3 completed. Response: {res4}")
        
        # Now check total forms in DB. We had 2 from Run 1, and now 2 more from Run 3. Total = 4.
        forms_res_total = await db.execute(select(ExamForm).where(ExamForm.exam_id == exam.id))
        forms_total = forms_res_total.scalars().all()
        if len(forms_total) == 4:
            print("SUCCESS: Total 4 ExamForms stored successfully! Repeated generation does NOT overwrite or conflict.")
        else:
            print(f"ERROR: Expected 4 forms, found {len(forms_total)}")
            
        print("\n=== E2E INTEGRATION TESTS COMPLETED ===")

if __name__ == "__main__":
    asyncio.run(run_e2e_tests())
