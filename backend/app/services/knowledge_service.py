from typing import List, Optional, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, func
from app.models.question import KnowledgeNode, Question, QuestionStatus

class KnowledgeService:
    @staticmethod
    async def is_leaf(db: AsyncSession, node_id: int) -> bool:
        """Check if a node is a leaf using the is_leaf column."""
        stmt = select(KnowledgeNode.is_leaf).where(KnowledgeNode.id == node_id)
        result = await db.execute(stmt)
        val = result.scalar()
        return val if val is not None else True

    @staticmethod
    async def count_approved_questions(db: AsyncSession, node_id: int) -> int:
        """Counts the number of APPROVED questions attached to this node."""
        stmt = select(func.count()).select_from(Question).where(
            and_(
                Question.knowledge_node_id == node_id,
                Question.status == QuestionStatus.APPROVED
            )
        )
        result = await db.execute(stmt)
        return result.scalar() or 0

    @staticmethod
    async def update_is_leaf(db: AsyncSession, node_id: int):
        """Update is_leaf flag: True if node has no children OR no approved questions on children."""
        # Check if node has any children
        children_stmt = select(func.count()).select_from(KnowledgeNode).where(KnowledgeNode.parent_id == node_id)
        children_count = (await db.execute(children_stmt)).scalar() or 0

        # Check if node has approved questions
        question_count = await KnowledgeService.count_approved_questions(db, node_id)

        has_question_children = False
        if children_count > 0:
            # Check if any child has approved questions
            child_ids_stmt = select(KnowledgeNode.id).where(KnowledgeNode.parent_id == node_id)
            child_ids = (await db.execute(child_ids_stmt)).scalars().all()
            for cid in child_ids:
                cnt = await KnowledgeService.count_approved_questions(db, cid)
                if cnt > 0:
                    has_question_children = True
                    break

        is_leaf = children_count == 0 or not has_question_children
        await db.execute(
            update(KnowledgeNode).where(KnowledgeNode.id == node_id).values(is_leaf=is_leaf)
        )

    @staticmethod
    async def get_all_descendant_leaves(db: AsyncSession, node_ids: List[int]) -> List[int]:
        """
        Finds all descendant leaf nodes for a given set of starting nodes.
        Traverses tree relations.
        """
        if not node_ids:
            return []

        visited = set()
        queue = list(node_ids)
        all_descendants = set()

        while queue:
            current_id = queue.pop(0)
            if current_id in visited:
                continue
            visited.add(current_id)

            # Find all children
            stmt = select(KnowledgeNode.id).where(KnowledgeNode.parent_id == current_id)
            result = await db.execute(stmt)
            children = result.scalars().all()

            for child_id in children:
                all_descendants.add(child_id)
                queue.append(child_id)

        # Filter to keep only leaf nodes
        leaf_nodes = []
        for node_id in all_descendants:
            if await KnowledgeService.is_leaf(db, node_id):
                leaf_nodes.append(node_id)

        return leaf_nodes

    @staticmethod
    async def check_for_cycle(db: AsyncSession, child_id: int, parent_id: int) -> Tuple[bool, Optional[List[int]]]:
        """
        Checks if setting parent_id on child_id creates a cycle.
        A cycle is created if the parent is reachable from the child (i.e., parent is a descendant of child).
        """
        if child_id == parent_id:
            return True, [child_id, parent_id]

        # BFS to find if parent_id is reachable from child_id
        visited = {child_id}
        queue = [(child_id, [child_id])]

        while queue:
            current_id, path = queue.pop(0)

            stmt = select(KnowledgeNode.id).where(KnowledgeNode.parent_id == current_id)
            result = await db.execute(stmt)
            children = result.scalars().all()

            for child in children:
                if child == parent_id:
                    return True, path + [child]
                if child not in visited:
                    visited.add(child)
                    queue.append((child, path + [child]))

        return False, None

    @staticmethod
    async def calculate_path_code(db: AsyncSession, node_id: int) -> str:
        """
        Calculates the path_code by traversing the parent chain upwards to the root.
        Path code = joined short_codes of parents + current node's short_code.
        """
        path_nodes = []
        current_id = node_id

        while current_id:
            node_res = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == current_id))
            node = node_res.scalar_one_or_none()
            if not node:
                break

            path_nodes.append(node.short_code or f"N{node.id}")
            current_id = node.parent_id

        return "/".join(reversed(path_nodes))

    @staticmethod
    async def update_node_path_codes(db: AsyncSession, node_id: int):
        """
        Recursively updates path_codes for a node and all its descendants.
        """
        # Update current node
        new_path = await KnowledgeService.calculate_path_code(db, node_id)
        await db.execute(
            update(KnowledgeNode)
            .where(KnowledgeNode.id == node_id)
            .values(path_code=new_path)
        )

        # Update all descendants
        stmt = select(KnowledgeNode.id).where(KnowledgeNode.parent_id == node_id)
        result = await db.execute(stmt)
        children = result.scalars().all()

        for child_id in children:
            await KnowledgeService.update_node_path_codes(db, child_id)
