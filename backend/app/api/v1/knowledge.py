from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.question import KnowledgeNode
from app.schemas.question import KnowledgeNodeCreate, KnowledgeNodeResponse
from app.api.dependencies import RequireRole

router = APIRouter()

@router.get("/", response_model=List[KnowledgeNodeResponse])
async def get_knowledge_nodes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeNode))
    return result.scalars().all()

@router.post("/", response_model=KnowledgeNodeResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_knowledge_node(node_in: KnowledgeNodeCreate, db: AsyncSession = Depends(get_db)):
    if node_in.parent_id:
        result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_in.parent_id))
        if not result.scalars().first():
            raise HTTPException(status_code=400, detail="Parent node not found")
            
    node = KnowledgeNode(**node_in.model_dump())
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node
