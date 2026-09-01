from typing import List, Optional, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, func
from app.models.question import KnowledgeNode, KnowledgeNodeParent, Question

class KnowledgeService:
    @staticmethod
    async def is_leaf(db: AsyncSession, node_id: int) -> bool:
        """Check if a node is a leaf (has no children in the DAG)."""
        stmt = select(func.count()).select_from(KnowledgeNodeParent).where(KnowledgeNodeParent.parent_id == node_id)
        result = await db.execute(stmt)
        return (result.scalar() or 0) == 0

    @staticmethod
    async def count_approved_questions(db: AsyncSession, node_id: int) -> int:
        """Counts the number of APPROVED questions attached to this node."""
        from app.models.question import Question, QuestionStatus
        stmt = select(func.count()).select_from(Question).where(
            and_(Question.knowledge_node_id == node_id, Question.status == QuestionStatus.APPROVED)
        )
        result = await db.execute(stmt)
        return result.scalar() or 0

    @staticmethod
    async def get_all_descendant_leaves(db: AsyncSession, node_ids: List[int]) -> List[int]:
        """
        Finds all descendant leaf nodes for a given set of starting nodes.
        Traverses all relations in the DAG.
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
            stmt = select(KnowledgeNodeParent.child_id).where(KnowledgeNodeParent.parent_id == current_id)
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
        Checks if adding a relation (parent -> child) creates a cycle.
        A cycle is created if the parent is reachable from the child through any existing relation.
        Returns (has_cycle, path_if_cycle).
        """
        if child_id == parent_id:
            return True, [child_id, parent_id]

        # BFS to find if parent_id is reachable from child_id
        visited = {child_id}
        queue = [(child_id, [child_id])]

        while queue:
            current_id, path = queue.pop(0)

            # Find all children of the current node
            stmt = select(KnowledgeNodeParent.child_id).where(KnowledgeNodeParent.parent_id == current_id)
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
        Calculates the path_code by traversing the primary parent chain upwards to the root.
        Path code = joined short_codes of primary parents + current node's short_code.
        """
        path_nodes = []
        current_id = node_id

        while current_id:
            # Get the node itself to get its short_code
            node_res = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == current_id))
            node = node_res.scalar_one_or_none()
            if not node:
                break

            path_nodes.append(node.short_code or f"N{node.id}")

            # Find the primary parent
            parent_res = await db.execute(
                select(KnowledgeNodeParent.parent_id)
                .where(and_(KnowledgeNodeParent.child_id == current_id, KnowledgeNodeParent.is_primary == True))
            )
            current_id = parent_res.scalar_one_or_none()

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
        stmt = select(KnowledgeNodeParent.child_id).where(KnowledgeNodeParent.parent_id == node_id)
        result = await db.execute(stmt)
        children = result.scalars().all()

        for child_id in children:
            await KnowledgeService.update_node_path_codes(db, child_id)

    @staticmethod
    async def add_relation(db: AsyncSession, child_id: int, parent_id: int, is_primary: bool = False):
        """Adds a DAG relation with cycle detection and primary parent constraint."""
        # 1. Cycle Detection
        has_cycle, path = await KnowledgeService.check_for_cycle(db, child_id, parent_id)
        if has_cycle:
            path_str = " -> ".join(map(str, path))
            raise ValueError(f"Không thể thêm quan hệ này — sẽ tạo vòng lặp qua đường {path_str}")

        # 2. Primary Parent Constraint
        if is_primary:
            # Remove existing primary parent for this child
            await db.execute(
                update(KnowledgeNodeParent)
                .where(and_(KnowledgeNodeParent.child_id == child_id, KnowledgeNodeParent.is_primary == True))
                .values(is_primary=False)
            )

        # 3. Create Relation
        # Check if relation already exists
        stmt = select(KnowledgeNodeParent).where(
            and_(KnowledgeNodeParent.child_id == child_id, KnowledgeNodeParent.parent_id == parent_id)
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()

        if existing:
            if is_primary:
                existing.is_primary = True
        else:
            new_rel = KnowledgeNodeParent(child_id=child_id, parent_id=parent_id, is_primary=is_primary)
            db.add(new_rel)

        # 4. Update path codes if primary parent changed
        if is_primary:
            await KnowledgeService.update_node_path_codes(db, child_id)

    @staticmethod
    async def remove_relation(db: AsyncSession, child_id: int, parent_id: int):
        """Removes a relation and handles primary parent reassignment."""
        stmt = select(KnowledgeNodeParent).where(
            and_(KnowledgeNodeParent.child_id == child_id, KnowledgeNodeParent.parent_id == parent_id)
        )
        rel = (await db.execute(stmt)).scalar_one_or_none()
        if not rel:
            return

        was_primary = rel.is_primary
        await db.delete(rel)

        if was_primary:
            # Reassign another parent as primary if available
            stmt_others = select(KnowledgeNodeParent).where(KnowledgeNodeParent.child_id == child_id)
            others = (await db.execute(stmt_others)).scalars().all()
            if others:
                # Simple logic: first available becomes primary
                others[0].is_primary = True
                await KnowledgeService.update_node_path_codes(db, child_id)
            else:
                # No parents left, clear path_code or set as root
                await db.execute(
                    update(KnowledgeNode)
                    .where(KnowledgeNode.id == child_id)
                    .values(path_code=None) # or calculate based on root
                )
                # We should still try to update descendants because their path started here
                # But path_code calculation handle's root cases.
                # We'll trigger a full update for descendants.
                await KnowledgeService._trigger_descendants_path_update(db, child_id)

    @staticmethod
    async def _trigger_descendants_path_update(db: AsyncSession, node_id: int):
        stmt = select(KnowledgeNodeParent.child_id).where(KnowledgeNodeParent.parent_id == node_id)
        result = await db.execute(stmt)
        children = result.scalars().all()
        for child_id in children:
            await KnowledgeService.update_node_path_codes(db, child_id)
