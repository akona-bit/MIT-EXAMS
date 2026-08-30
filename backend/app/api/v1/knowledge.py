from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.question import KnowledgeNode, KnowledgeNodeLink, Question
from app.schemas.question import KnowledgeNodeCreate, KnowledgeNodeResponse, KnowledgeNodeUpdate
from app.api.dependencies import RequireRole
from app.core.analytics import capture

router = APIRouter()

LEVEL_NAMES = ("TOPIC", "CONCEPT", "SKILL")


def _level_name(depth: int) -> str:
    return LEVEL_NAMES[depth] if depth < len(LEVEL_NAMES) else "NOTE"


def _build_path(node_id: int, nodes_by_id: Dict[int, KnowledgeNode]) -> str:
    names: List[str] = []
    current: Optional[KnowledgeNode] = nodes_by_id.get(node_id)
    while current:
        names.append(current.name)
        current = nodes_by_id.get(current.parent_id) if current.parent_id else None
    return "/".join(reversed(names))


def _build_tree_node(
    node: KnowledgeNode,
    children_by_parent: Dict[Optional[int], List[KnowledgeNode]],
    nodes_by_id: Dict[int, KnowledgeNode],
    question_count_by_node: Dict[int, int],
    depth: int = 0,
) -> Dict[str, Any]:
    children = [
        _build_tree_node(child, children_by_parent, nodes_by_id, question_count_by_node, depth + 1)
        for child in sorted(children_by_parent.get(node.id, []), key=lambda item: item.name.lower())
    ]
    return {
        "id": node.id,
        "name": node.name,
        "description": node.description,
        "parent_id": node.parent_id,
        "level": _level_name(depth),
        "path": _build_path(node.id, nodes_by_id),
        "question_count": question_count_by_node.get(node.id, 0),
        "children": children,
    }


async def _load_knowledge_state(db: AsyncSession):
    node_result = await db.execute(select(KnowledgeNode))
    nodes = list(node_result.scalars().all())
    nodes_by_id = {node.id: node for node in nodes}

    children_by_parent: Dict[Optional[int], List[KnowledgeNode]] = {}
    for node in nodes:
        children_by_parent.setdefault(node.parent_id, []).append(node)

    question_result = await db.execute(select(Question.id, Question.knowledge_node_id))
    question_rows = question_result.all()
    question_count_by_node: Dict[int, int] = {}
    for _, knowledge_node_id in question_rows:
        question_count_by_node[knowledge_node_id] = question_count_by_node.get(knowledge_node_id, 0) + 1

    return nodes, nodes_by_id, children_by_parent, question_count_by_node

@router.get("/", response_model=List[KnowledgeNodeResponse])
async def get_knowledge_nodes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeNode))
    return result.scalars().all()


@router.get("/tree")
async def get_knowledge_tree(subject: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_parent, question_count_by_node = await _load_knowledge_state(db)
    
    roots = [node for node in nodes if node.parent_id is None]
    if subject:
        roots = [node for node in roots if node.subject == subject]
        
    return [
        _build_tree_node(root, children_by_parent, nodes_by_id, question_count_by_node)
        for root in sorted(roots, key=lambda item: item.name.lower())
    ]


@router.get("/{node_id}/context")
async def get_knowledge_node_context(node_id: int, db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_parent, question_count_by_node = await _load_knowledge_state(db)
    
    node = nodes_by_id.get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node không tồn tại")
        
    # Build breadcrumb
    breadcrumb = []
    current = node
    while current:
        breadcrumb.insert(0, {
            "id": current.id,
            "name": current.name,
            "node_type": current.node_type.value.lower() if current.node_type else "skill"
        })
        current = nodes_by_id.get(current.parent_id) if current.parent_id else None
        
    # Build siblings
    siblings_list = []
    # If node has a parent, siblings are children of the parent. Otherwise, roots with the same subject.
    if node.parent_id:
        sibs = children_by_parent.get(node.parent_id, [])
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
        "question_count": question_count_by_node.get(node.id, 0)
    }


@router.get("/graph")
async def get_knowledge_graph(db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_parent, question_count_by_node = await _load_knowledge_state(db)
    graph_nodes = []
    graph_edges = []

    for node in nodes:
        graph_nodes.append({
            "id": f"knowledge:{node.id}",
            "entity_id": node.id,
            "label": node.name,
            "type": node.node_type.value if node.node_type else "SKILL",
            "path": _build_path(node.id, nodes_by_id),
            "question_count": question_count_by_node.get(node.id, 0),
            "description": node.description,
            "note": node.note,
        })

        if node.parent_id:
            graph_edges.append({
                "id": f"knowledge:{node.parent_id}->knowledge:{node.id}",
                "source": f"knowledge:{node.parent_id}",
                "target": f"knowledge:{node.id}",
                "type": "PARENT_OF",
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
            
    node = KnowledgeNode(**node_in.model_dump())
    db.add(node)
    await db.commit()
    await db.refresh(node)
    capture(request, "knowledge_node_created", {"knowledge_node_id": node.id, "has_parent": node.parent_id is not None})
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
    
    # Detach children
    children_result = await db.execute(select(KnowledgeNode).where(KnowledgeNode.parent_id == node_id))
    children = children_result.scalars().all()
    for child in children:
        child.parent_id = None
        
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
    
    update_data = node_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(node, key, value)
        
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
