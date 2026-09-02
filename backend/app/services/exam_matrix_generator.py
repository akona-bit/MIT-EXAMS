from __future__ import annotations
# Matrix generator module.
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Set, Tuple
import random
from collections import Counter, defaultdict
from sqlalchemy.orm import Session
from app.models.question import Question, KnowledgeNode
from app.models.exam import MatrixRule, ExamGenerationRun, ExamGenerationStatus
from sqlalchemy import text, bindparam

# Map level integer back to strings for logging/logic if needed
LEVEL_MAP = {1: "NB", 2: "TH", 3: "VD", 4: "VDC"}

@dataclass(frozen=True)
class MatrixCell:
    # Rule "đơn giản" (từ Matrix 2.1): level/question_type = None -> engine tự cân bằng
    # theo phân bố thực tế của ngân hàng câu hỏi (proportional sampling)
    topic: str
    concept: str
    skill: str
    count: int
    level: Optional[str] = None
    question_type: Optional[str] = None
    target_irt_b: Optional[float] = None
    matrix_rule_id: Optional[int] = None
    part: int = 1
    position: int = 0
    group_id: Optional[int] = None
    group_label: Optional[str] = None
    required_passage_id: Optional[int] = None
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
    # Breakdown thực tế đã chọn - chỉ fill khi rule đơn giản (engine tự cân bằng)
    dang_cau_counts: Optional[Dict[str, int]] = None
    muc_do_counts: Optional[Dict[str, int]] = None

@dataclass
class GenerationReport:
    ok: bool
    selected_ids: List[int]
    shortages: List[CellResult]
    warnings: List[str]
    cell_results: List[CellResult] = field(default_factory=list)

def _candidates_for_cell(cell: MatrixCell, pool: List[CandidateQuestion], used_ids: Set[int], passage_id: Optional[int] = None) -> List[CandidateQuestion]:
    # Filter approved questions matching the matrix cell.
    def _matches(q: CandidateQuestion) -> bool:
        if q.status != "APPROVED" or q.id in used_ids:
            return False
        if q.topic != cell.topic or q.concept != cell.concept or q.skill != cell.skill:
            return False
        # Chỉ filter level/type khi rule yêu cầu (không None)
        if cell.level is not None and q.level != cell.level:
            return False
        if cell.question_type is not None and q.question_type != cell.question_type:
            return False
        if passage_id is not None and q.passage_id != passage_id:
            return False
        return True
    return [q for q in pool if _matches(q)]

from app.services.matrix.allocator import _largest_remainder

def _pick_best(cands: List[CandidateQuestion], n: int, target_irt_b: Optional[float]) -> List[CandidateQuestion]:
    # Pick the best candidates by exposure, IRT distance, and random tie-breaker.
    if n <= 0:
        return []
    cands = sorted(cands, key=lambda q: _score(q, target_irt_b))
    return cands[:n]

def _select_for_cell(
    cell: MatrixCell,
    pool: List[CandidateQuestion],
    used_ids: Set[int],
    passage_id: Optional[int] = None,
) -> CellResult:
    # Select questions for a matrix cell.
    cands = _candidates_for_cell(cell, pool, used_ids, passage_id=passage_id)

    # ---- Rule cũ chính thức (đã set đủ level + dạng câu): strict cũ y hệt ----
    if cell.level is not None and cell.question_type is not None:
        chosen = _pick_best(cands, cell.count, cell.target_irt_b)
        shortage = max(0, cell.count - len(chosen))
        return CellResult(cell=cell, selected_ids=[q.id for q in chosen], shortage=shortage)

    # ---- Rule đơn giản: strict-check mức node (tổng câu của node >= count) ----
    if len(cands) < cell.count:
        return CellResult(cell=cell, selected_ids=[], shortage=cell.count)

    # 1 Xác định quota cho từng level
    if cell.level is not None:
        level_quota = {cell.level: cell.count}
        target_by_level: Dict[str, Dict[str, float]] = {}
    else:
        # Mode mặc định: phân bố thực tế của ngân hàng câu hỏi trong node
        level_counts: Dict[str, int] = Counter(q.level for q in cands)
        total = len(cands)
        actual_level_props = {lv: c / total for lv, c in level_counts.items() if c > 0}
        level_quota = _largest_remainder(actual_level_props, cell.count)
        target_by_level = {}

    # 2 Trong mỗi level, chia tiếp theo dạng câu (tỷ lệ thực tế của ngân hàng)
    if cell.question_type is None:
        pass  # self-balancing: tính per-level bên dưới
    picked: List[CandidateQuestion] = []
    temp_used = set(used_ids)

    for lv, quota in level_quota.items():
        lv_cands = [q for q in cands if q.level == lv and q.id not in temp_used]

        # Quota theo dạng câu trong level này - dựa trên phân bố thực tế của ngân hàng
        if cell.question_type is not None:
            type_quota = {cell.question_type: quota}
        elif lv in target_by_level:
            type_quota = _largest_remainder(target_by_level[lv], quota)
        else:
            type_counts: Dict[str, int] = Counter(q.question_type for q in lv_cands)
            if not type_counts:
                continue
            type_total = len(lv_cands)
            type_ratios = {t: c / type_total for t, c in type_counts.items() if c > 0}
            type_quota = _largest_remainder(type_ratios, quota)

        for qt, qq in type_quota.items():
            bucket = [q for q in lv_cands if q.question_type == qt and q.id not in temp_used]
            chosen = _pick_best(bucket, qq, cell.target_irt_b)
            if len(chosen) < qq:
                # Không đủ câu ở bucket (advanced/partial): strict fail toàn bộ
                return CellResult(
                    cell=cell,
                    selected_ids=[],
                    shortage=cell.count,
                    dang_cau_counts={qt: qq - len(chosen)},
                )
            picked.extend(chosen)
            temp_used.update(q.id for q in chosen)

    shortage = max(0, cell.count - len(picked))
    # Breakdown thực tế cho frontend
    dang_cau_counts: Dict[str, int] = Counter(q.question_type for q in picked)
    muc_do_counts: Dict[str, int] = Counter(q.level for q in picked)
    return CellResult(
        cell=cell,
        selected_ids=[q.id for q in picked],
        shortage=shortage,
        dang_cau_counts=dict(dang_cau_counts),
        muc_do_counts=dict(muc_do_counts),
    )

