from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from sqlalchemy.sql import func

from app.db.database import get_db
from app.models.question import KnowledgeNode, Question, QuestionStatus
from app.schemas.question import KnowledgeNodeCreate, KnowledgeNodeResponse, KnowledgeNodeUpdate, GraphResponse, GraphNode, GraphEdge
from app.api.dependencies import RequireRole
from app.core.analytics import capture
from app.services.knowledge_service import KnowledgeService

router = APIRouter()

LEVEL_NAMES = ("TOPIC", "CONCEPT", "SKILL", "SUB_SKILL")

def _level_name(depth: int) -> str:
    return LEVEL_NAMES[depth] if depth < len(LEVEL_NAMES) else "SUB_SKILL"

def _build_path(node_id: int, nodes_by_id: Dict[int, KnowledgeNode]) -> str:
    names: List[str] = []
    current_id = node_id
    while current_id:
        node = nodes_by_id.get(current_id)
        if not node:
            break
        names.append(node.name)
        current_id = node.parent_id
    return "/".join(reversed(names))

def _build_tree_node(
    node: KnowledgeNode,
    children_by_parent: Dict[Optional[int], List[KnowledgeNode]],
    nodes_by_id: Dict[int, KnowledgeNode],
    question_count_by_node: Dict[int, int],
    valid_ids: Optional[set] = None,
    depth: int = 0,
) -> Dict[str, Any]:
    children = [
        _build_tree_node(child, children_by_parent, nodes_by_id, question_count_by_node, valid_ids, depth + 1)
        for child in sorted(children_by_parent.get(node.id, []), key=lambda item: item.name.lower())
        if valid_ids is None or child.id in valid_ids
    ]
    inclusive_count = question_count_by_node.get(node.id, 0)
    for child in children:
        inclusive_count += child.get("question_count", 0)

    return {
        "id": node.id,
        "name": node.name,
        "description": node.description,
        "node_type": node.node_type.value if node.node_type else "SKILL",
        "subject": node.subject,
        "short_code": node.short_code,
        "parent_id": node.parent_id,
        "level": _level_name(depth),
        "path": _build_path(node.id, nodes_by_id),
        "question_count": inclusive_count,
        "is_leaf": node.is_leaf if node.is_leaf is not None else True,
        "children": children,
    }

async def _load_knowledge_state(db: AsyncSession):
    node_result = await db.execute(select(KnowledgeNode))
    nodes = list(node_result.scalars().all())
    nodes_by_id = {node.id: node for node in nodes}

    children_by_parent: Dict[Optional[int], List[KnowledgeNode]] = {}

    for node in nodes:
        children_by_parent.setdefault(node.parent_id, []).append(node)

    question_result = await db.execute(
        select(Question.knowledge_node_id, func.count(Question.id))
        .where(Question.status == QuestionStatus.APPROVED)
        .group_by(Question.knowledge_node_id)
    )
    question_rows = question_result.all()
    question_count_by_node = {row[0]: row[1] for row in question_rows if row[0]}

    return nodes, nodes_by_id, children_by_parent, question_count_by_node

@router.get("/", response_model=List[KnowledgeNodeResponse])
async def get_knowledge_nodes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeNode))
    return result.scalars().all()

