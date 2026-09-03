from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from sqlalchemy.sql import func

from app.db.database import get_db
from app.models.question import KnowledgeNode, KnowledgeNodeLink, Question, KnowledgeNodeParent
from app.schemas.question import KnowledgeNodeCreate, KnowledgeNodeResponse, KnowledgeNodeUpdate, GraphResponse, GraphNode, GraphEdge
from app.api.dependencies import RequireRole
from app.core.analytics import capture
from app.services.knowledge_service import KnowledgeService

router = APIRouter()

LEVEL_NAMES = ("TOPIC", "CONCEPT", "SKILL", "SUB_SKILL")


def _level_name(depth: int) -> str:
    return LEVEL_NAMES[depth] if depth < len(LEVEL_NAMES) else "SUB_SKILL"


def _build_path(node_id: int, nodes_by_id: Dict[int, KnowledgeNode], primary_parents: Dict[int, Optional[int]]) -> str:
    names: List[str] = []
    current_id = node_id
    while current_id:
        node = nodes_by_id.get(current_id)
        if not node:
            break
        names.append(node.name)
        current_id = primary_parents.get(current_id)
    return "/".join(reversed(names))


def _build_tree_node(
    node: KnowledgeNode,
    children_by_primary_parent: Dict[Optional[int], List[KnowledgeNode]],
    nodes_by_id: Dict[int, KnowledgeNode],
    question_count_by_node: Dict[int, int],
    primary_parents: Dict[int, Optional[int]],
    depth: int = 0,
) -> Dict[str, Any]:
    children = [
        _build_tree_node(child, children_by_primary_parent, nodes_by_id, question_count_by_node, primary_parents, depth + 1)
        for child in sorted(children_by_primary_parent.get(node.id, []), key=lambda item: item.name.lower())
    ]
    return {
        "id": node.id,
        "name": node.name,
        "description": node.description,
        "parent_id": primary_parents.get(node.id),
        "level": _level_name(depth),
        "path": _build_path(node.id, nodes_by_id, primary_parents),
        "question_count": question_count_by_node.get(node.id, 0),
        "children": children,
    }


async def _load_knowledge_state(db: AsyncSession):
    node_result = await db.execute(select(KnowledgeNode))
    nodes = list(node_result.scalars().all())
    nodes_by_id = {node.id: node for node in nodes}

    # DAG relations
    rel_result = await db.execute(select(KnowledgeNodeParent))
    relations = rel_result.scalars().all()

    primary_parents: Dict[int, Optional[int]] = {}
    children_by_primary_parent: Dict[Optional[int], List[KnowledgeNode]] = {}
    all_parents: Dict[int, List[int]] = {}

    for rel in relations:
        if rel.is_primary:
            primary_parents[rel.child_id] = rel.parent_id
        all_parents.setdefault(rel.child_id, []).append(rel.parent_id)

    for node in nodes:
        p_id = primary_parents.get(node.id)
        children_by_primary_parent.setdefault(p_id, []).append(node)

    from app.models.question import QuestionSkillTag
    question_result = await db.execute(select(QuestionSkillTag.question_id, QuestionSkillTag.knowledge_node_id))
    question_rows = question_result.all()
    question_count_by_node: Dict[int, int] = {}
    for _, knowledge_node_id in question_rows:
        question_count_by_node[knowledge_node_id] = question_count_by_node.get(knowledge_node_id, 0) + 1

    return nodes, nodes_by_id, children_by_primary_parent, question_count_by_node, primary_parents, all_parents

@router.get("/", response_model=List[KnowledgeNodeResponse])
async def get_knowledge_nodes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeNode))
    return result.scalars().all()


