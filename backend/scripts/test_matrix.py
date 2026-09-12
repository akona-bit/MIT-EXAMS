import asyncio
import os
import sys

# Setup environment to run FastAPI offline
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.db.database import AsyncSessionLocal
from app.api.v1.matrix import create_matrix
from app.schemas.exam import MatrixCreate, MatrixRuleCreate
from fastapi import Request

async def main():
    async with AsyncSessionLocal() as db:
        # Construct dummy request payload
        matrix_in = MatrixCreate(
            name="Test Matrix",
            description="Testing create_matrix",
            rules=[
                MatrixRuleCreate(
                    knowledge_node_id=1,
                    question_type=None,
                    level=None,
                    count=1,
                    part=1
                )
            ],
            groups=[]
        )
        # Dummy request object (since create_matrix uses Request for analytics)
        class DummyApp:
            state = type("State", (), {})()
        class DummyRequest:
            app = DummyApp()
            
        request = DummyRequest()
        
        try:
            result = await create_matrix(request, matrix_in, db)
            print("SUCCESS:")
            print(result)
        except Exception as e:
            print("ERROR IN CREATE_MATRIX:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
