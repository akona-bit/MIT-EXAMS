from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Set, Tuple
import random
from sqlalchemy.orm import Session
from app.models.question import Question, KnowledgeNode
from app.models.exam import MatrixRule, ExamGenerationRun, ExamGenerationStatus
from sqlalchemy import text, bindparam

# Map level integer back to strings for logging/logic if needed
LEVEL_MAP = {1: "NB", 2: "TH", 3: "VD", 4: "VDC"}

@dataclass(frozen=True)
class MatrixCell:
    topic: str
    concept: str
    skill: str
    level: str
    question_type: str
    count: int
    target_irt_b: Optional[float] = None
    matrix_rule_id: Optional[int] = None
    part: int = 1
    position: int = 0
    group_id: Optional[int] = None
    group_label: Optional[str] = None
    required_passage_id: Optional[int] = None

@dataclass
class CandidateQuestion:
    id: int
    topic: str
    concept: str
    skill: str
    level: str
    question_type: str
    passage_id: Optional[int] = None
    irt_b: Optional[float] = None
    exposure_count: int = 0
    status: str = "APPROVED"

@dataclass
class CellResult:
    cell: MatrixCell
    selected_ids: List[int] = field(default_factory=list)
    shortage: int = 0

@dataclass
class GenerationReport:
    ok: bool
    selected_ids: List[int]
    shortages: List[CellResult]
    warnings: List[str]
    cell_results: List[CellResult] = field(default_factory=list)

def _candidates_for_cell(cell: MatrixCell, pool: List[CandidateQuestion], used_ids: Set[int], passage_id: Optional[int] = None) -> List[CandidateQuestion]:
    return [
        q for q in pool
        if q.status == "APPROVED"
        and q.id not in used_ids
        and q.topic == cell.topic
        and q.concept == cell.concept
        and q.skill == cell.skill
        and q.level == cell.level
        and q.question_type == cell.question_type
        and (passage_id is None or q.passage_id == passage_id)
    ]

def _score(q: CandidateQuestion, target_irt_b: Optional[float]) -> tuple:
    exposure_penalty = q.exposure_count
    irt_penalty = 0.0
    if target_irt_b is not None and q.irt_b is not None:
        irt_penalty = abs(q.irt_b - target_irt_b)
    return (exposure_penalty, irt_penalty, random.random())

def _try_satisfy_group(cells: List[MatrixCell], pool: List[CandidateQuestion], used_ids: Set[int]) -> Optional[List[CellResult]]:
    """Try to satisfy a group of cells. All cells in the group must share the same passage_id if grouped."""
    if not cells:
        return []
        
    first_cell = cells[0]
    is_grouped = first_cell.group_id is not None
    req_passage_id = first_cell.required_passage_id if is_grouped else None
    
    if not is_grouped:
        # Normal single cell selection
        cell = cells[0]
        candidates = _candidates_for_cell(cell, pool, used_ids)
        candidates.sort(key=lambda q: _score(q, cell.target_irt_b))
        chosen = candidates[: cell.count]
        shortage = max(0, cell.count - len(chosen))
        return [CellResult(cell=cell, selected_ids=[q.id for q in chosen], shortage=shortage)]
    
    # It's a group
    if req_passage_id is not None:
        possible_passages = [req_passage_id]
    else:
        # Find all passages that have questions for at least one cell in the group
        possible_passages_set = set()
        for cell in cells:
            cands = _candidates_for_cell(cell, pool, used_ids)
            for c in cands:
                if c.passage_id is not None:
                    possible_passages_set.add(c.passage_id)
        possible_passages = list(possible_passages_set)
        
    for p_id in possible_passages:
        group_results = []
        temp_used = set(used_ids)
        success = True
        
        for cell in cells:
            candidates = _candidates_for_cell(cell, pool, temp_used, passage_id=p_id)
            candidates.sort(key=lambda q: _score(q, cell.target_irt_b))
            
            chosen = candidates[: cell.count]
            if len(chosen) < cell.count:
                success = False
                break
                
            group_results.append(CellResult(cell=cell, selected_ids=[q.id for q in chosen], shortage=0))
            temp_used.update([q.id for q in chosen])
            
        if success:
            return group_results
            
    # If we get here, no passage could satisfy the group completely.
    # We return the best partial? No, strict fail logic: if 1 group fails, all fail.
    # We return partial results for the first passage so the outer loop knows it failed.
    group_results = []
    temp_used = set(used_ids)
    p_id = possible_passages[0] if possible_passages else None
    
    for cell in cells:
        candidates = _candidates_for_cell(cell, pool, temp_used, passage_id=p_id)
        candidates.sort(key=lambda q: _score(q, cell.target_irt_b))
        chosen = candidates[: cell.count]
        shortage = max(0, cell.count - len(chosen))
        group_results.append(CellResult(cell=cell, selected_ids=[q.id for q in chosen], shortage=shortage))
        temp_used.update([q.id for q in chosen])
        
    return group_results