@router.get("/tree")
async def get_knowledge_tree(subject: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_primary_parent, question_count_by_node, primary_parents, all_parents = await _load_knowledge_state(db)

    roots = [node for node in nodes if primary_parents.get(node.id) is None]
    if subject:
        roots = [node for node in roots if node.subject == subject]

    return [
        _build_tree_node(root, children_by_primary_parent, nodes_by_id, question_count_by_node, primary_parents)
        for root in sorted(roots, key=lambda item: item.name.lower())
    ]


@router.get("/{node_id}/context")
async def get_knowledge_node_context(node_id: int, db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_primary_parent, question_count_by_node, primary_parents, all_parents = await _load_knowledge_state(db)

    node = nodes_by_id.get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node không tồn tại")

    # Build breadcrumb (primary path)
    breadcrumb = []
    current_id = node.id
    while current_id:
        curr_node = nodes_by_id.get(current_id)
        if not curr_node:
            break
        breadcrumb.insert(0, {
            "id": curr_node.id,
            "name": curr_node.name,
            "node_type": curr_node.node_type.value.lower() if curr_node.node_type else "skill"
        })
        current_id = primary_parents.get(current_id)

    # Build siblings (based on primary parent)
    siblings_list = []
    p_id = primary_parents.get(node.id)
    if p_id:
        sibs = children_by_primary_parent.get(p_id, [])
    else:
        sibs = [n for n in nodes if primary_parents.get(n.id) is None and n.subject == node.subject]

    for sib in sibs:
        if sib.id != node.id:
            siblings_list.append({
                "id": sib.id,
                "name": sib.name,
                "question_count": question_count_by_node.get(sib.id, 0)
            })

    return {
        "id": node.id,
        "name": node.name,
        "node_type": node.node_type.value.lower() if node.node_type else "skill",
        "description": node.description,
        "breadcrumb": breadcrumb,
        "siblings": siblings_list,
        "question_count": question_count_by_node.get(node.id, 0),
        "secondary_parents": [
            {"id": pid, "name": nodes_by_id[pid].name}
            for pid in all_parents.get(node.id, []) if pid != primary_parents.get(node.id)
        ]
    }


@router.get("/graph")
async def get_knowledge_graph(db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_primary_parent, question_count_by_node, primary_parents, all_parents = await _load_knowledge_state(db)
    graph_nodes = []
    graph_edges = []

    for node in nodes:
        graph_nodes.append({
            "id": f"knowledge:{node.id}",
            "entity_id": node.id,
            "label": node.name,
            "type": node.node_type.value if node.node_type else "SKILL",
            "path": _build_path(node.id, nodes_by_id, primary_parents),
            "question_count": question_count_by_node.get(node.id, 0),
            "description": node.description,
            "note": node.note,
        })

        # DAG Edges (All relations)
        for pid in all_parents.get(node.id, []):
            is_primary = (pid == primary_parents.get(node.id))
            graph_edges.append({
                "id": f"knowledge:{pid}->knowledge:{node.id}",
                "source": f"knowledge:{pid}",
                "target": f"knowledge:{node.id}",
                "type": "PARENT_OF",
                "is_primary": is_primary,
            })

    # Load manual links
    link_result = await db.execute(select(KnowledgeNodeLink))
    manual_links = link_result.scalars().all()
    for link in manual_links:
        graph_edges.append({
            "id": f"manual:{link.id}",
            "source": f"knowledge:{link.source_id}",
            "target": f"knowledge:{link.target_id}",
            "type": "MANUAL",
            "label": link.label,
            "link_id": link.id,
        })

    return {"nodes": graph_nodes, "edges": graph_edges}

@router.post("/", response_model=KnowledgeNodeResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_knowledge_node(request: Request, node_in: KnowledgeNodeCreate, db: AsyncSession = Depends(get_db)):
    if node_in.parent_id:
        result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_in.parent_id))
        if not result.scalars().first():
            raise HTTPException(status_code=400, detail="Parent node not found")

    # Exclude parent_id from node creation — use DAG table instead
    node_data = node_in.model_dump(exclude={"parent_id"})
    node = KnowledgeNode(**node_data)
    db.add(node)
    await db.commit()
    await db.refresh(node)

    if node_in.parent_id:
        await KnowledgeService.add_relation(db, node.id, node_in.parent_id, is_primary=True)
        await db.commit()

    has_parent = False
    if node_in.parent_id:
        has_parent = True
    capture(request, "knowledge_node_created", {"knowledge_node_id": node.id, "has_parent": has_parent})
    return node

@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def delete_knowledge_node(
    request: Request,
    node_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_id))
    node = result.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Node không tồn tại")

    # Bulk delete: DAG relations, manual links, and the node in one go
    from app.models.question import KnowledgeNodeLink
    await db.execute(
        delete(KnowledgeNodeLink).where(
            (KnowledgeNodeLink.source_id == node_id) | (KnowledgeNodeLink.target_id == node_id)
        )
    )
    await db.execute(
        delete(KnowledgeNodeParent).where(
            (KnowledgeNodeParent.parent_id == node_id) | (KnowledgeNodeParent.child_id == node_id)
        )
    )
    await db.delete(node)
    await db.commit()
    capture(request, "knowledge_node_deleted", {"node_id": node_id})
    return None

@router.patch("/{node_id}", response_model=KnowledgeNodeResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def update_knowledge_node(
    request: Request,
    node_id: int,
    node_in: KnowledgeNodeUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_id))
    node = result.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Node không tồn tại")

    if node_in.parent_id is not None:
        if node_in.parent_id == node_id:
            raise HTTPException(status_code=400, detail="Không thể trỏ parent vào chính nó")
        parent_result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_in.parent_id))
        parent_node = parent_result.scalars().first()
        if not parent_node:
            raise HTTPException(status_code=404, detail="Parent node không tồn tại")

    # Exclude parent_id — handled via DAG table, not old column
    update_data = node_in.model_dump(exclude_unset=True, exclude={"parent_id"})
    for key, value in update_data.items():
        setattr(node, key, value)

    if node_in.parent_id is not None:
        try:
            await KnowledgeService.add_relation(db, node_id, node_in.parent_id, is_primary=True)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    await db.commit()
    await db.refresh(node)
    capture(request, "knowledge_node_updated", {"node_id": node.id, "fields": list(update_data.keys())})
    return node


