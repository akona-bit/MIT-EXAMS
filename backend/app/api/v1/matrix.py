from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.exam import Matrix, MatrixRule
from app.schemas.exam import MatrixCreate, MatrixResponse
from app.api.dependencies import RequireRole

router = APIRouter()

@router.get("/", response_model=List[MatrixResponse])
async def get_matrices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Matrix).options(selectinload(Matrix.rules)))
    return result.scalars().all()

@router.post("/", response_model=MatrixResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_matrix(matrix_in: MatrixCreate, db: AsyncSession = Depends(get_db)):
    matrix = Matrix(name=matrix_in.name, description=matrix_in.description)
    db.add(matrix)
    await db.flush()
    
    for r in matrix_in.rules:
        rule = MatrixRule(
            matrix_id=matrix.id,
            knowledge_node_id=r.knowledge_node_id,
            question_type=r.question_type,
            level=r.level,
            count=r.count,
            part=r.part
        )
        db.add(rule)
        
    await db.commit()
    await db.refresh(matrix)
    
    # Reload with rules
    result = await db.execute(select(Matrix).options(selectinload(Matrix.rules)).where(Matrix.id == matrix.id))
    return result.scalars().first()