def generate_exam(matrix: List[MatrixCell], pool: List[CandidateQuestion], exclude_ids: Optional[Set[int]] = None, max_retries: int = 3) -> GenerationReport:
    exclude_ids = set(exclude_ids or [])
    warnings: List[str] = []

    best_attempt: Optional[Tuple[List[int], List[CellResult], List[CellResult]]] = None
    
    # Group cells by group_id. None means individual group
    groups_dict = {}
    idx = 0
    for cell in matrix:
        if cell.group_id is None:
            groups_dict[f"none_{idx}"] = [cell]
            idx += 1
        else:
            if cell.group_id not in groups_dict:
                groups_dict[cell.group_id] = []
            groups_dict[cell.group_id].append(cell)
            
    groups = list(groups_dict.values())

    for attempt in range(1, max_retries + 1):
        used_ids: Set[int] = set(exclude_ids)
        cell_results: List[CellResult] = []
        
        # Shuffle groups to avoid deterministic bias on which passage gets picked if multiple match
        random.shuffle(groups)

        for group_cells in groups:
            results = _try_satisfy_group(group_cells, pool, used_ids)
            if results:
                cell_results.extend(results)
                for r in results:
                    used_ids.update(r.selected_ids)

        shortages = [r for r in cell_results if r.shortage > 0]
        all_ids = [qid for r in cell_results for qid in r.selected_ids]

        if not shortages:
            return GenerationReport(
                ok=True, selected_ids=all_ids, shortages=[], warnings=warnings, cell_results=cell_results
            )

        # Collect shortage labels
        shortage_details = []
        for r in shortages:
            if r.cell.group_label:
                shortage_details.append(f"Nhóm '{r.cell.group_label}'")
            else:
                shortage_details.append(f"Ô độc lập (vị trí {r.cell.position})")
        unique_shortages = list(set(shortage_details))
        
        warnings.append(f"Attempt {attempt}: Thiếu câu hỏi cho {len(shortages)} ô. Cụ thể: {', '.join(unique_shortages)}")
        if best_attempt is None or len(shortages) < len(best_attempt[1]):
            best_attempt = (all_ids, shortages, cell_results)

    _, shortages, best_cell_results = best_attempt  # type: ignore
    return GenerationReport(
        ok=False, selected_ids=[], shortages=shortages, warnings=warnings, cell_results=best_cell_results
    )

def generate_multiple_versions(
    matrix: List[MatrixCell],
    pool: List[CandidateQuestion],
    n_versions: int,
    distinct_questions: bool = False,
) -> List[GenerationReport]:
    if not distinct_questions:
        base = generate_exam(matrix, pool)
        return [base for _ in range(n_versions)]

    reports: List[GenerationReport] = []
    exclude: Set[int] = set()
    for _ in range(n_versions):
        report = generate_exam(matrix, pool, exclude_ids=exclude)
        reports.append(report)
        exclude.update(report.selected_ids)
    return reports

