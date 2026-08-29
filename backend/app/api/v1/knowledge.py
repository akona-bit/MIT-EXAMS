from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.question import KnowledgeNode, Question
from app.schemas.question import KnowledgeNodeCreate, KnowledgeNodeResponse
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
async def get_knowledge_tree(db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_parent, question_count_by_node = await _load_knowledge_state(db)
    roots = [node for node in nodes if node.parent_id is None]
    return [
        _build_tree_node(root, children_by_parent, nodes_by_id, question_count_by_node)
        for root in sorted(roots, key=lambda item: item.name.lower())
    ]


@router.get("/graph")
async def get_knowledge_graph(db: AsyncSession = Depends(get_db)):
    nodes, nodes_by_id, children_by_parent, question_count_by_node = await _load_knowledge_state(db)
    graph_nodes = []
    graph_edges = []

    for node in nodes:
        depth = 0
        parent = nodes_by_id.get(node.parent_id) if node.parent_id else None
        while parent:
            depth += 1
            parent = nodes_by_id.get(parent.parent_id) if parent.parent_id else None

        graph_nodes.append({
            "id": f"knowledge:{node.id}",
            "entity_id": node.id,
            "label": node.name,
            "type": _level_name(depth),
            "path": _build_path(node.id, nodes_by_id),
            "question_count": question_count_by_node.get(node.id, 0),
        })

        if node.parent_id:
            graph_edges.append({
                "id": f"knowledge:{node.parent_id}->knowledge:{node.id}",
                "source": f"knowledge:{node.parent_id}",
                "target": f"knowledge:{node.id}",
                "type": "PARENT_OF",
            })

    for parent_id, children in children_by_parent.items():
        if parent_id is None:
            continue
        sorted_children = sorted(children, key=lambda item: item.name.lower())
        for prev, current in zip(sorted_children, sorted_children[1:]):
            graph_edges.append({
                "id": f"knowledge:{prev.id}->knowledge:{current.id}:NEXT_SIBLING",
                "source": f"knowledge:{prev.id}",
                "target": f"knowledge:{current.id}",
                "type": "NEXT_SIBLING",
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
