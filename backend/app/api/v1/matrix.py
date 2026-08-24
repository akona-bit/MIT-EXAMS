from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.exam import Matrix, MatrixRule
from app.schemas.exam import MatrixCreate, MatrixResponse
from app.api.dependencies import RequireRole

router = APIRouter()

@router.get("/")
async def get_matrices(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    total_result = await db.execute(select(func.count()).select_from(Matrix))
    total = total_result.scalar_one()
    result = await db.execute(
        select(Matrix)
        .options(selectinload(Matrix.rules))
        .order_by(Matrix.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return {"items": result.scalars().all(), "total": total, "page": (skip // limit) + 1 if limit else 1, "size": limit}


@router.get("/{matrix_id}", response_model=MatrixResponse)
async def get_matrix(matrix_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Matrix).options(selectinload(Matrix.rules)).where(Matrix.id == matrix_id)
    )
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")
    return matrix

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


@router.put("/{matrix_id}", response_model=MatrixResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def update_matrix(matrix_id: int, matrix_in: MatrixCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Matrix).options(selectinload(Matrix.rules)).where(Matrix.id == matrix_id)
    )
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")

    matrix.name = matrix_in.name
    matrix.description = matrix_in.description
    for rule in list(matrix.rules):
        await db.delete(rule)
    await db.flush()

    for r in matrix_in.rules:
        db.add(MatrixRule(
            matrix_id=matrix.id,
            knowledge_node_id=r.knowledge_node_id,
            question_type=r.question_type,
            level=r.level,
            count=r.count,
            part=r.part
        ))

    await db.commit()
    result = await db.execute(select(Matrix).options(selectinload(Matrix.rules)).where(Matrix.id == matrix.id))
    return result.scalars().first()


@router.delete("/{matrix_id}", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def delete_matrix(matrix_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Matrix).where(Matrix.id == matrix_id))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")
    await db.delete(matrix)
    await db.commit()
    return {"message": "Matrix deleted"}