from sqlalchemy.ext.asyncio import AsyncSession

async def load_pool_from_db(db: AsyncSession, matrix_rules: List[MatrixRule]) -> List[CandidateQuestion]:
    kn_ids = set(rule.knowledge_node_id for rule in matrix_rules)
    if not kn_ids:
        return []
        
    query = text("""
        SELECT 
            q.id, q.level, q.type as question_type, q.b_param as irt_b, q.status, q.passage_id,
            kn.name as skill,
            p1.name as concept,
            p2.name as topic,
            COALESCE(v.exposure_count, 0) as exposure_count
        FROM question q
        JOIN knowledge_node kn ON q.knowledge_node_id = kn.id
        LEFT JOIN knowledge_node p1 ON kn.parent_id = p1.id
        LEFT JOIN knowledge_node p2 ON p1.parent_id = p2.id
        LEFT JOIN v_question_exposure v ON v.question_id = q.id
        WHERE q.status = 'APPROVED' 
        AND q.knowledge_node_id IN :kn_ids
    """)
    query = query.bindparams(bindparam("kn_ids", expanding=True))
    result = await db.execute(query, {"kn_ids": tuple(kn_ids)})
    rows = result.fetchall()
    
    pool = []
    for r in rows:
        level_str = LEVEL_MAP.get(r.level, "NB")
        pool.append(CandidateQuestion(
            id=r.id,
            topic=r.topic or "",
            concept=r.concept or "",
            skill=r.skill or "",
            level=level_str,
            question_type=r.question_type.value if hasattr(r.question_type, 'value') else r.question_type,
            passage_id=r.passage_id,
            irt_b=r.irt_b,
            exposure_count=r.exposure_count,
            status=r.status.value if hasattr(r.status, 'value') else r.status
        ))
    return pool

async def parse_matrix_rules(db: AsyncSession, rules: List[MatrixRule]) -> List[MatrixCell]:
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select
    from app.models.exam import MatrixRuleGroup
    
    cells = []
    
    # Pre-fetch groups
    group_ids = set(r.group_id for r in rules if r.group_id is not None)
    group_map = {}
    if group_ids:
        group_query = text("SELECT id, required_passage_id FROM matrix_rule_group WHERE id IN :gids")
        group_query = group_query.bindparams(bindparam("gids", expanding=True))
        group_res = await db.execute(group_query, {"gids": tuple(group_ids)})
        for row in group_res.fetchall():
            group_map[row.id] = row.required_passage_id
            
    for r in rules:
        # Load knowledge node hierarchy to get topic, concept, skill names via SQL
        query = text("""
            SELECT 
                kn.name as skill_name,
                p1.name as concept_name,
                p2.name as topic_name
            FROM knowledge_node kn
            LEFT JOIN knowledge_node p1 ON kn.parent_id = p1.id
            LEFT JOIN knowledge_node p2 ON p1.parent_id = p2.id
            WHERE kn.id = :kn_id
        """)
        result = await db.execute(query, {"kn_id": r.knowledge_node_id})
        row = result.fetchone()
        
        if not row:
            continue
            
        skill_name = row.skill_name or ""
        concept_name = row.concept_name or ""
        topic_name = row.topic_name or ""
                
        level_str = LEVEL_MAP.get(r.level, "NB")
        
        req_passage_id = None
        if r.group_id is not None:
            req_passage_id = group_map.get(r.group_id)
        
        cells.append(MatrixCell(
            topic=topic_name,
            concept=concept_name,
            skill=skill_name,
            level=level_str,
            question_type=r.question_type.value if hasattr(r.question_type, 'value') else r.question_type,
            count=r.count,
            target_irt_b=r.target_irt_b,
            matrix_rule_id=r.id,
            part=r.part,
            position=r.position,
            group_id=r.group_id,
            required_passage_id=req_passage_id
        ))
    return cells