@router.get("/tree")
async def get_knowledge_tree(subject: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_parent, question_count_by_node = await _load_knowledge_state(db)

    valid_ids = None
    if subject:
        valid_ids = set()
        for node in nodes:
            if node.subject == subject:
                valid_ids.add(node.id)
                queue = [node.id]
                while queue:
                    curr = queue.pop(0)
                    children = [c.id for c in children_by_parent.get(curr, [])]
                    valid_ids.update(children)
                    queue.extend(children)
        ancestors = set()
        for nid in valid_ids:
            curr = nid
            while curr:
                ancestors.add(curr)
                curr_node = nodes_by_id.get(curr)
                curr = curr_node.parent_id if curr_node else None
        valid_ids = valid_ids.union(ancestors)

    roots = [node for node in nodes if node.parent_id is None]
    if valid_ids:
        roots = [node for node in roots if node.id in valid_ids]

    return [
        _build_tree_node(root, children_by_parent, nodes_by_id, question_count_by_node, valid_ids)
        for root in sorted(roots, key=lambda item: item.name.lower())
    ]

@router.get("/{node_id}/context")
async def get_knowledge_node_context(node_id: int, db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_parent, question_count_by_node = await _load_knowledge_state(db)

    node = nodes_by_id.get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node không tồn tại")

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
        current_id = curr_node.parent_id

    siblings_list = []
    p_id = node.parent_id
    if p_id:
        sibs = children_by_parent.get(p_id, [])
    else:
        sibs = [n for n in nodes if n.parent_id is None and n.subject == node.subject]

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
        "secondary_parents": []
    }

@router.post("/", response_model=KnowledgeNodeResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_knowledge_node(request: Request, node_in: KnowledgeNodeCreate, db: AsyncSession = Depends(get_db)):
    if node_in.parent_id:
        result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_in.parent_id))
        if not result.scalars().first():
            raise HTTPException(status_code=400, detail="Parent node not found")

    node_data = node_in.model_dump()
    node = KnowledgeNode(**node_data)
    db.add(node)
    await db.commit()
    await db.refresh(node)

    if node.parent_id:
        await KnowledgeService.update_node_path_codes(db, node.id)
        await db.commit()
        await db.refresh(node)

    capture(request, "knowledge_node_created", {"knowledge_node_id": node.id, "has_parent": bool(node.parent_id)})
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

    parent_changed = False
    if node_in.parent_id is not None and node_in.parent_id != node.parent_id:
        if node_in.parent_id == node_id:
            raise HTTPException(status_code=400, detail="Không thể trỏ parent vào chính nó")
        parent_result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_in.parent_id))
        if not parent_result.scalars().first():
            raise HTTPException(status_code=404, detail="Parent node không tồn tại")
            
        has_cycle, path = await KnowledgeService.check_for_cycle(db, node_id, node_in.parent_id)
        if has_cycle:
            raise HTTPException(status_code=400, detail=f"Cycle detected: {path}")
        parent_changed = True

    update_data = node_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(node, key, value)

    if parent_changed:
        await db.flush()
        await KnowledgeService.update_node_path_codes(db, node_id)

    await db.commit()
    await db.refresh(node)
    capture(request, "knowledge_node_updated", {"node_id": node.id, "fields": list(update_data.keys())})
    return node

@router.get("/graph", response_model=GraphResponse)
async def get_knowledge_graph(subject: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_parent, question_count_by_node = await _load_knowledge_state(db)
    
    if subject:
        subject_nodes = set()
        for node in nodes:
            if node.subject == subject:
                subject_nodes.add(node.id)
                queue = [node.id]
                while queue:
                    curr = queue.pop(0)
                    children = [c.id for c in children_by_parent.get(curr, [])]
                    subject_nodes.update(children)
                    queue.extend(children)
        
        ancestors = set()
        for nid in subject_nodes:
            curr = nid
            while curr:
                ancestors.add(curr)
                curr_node = nodes_by_id.get(curr)
                curr = curr_node.parent_id if curr_node else None
        
        valid_ids = subject_nodes.union(ancestors)
        filtered_nodes = [n for n in nodes if n.id in valid_ids]
    else:
        filtered_nodes = nodes
        valid_ids = {n.id for n in nodes}

    graph_nodes = []
    graph_edges = []
    
    for node in filtered_nodes:
        node_type_str = node.node_type.value.lower() if node.node_type else "skill"
        graph_nodes.append(GraphNode(
            id=str(node.id),
            label=node.name,
            type=node_type_str,
            question_count=question_count_by_node.get(node.id, 0)
        ))
        
        if node.parent_id and node.parent_id in valid_ids:
            graph_edges.append(GraphEdge(
                id=f"hier_{node.parent_id}_{node.id}",
                source=str(node.parent_id),
                target=str(node.id),
                type="hierarchical",
                label="primary"
            ))
            
    return GraphResponse(nodes=graph_nodes, edges=graph_edges)