def _score(q: CandidateQuestion, target_irt_b: Optional[float]) -> tuple:
    exposure_penalty = q.exposure_count
    irt_penalty = 0.0
    if target_irt_b is not None and q.irt_b is not None:
        irt_penalty = abs(q.irt_b - target_irt_b)
    return (exposure_penalty, irt_penalty, random.random())

def _try_satisfy_group(cells: List[MatrixCell], pool: List[CandidateQuestion], used_ids: Set[int]) -> Optional[List[CellResult]]:
    # Try to satisfy a group of cells. All cells in the group must share the same passage_id if grouped.
    if not cells:
        return []

    first_cell = cells[0]
    is_grouped = first_cell.group_id is not None
    req_passage_id = first_cell.required_passage_id if is_grouped else None

    if not is_grouped:
        # Normal single cell selection (rule cũ strict-mode hoặc rule đơn giản proportional)
        cell = cells[0]
        return [_select_for_cell(cell, pool, used_ids)]

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
            result = _select_for_cell(cell, pool, temp_used, passage_id=p_id)
            if result.shortage > 0 or len(result.selected_ids) != cell.count:
                success = False
                break
            group_results.append(result)
            temp_used.update(result.selected_ids)

        if success:
            return group_results

    # If we get here, no passage could satisfy the group completely.
    # Strict fail: if 1 group fails, all fail - no questions selected from this group.
    group_results = []
    for cell in cells:
        group_results.append(CellResult(cell=cell, selected_ids=[], shortage=cell.count))

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
        JOIN question_skill_tag qst ON q.id = qst.question_id
        JOIN knowledge_node kn ON qst.knowledge_node_id = kn.id
        LEFT JOIN knowledge_node_parent knp1 ON knp1.child_id = kn.id AND knp1.is_primary = TRUE
        LEFT JOIN knowledge_node p1 ON knp1.parent_id = p1.id
        LEFT JOIN knowledge_node_parent knp2 ON knp2.child_id = p1.id AND knp2.is_primary = TRUE
        LEFT JOIN knowledge_node p2 ON knp2.parent_id = p2.id
        LEFT JOIN v_question_exposure v ON v.question_id = q.id
        WHERE q.status = 'APPROVED'
        AND qst.knowledge_node_id IN :kn_ids
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
            LEFT JOIN knowledge_node_parent knp1 ON knp1.child_id = kn.id AND knp1.is_primary = TRUE
            LEFT JOIN knowledge_node p1 ON knp1.parent_id = p1.id
            LEFT JOIN knowledge_node_parent knp2 ON knp2.child_id = p1.id AND knp2.is_primary = TRUE
            LEFT JOIN knowledge_node p2 ON knp2.parent_id = p2.id
            WHERE kn.id = :kn_id
        """)
        result = await db.execute(query, {"kn_id": r.knowledge_node_id})
        row = result.fetchone()

        if not row:
            continue

        skill_name = row.skill_name or ""
        concept_name = row.concept_name or ""
        topic_name = row.topic_name or ""

        # Rule cũ: đã set sẵn level/dạng câu; Rule mới (đơn giản): None -> engine tự cân bằng
        level_str = LEVEL_MAP.get(r.level) if r.level is not None else None
        question_type = r.question_type.value if hasattr(r.question_type, 'value') else r.question_type
        req_passage_id = None
        if r.group_id is not None:
            req_passage_id = group_map.get(r.group_id)

        cells.append(MatrixCell(
            topic=topic_name,
            concept=concept_name,
            skill=skill_name,
            level=level_str,
            question_type=question_type,
            count=r.count,
            target_irt_b=r.target_irt_b,
            matrix_rule_id=r.id,
            part=r.part,
            position=r.position,
            group_id=r.group_id,
            required_passage_id=req_passage_id
        ))
    return cells
