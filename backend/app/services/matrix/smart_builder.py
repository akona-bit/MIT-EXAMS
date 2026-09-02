from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.question import KnowledgeNode, KnowledgeNodeParent
from app.services.knowledge_service import KnowledgeService
from app.services.matrix.allocator import _largest_remainder
from app.schemas.exam import (
    SmartMatrixLeafNode, 
    SmartMatrixProposedSkill, 
    SmartMatrixSkillAllocation
)
from app.models.exam import Matrix, MatrixRule

class SmartBuilderService:
    @staticmethod
    async def get_leaves(db: AsyncSession, node_ids: List[int]) -> tuple[List[SmartMatrixLeafNode], int]:
        unique_ids = list(set(node_ids))
        leaf_ids = await KnowledgeService.get_all_descendant_leaves(db, unique_ids)
        
        for nid in unique_ids:
            if await KnowledgeService.is_leaf(db, nid) and nid not in leaf_ids:
                leaf_ids.append(nid)
        leaf_ids = list(set(leaf_ids))
        
        if not leaf_ids:
            return [], 0
            
        leaves = []
        total_count = 0
        
        for lid in leaf_ids:
            node = (await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == lid))).scalars().first()
            if not node: continue
            
            q_count = await KnowledgeService.count_approved_questions(db, lid)
            total_count += q_count
            
            path_parts = await SmartBuilderService._resolve_node_path(db, lid)
            
            topic_name = path_parts[0] if len(path_parts) >= 1 else None
            concept_name = path_parts[1] if len(path_parts) >= 2 else None
            
            leaves.append(SmartMatrixLeafNode(
                node_id=lid,
                name=node.name,
                node_type=node.node_type.value if node.node_type else "SKILL",
                path=" > ".join(path_parts),
                question_count=q_count,
                topic_name=topic_name,
                concept_name=concept_name,
            ))
            
        leaves.sort(key=lambda x: x.question_count, reverse=True)
        return leaves, total_count

    @staticmethod
    async def _resolve_node_path(db: AsyncSession, node_id: int) -> List[str]:
        path = []
        current_id = node_id
        visited = set()
        
        while current_id and current_id not in visited:
            visited.add(current_id)
            node = (await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == current_id))).scalars().first()
            if not node: break
            path.append(node.name)
            
            parent_id = (await db.execute(
                select(KnowledgeNodeParent.parent_id)
                .where(and_(
                    KnowledgeNodeParent.child_id == current_id,
                    KnowledgeNodeParent.is_primary == True
                ))
            )).scalar_one_or_none()
            current_id = parent_id
            
        return list(reversed(path))

    @staticmethod
    async def propose_distribution(db: AsyncSession, node_ids: List[int], total_questions: int) -> tuple[List[SmartMatrixProposedSkill], int, int]:
        unique_ids = list(set(node_ids))
        leaf_ids = await KnowledgeService.get_all_descendant_leaves(db, unique_ids)
        
        for nid in unique_ids:
            if await KnowledgeService.is_leaf(db, nid) and nid not in leaf_ids:
                leaf_ids.append(nid)
        leaf_ids = list(set(leaf_ids))
        
        skill_data = []
        for lid in leaf_ids:
            node = (await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == lid))).scalars().first()
            if not node: continue
            
            q_count = await KnowledgeService.count_approved_questions(db, lid)
            path_parts = await SmartBuilderService._resolve_node_path(db, lid)
            skill_data.append({
                "node_id": lid,
                "name": node.name,
                "path": " > ".join(path_parts),
                "question_count": q_count,
            })
            
        skills_with_questions = [s for s in skill_data if s["question_count"] > 0]
        skills_without_questions = [s for s in skill_data if s["question_count"] == 0]
        total_available = sum(s["question_count"] for s in skills_with_questions)
        
        if total_available > 0 and skills_with_questions:
            ratio_dict = {i: s["question_count"] for i, s in enumerate(skills_with_questions)}
            allocated_dict = _largest_remainder(ratio_dict, total_questions)
            for i, s in enumerate(skills_with_questions):
                s["proposed_count"] = allocated_dict.get(i, 0)
        else:
            for s in skills_with_questions:
                s["proposed_count"] = 0
                
        for s in skills_without_questions:
            s["proposed_count"] = 0
            
        all_skills = skills_with_questions + skills_without_questions
        all_skills.sort(key=lambda x: x["proposed_count"], reverse=True)
        
        total_proposed = sum(s["proposed_count"] for s in all_skills)
        
        skills = []
        for s in all_skills:
            pct = (s["proposed_count"] / total_proposed * 100) if total_proposed > 0 else 0
            skills.append(SmartMatrixProposedSkill(
                node_id=s["node_id"],
                name=s["name"],
                path=s["path"],
                question_count=s["question_count"],
                proposed_count=s["proposed_count"],
                percentage=round(pct, 1),
                has_warning=s["proposed_count"] > s["question_count"],
            ))
            
        return skills, total_proposed, total_available
        
    @staticmethod
    async def confirm_matrix(db: AsyncSession, name: str, description: Optional[str], subject: Optional[str],
                             allocations: List[SmartMatrixSkillAllocation], level_ratios: dict, type_ratios: dict) -> Matrix:
        matrix = Matrix(name=name, description=description, subject=subject)
        db.add(matrix)
        await db.flush()
        
        for alloc in allocations:
            if alloc.proposed_count <= 0:
                continue
                
            level_counts = _largest_remainder(level_ratios, alloc.proposed_count)
            for level_val, level_count in level_counts.items():
                if level_count <= 0: continue
                
                type_counts = _largest_remainder(type_ratios, level_count)
                for type_name, type_count in type_counts.items():
                    if type_count <= 0: continue
                    
                    db.add(MatrixRule(
                        matrix_id=matrix.id,
                        knowledge_node_id=alloc.node_id,
                        question_type=type_name,
                        level=level_val,
                        count=type_count,
                        part=1,
                    ))
                    
        await db.flush()
        return matrix