# --- Manual Link endpoints ---

from pydantic import BaseModel

class ManualLinkCreate(BaseModel):
    source_id: int
    target_id: int
    label: Optional[str] = None

@router.post("/links", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_manual_link(request: Request, data: ManualLinkCreate, db: AsyncSession = Depends(get_db)):
    # Validate both nodes exist
    for nid in (data.source_id, data.target_id):
        r = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == nid))
        if not r.scalars().first():
            raise HTTPException(status_code=404, detail=f"Node {nid} không tồn tại")
    if data.source_id == data.target_id:
        raise HTTPException(status_code=400, detail="Không thể tạo link tới chính nó")
    # Check duplicate
    dup = await db.execute(
        select(KnowledgeNodeLink).where(
            ((KnowledgeNodeLink.source_id == data.source_id) & (KnowledgeNodeLink.target_id == data.target_id)) |
            ((KnowledgeNodeLink.source_id == data.target_id) & (KnowledgeNodeLink.target_id == data.source_id))
        )
    )
    if dup.scalars().first():
        raise HTTPException(status_code=409, detail="Link này đã tồn tại")
    link = KnowledgeNodeLink(source_id=data.source_id, target_id=data.target_id, label=data.label)
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return {"id": link.id, "source_id": link.source_id, "target_id": link.target_id, "label": link.label}

@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def delete_manual_link(link_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeNodeLink).where(KnowledgeNodeLink.id == link_id))
    link = result.scalars().first()
    if not link:
        raise HTTPException(status_code=404, detail="Link không tồn tại")
    await db.delete(link)
    await db.commit()

@router.get("/graph", response_model=GraphResponse)
async def get_knowledge_graph(subject: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """
    Returns the knowledge graph data structure suitable for visualization (nodes and edges).
    Includes hierarchical edges (KnowledgeNodeParent) and cross-links (KnowledgeNodeLink).
    """
    # 1. Load nodes and hierarchical edges
    nodes, nodes_by_id, children_by_primary_parent, question_count_by_node, primary_parents, all_parents = await _load_knowledge_state(db)
    
    # Optional filtering by subject (only keep nodes in that subject tree)
    if subject:
        # Re-filter nodes to only include those in the subject's tree
        subject_nodes = set()
        for node in nodes:
            if node.subject == subject:
                subject_nodes.add(node.id)
                # Include all its descendants too
                queue = [node.id]
                while queue:
                    curr = queue.pop(0)
                    children = [c.id for c in children_by_primary_parent.get(curr, [])]
                    subject_nodes.update(children)
                    queue.extend(children)
        
        # Also, include ancestors so the tree is complete up to the roots
        ancestors = set()
        for nid in subject_nodes:
            curr = nid
            while curr:
                ancestors.add(curr)
                curr = primary_parents.get(curr)
        
        valid_ids = subject_nodes.union(ancestors)
        filtered_nodes = [n for n in nodes if n.id in valid_ids]
    else:
        filtered_nodes = nodes
        valid_ids = {n.id for n in nodes}

    graph_nodes = []
    graph_edges = []
    
    # Add nodes
    for node in filtered_nodes:
        node_type_str = node.node_type.value.lower() if node.node_type else "skill"
        graph_nodes.append(GraphNode(
            id=str(node.id),
            label=node.name,
            type=node_type_str,
            question_count=question_count_by_node.get(node.id, 0)
        ))
        
    # 2. Add hierarchical edges (from all_parents, not just primary to show full DAG if any)
    for child_id, parent_ids in all_parents.items():
        if child_id not in valid_ids:
            continue
        for parent_id in parent_ids:
            if parent_id in valid_ids:
                is_primary = primary_parents.get(child_id) == parent_id
                graph_edges.append(GraphEdge(
                    id=f"hier_{parent_id}_{child_id}",
                    source=str(parent_id),
                    target=str(child_id),
                    type="hierarchical",
                    label="primary" if is_primary else "secondary"
                ))
                
    # 3. Add manual/cross links
    link_result = await db.execute(select(KnowledgeNodeLink))
    links = link_result.scalars().all()
    for link in links:
        if link.source_id in valid_ids and link.target_id in valid_ids:
            graph_edges.append(GraphEdge(
                id=f"link_{link.id}",
                source=str(link.source_id),
                target=str(link.target_id),
                type="related",
                label=link.label or "related"
            ))
            
    return GraphResponse(nodes=graph_nodes, edges=graph_edges)
