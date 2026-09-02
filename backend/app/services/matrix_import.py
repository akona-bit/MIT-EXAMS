import csv
import io
from typing import Any, Dict, List, Optional
from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.question import KnowledgeNode, KnowledgeNodeParent
from app.models.exam import MatrixRule


class MatrixImportService:


    @staticmethod
    def parse_csv_content(content: str) -> List[Dict[str, str]]:
        """Parse CSV/TSV content into rows of dicts."""
        content = content.strip()
        if not content:
            return []

        sample = content[:2048]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        except csv.Error:
            dialect = csv.excel_tab
        reader = csv.reader(io.StringIO(content), dialect)
        rows = []
        for raw_parts in reader:
            parts = [part.strip() for part in raw_parts]
            if not parts or not any(parts):
                continue
            header = " ".join(parts[:4]).casefold()
            if not rows and any(word in header for word in ("topic", "chủ đề", "concept", "skill")):
                continue
            if len(parts) >= 5:
                rows.append({
                    "topic": parts[0],
                    "concept": parts[1],
                    "skill": parts[2],
                    "count": parts[3],
                    "part": parts[4],
                })
            elif len(parts) == 4:
                rows.append({
                    "topic": parts[0],
                    "concept": parts[1],
                    "skill": parts[2],
                    "count": parts[3],
                    "part": "1",
                })
            elif len(parts) == 3:
                rows.append({
                    "topic": parts[0],
                    "concept": parts[1],
                    "skill": parts[2],
                    "count": "1",
                    "part": "1",
                })
        return rows

    @staticmethod
    async def _find_or_create_node(
        db: AsyncSession, name: str, node_type: str, parent_id: Optional[int]
    ) -> KnowledgeNode:
        """Find existing node or create new one."""
        stmt = select(KnowledgeNode).where(KnowledgeNode.name == name)
        result = await db.execute(stmt)
        candidates = result.scalars().all()

        node = None
        if parent_id:
            for c in candidates:
                check = await db.execute(
                    select(KnowledgeNodeParent).where(
                        KnowledgeNodeParent.child_id == c.id,
                        KnowledgeNodeParent.parent_id == parent_id,
                        KnowledgeNodeParent.is_primary.is_(True),
                    )
                )
                if check.scalar_one_or_none():
                    node = c
                    break
        else:
            from app.models.question import KnowledgeNodeType
            for c in candidates:
                if c.node_type and c.node_type.value == node_type:
                    check = await db.execute(
                        select(KnowledgeNodeParent).where(
                            KnowledgeNodeParent.child_id == c.id,
                            KnowledgeNodeParent.is_primary.is_(True),
                        )
                    )
                    if not check.scalar_one_or_none():
                        node = c
                        break

        if not node:
            from app.models.question import KnowledgeNodeType
            type_enum = KnowledgeNodeType(node_type) if node_type in ["TOPIC", "CONCEPT", "SKILL"] else KnowledgeNodeType.SKILL
            node = KnowledgeNode(name=name, node_type=type_enum)
            db.add(node)
            await db.flush()

        return node

    @staticmethod
    async def preview_import(
        db: AsyncSession,
        content: str,
        level_ratios: Dict[int, float],
        type_ratios: Dict[str, float],
    ) -> List[Dict[str, Any]]:
        """Parse content and preview what would be imported."""
        raw_rows = MatrixImportService.parse_csv_content(content)
        preview = []

        for row in raw_rows:
            topic_name = row["topic"]
            concept_name = row["concept"]
            skill_name = row["skill"]
            try:
                count = max(0, int(row["count"]))
                part = int(row["part"])
            except (TypeError, ValueError):
                count = 0
                part = 1
            if not 1 <= part <= 4:
                part = 1
            suggestions = []

            # Try to find matching nodes
            topic_node = None
            concept_node = None
            skill_node = None

            # Find topic
            stmt = select(KnowledgeNode).where(KnowledgeNode.name == topic_name)
            result = await db.execute(stmt)
            topics = result.scalars().all()
            if topics:
                topic_node = topics[0]
                suggestions.append({"field": "topic", "message": f"Khớp topic #{topic_node.id}"})
            else:
                suggestions.append({"field": "topic", "message": f"Không tìm thấy '{topic_name}', sẽ tạo mới"})

            # Find concept under topic
            if topic_node:
                stmt = select(KnowledgeNode).where(KnowledgeNode.name == concept_name)
                result = await db.execute(stmt)
                for c in result.scalars().all():
                    check = await db.execute(
                        select(KnowledgeNodeParent).where(
                            KnowledgeNodeParent.child_id == c.id,
                            KnowledgeNodeParent.parent_id == topic_node.id,
                            KnowledgeNodeParent.is_primary.is_(True),
                        )
                    )
                    if check.scalar_one_or_none():
                        concept_node = c
                        break
                if concept_node:
                    suggestions.append({"field": "concept", "message": f"Khớp concept #{concept_node.id}"})
                else:
                    suggestions.append({"field": "concept", "message": f"Không tìm thấy '{concept_name}' under '{topic_name}', sẽ tạo mới"})

            # Find skill under concept
            if concept_node:
                stmt = select(KnowledgeNode).where(KnowledgeNode.name == skill_name)
                result = await db.execute(stmt)
                for s in result.scalars().all():
                    check = await db.execute(
                        select(KnowledgeNodeParent).where(
                            KnowledgeNodeParent.child_id == s.id,
                            KnowledgeNodeParent.parent_id == concept_node.id,
                            KnowledgeNodeParent.is_primary.is_(True),
                        )
                    )
                    if check.scalar_one_or_none():
                        skill_node = s
                        break
                if skill_node:
                    suggestions.append({"field": "skill", "message": f"Khớp skill #{skill_node.id}"})
                else:
                    suggestions.append({"field": "skill", "message": f"Không tìm thấy '{skill_name}' under '{concept_name}', sẽ tạo mới"})

            node_id = skill_node.id if skill_node else (concept_node.id if concept_node else (topic_node.id if topic_node else None))

            # Distribute each level independently by type. Every row keeps
            # exactly its declared count, even when ratios do not sum to 1.
            from app.services.matrix.allocator import _largest_remainder
            
            distributed_rules = []
            effective_level_ratios = level_ratios or {1: 1.0}
            effective_type_ratios = type_ratios or {"SINGLE_CHOICE": 1.0}
            level_counts = _largest_remainder(effective_level_ratios, count)
            for level, level_count in level_counts.items():
                type_counts = _largest_remainder(effective_type_ratios, level_count)
                for question_type, question_count in type_counts.items():
                    if question_count > 0:
                        distributed_rules.append({
                            "level": level,
                            "question_type": question_type,
                            "count": question_count,
                            "part": part,
                        })
            if not distributed_rules and count > 0:
                distributed_rules.append({
                    "level": 1,
                    "question_type": list(type_ratios.keys())[0] if type_ratios else "SINGLE_CHOICE",
                    "count": count,
                    "part": part,
                })

            preview.append({
                "topic": topic_name,
                "concept": concept_name,
                "skill": skill_name,
                "original_count": count,
                "status": "match" if node_id else "new",
                "node_id": node_id,
                "suggestions": suggestions,
                "distributed_rules": distributed_rules,
            })

        return preview

    @staticmethod
    async def execute_import(
        db: AsyncSession,
        matrix_id: int,
        confirmed_rows: List[Dict[str, Any]],
        strategy: str,
    ) -> int:
        """Execute the import: create nodes if needed, add rules to matrix."""
        from app.models.exam import MatrixRule

        if strategy not in {"add", "replace"}:
            raise ValueError("strategy must be 'add' or 'replace'")

        if strategy == "replace":
            await db.execute(delete(MatrixRule).where(MatrixRule.matrix_id == matrix_id))
            await db.flush()

        total_added = 0

        for row in confirmed_rows:
            topic_name = row.get("topic", "")
            concept_name = row.get("concept", "")
            skill_name = row.get("skill", "")

            # Find or create nodes
            topic_node = await MatrixImportService._find_or_create_node(db, topic_name, "TOPIC", None)

            concept_node = None
            if concept_name:
                # Find concept under topic
                stmt = select(KnowledgeNode).where(KnowledgeNode.name == concept_name)
                result = await db.execute(stmt)
                for c in result.scalars().all():
                    check = await db.execute(
                        select(KnowledgeNodeParent).where(
                            KnowledgeNodeParent.child_id == c.id,
                            KnowledgeNodeParent.parent_id == topic_node.id,
                            KnowledgeNodeParent.is_primary.is_(True),
                        )
                    )
                    if check.scalar_one_or_none():
                        concept_node = c
                        break
                if not concept_node:
                    concept_node = await MatrixImportService._find_or_create_node(
                        db, concept_name, "CONCEPT", topic_node.id
                    )
                    from app.services.knowledge_service import KnowledgeService
                    await KnowledgeService.add_relation(db, concept_node.id, topic_node.id, is_primary=True)

            skill_node = None
            if skill_name and concept_node:
                stmt = select(KnowledgeNode).where(KnowledgeNode.name == skill_name)
                result = await db.execute(stmt)
                for s in result.scalars().all():
                    check = await db.execute(
                        select(KnowledgeNodeParent).where(
                            KnowledgeNodeParent.child_id == s.id,
                            KnowledgeNodeParent.parent_id == concept_node.id,
                            KnowledgeNodeParent.is_primary.is_(True),
                        )
                    )
                    if check.scalar_one_or_none():
                        skill_node = s
                        break
                if not skill_node:
                    skill_node = await MatrixImportService._find_or_create_node(
                        db, skill_name, "SKILL", concept_node.id
                    )
                    from app.services.knowledge_service import KnowledgeService
                    await KnowledgeService.add_relation(db, skill_node.id, concept_node.id, is_primary=True)

            target_node_id = skill_node.id if skill_node else (concept_node.id if concept_node else topic_node.id)

            # Create rules from distributed_rules
            for rule_data in row.get("distributed_rules", []):
                count = int(rule_data.get("count", 0))
                if count <= 0:
                    continue
                filters = (
                    MatrixRule.matrix_id == matrix_id,
                    MatrixRule.knowledge_node_id == target_node_id,
                    MatrixRule.question_type == rule_data.get("question_type", "SINGLE_CHOICE"),
                    MatrixRule.level == rule_data.get("level", 1),
                    MatrixRule.part == rule_data.get("part", 1),
                )
                if strategy == "add":
                    existing = (await db.execute(select(MatrixRule).where(and_(*filters)))).scalar_one_or_none()
                    if existing:
                        existing.count += count
                    else:
                        db.add(MatrixRule(
                            matrix_id=matrix_id,
                            knowledge_node_id=target_node_id,
                            question_type=rule_data.get("question_type", "SINGLE_CHOICE"),
                            level=rule_data.get("level", 1),
                            count=count,
                            part=rule_data.get("part", 1),
                        ))
                else:
                    db.add(MatrixRule(
                        matrix_id=matrix_id,
                        knowledge_node_id=target_node_id,
                        question_type=rule_data.get("question_type", "SINGLE_CHOICE"),
                        level=rule_data.get("level", 1),
                        count=count,
                        part=rule_data.get("part", 1),
                    ))
                total_added += count

        await db.commit()
        return total_added
