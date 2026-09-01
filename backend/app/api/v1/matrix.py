from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, and_
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.exam import Matrix, MatrixRule
from app.models.question import KnowledgeNode, KnowledgeNodeParent, Question, QuestionStatus, KnowledgeNodeType
from app.schemas.exam import (
    MatrixCreate, MatrixResponse, MatrixImportPreviewRequest, MatrixImportPreviewResponse,
    MatrixImportExecuteRequest, SmartMatrixLeavesRequest, SmartMatrixLeavesResponse,
    SmartMatrixLeafNode, SmartMatrixProposeRequest, SmartMatrixProposeResponse,
    SmartMatrixProposedSkill, SmartMatrixConfirmRequest, SmartMatrixSkillAllocation,
)
from app.services.matrix_import import MatrixImportService
from app.services.knowledge_service import KnowledgeService
from app.api.dependencies import RequireRole
from app.core.analytics import capture

router = APIRouter()

@router.get("/")
async def get_matrices(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    total_result = await db.execute(select(func.count()).select_from(Matrix))
    total = total_result.scalar_one()
    result = await db.execute(
        select(Matrix)
        .options(selectinload(Matrix.rules))
        .order_by(Matrix.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return {"items": result.scalars().all(), "total": total, "page": (skip // limit) + 1 if limit else 1, "size": limit}


@router.get("/{matrix_id}", response_model=MatrixResponse)
async def get_matrix(matrix_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Matrix)
        .options(
            selectinload(Matrix.rules).selectinload(MatrixRule.knowledge_node),
            selectinload(Matrix.groups)
        )
        .where(Matrix.id == matrix_id)
    )
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")
    return matrix

from app.models.exam import MatrixRuleGroup

@router.post("/", response_model=MatrixResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_matrix(request: Request, matrix_in: MatrixCreate, db: AsyncSession = Depends(get_db)):
    matrix = Matrix(name=matrix_in.name, description=matrix_in.description)
    db.add(matrix)
    await db.flush()

    local_to_group_id = {}
    if matrix_in.groups:
        for g in matrix_in.groups:
            group = MatrixRuleGroup(
                matrix_id=matrix.id,
                label=g.label,
                required_passage_id=g.required_passage_id
            )
            db.add(group)
            await db.flush()
            local_to_group_id[g.local_id] = group.id

    for r in matrix_in.rules:
        rule = MatrixRule(
            matrix_id=matrix.id,
            knowledge_node_id=r.knowledge_node_id,
            question_type=r.question_type or None,
            level=r.level if r.level is not None else None,
            count=r.count,
            part=r.part,
            level_distribution=r.level_distribution,
            target_irt_b=r.target_irt_b,
            group_id=local_to_group_id.get(r.group_local_id) if r.group_local_id else None
        )
        db.add(rule)

    await db.commit()
    await db.refresh(matrix)
    capture(request, "matrix_created", {"matrix_id": matrix.id, "rule_count": len(matrix_in.rules)})

    # Reload with rules and groups
    result = await db.execute(select(Matrix).options(selectinload(Matrix.rules), selectinload(Matrix.groups)).where(Matrix.id == matrix.id))
    return result.scalars().first()


@router.put("/{matrix_id}", response_model=MatrixResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def update_matrix(matrix_id: int, matrix_in: MatrixCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Matrix).options(selectinload(Matrix.rules), selectinload(Matrix.groups)).where(Matrix.id == matrix_id)
    )
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")

    # Check if matrix has been used for exam generation
    usage_result = await db.execute(
        select(func.count()).select_from(ExamGenerationRun).where(ExamGenerationRun.matrix_id == matrix_id)
    )
    usage_count = usage_result.scalar_one()
    if usage_count > 0:
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"Ma trận đã được dùng để sinh đề {usage_count} lần. Không thể ghi đè trực tiếp.",
                "hint": "Sử dụng endpoint POST /api/v1/matrix/{id}/create-version để tạo bản sao trước khi chỉnh sửa.",
                "usage_count": usage_count,
            }
        )

    matrix.name = matrix_in.name
    matrix.description = matrix_in.description
    for rule in list(matrix.rules):
        await db.delete(rule)
    for group in list(matrix.groups):
        await db.delete(group)
    await db.flush()

    local_to_group_id = {}
    if matrix_in.groups:
        for g in matrix_in.groups:
            group = MatrixRuleGroup(
                matrix_id=matrix.id,
                label=g.label,
                required_passage_id=g.required_passage_id
            )
            db.add(group)
            await db.flush()
            local_to_group_id[g.local_id] = group.id

    for r in matrix_in.rules:
        db.add(MatrixRule(
            matrix_id=matrix.id,
            knowledge_node_id=r.knowledge_node_id,
            question_type=r.question_type or None,
            level=r.level if r.level is not None else None,
            count=r.count,
            part=r.part,
            level_distribution=r.level_distribution,
            target_irt_b=r.target_irt_b,
            group_id=local_to_group_id.get(r.group_local_id) if r.group_local_id else None
        ))

    await db.commit()
    result = await db.execute(select(Matrix).options(selectinload(Matrix.rules), selectinload(Matrix.groups)).where(Matrix.id == matrix.id))
    return result.scalars().first()


@router.delete("/{matrix_id}", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def delete_matrix(request: Request, matrix_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Matrix).where(Matrix.id == matrix_id))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")
    await db.delete(matrix)
    await db.commit()
    capture(request, "matrix_deleted", {"matrix_id": matrix_id})
    return {"message": "Matrix deleted"}

from app.schemas.exam import GenerateExamRequest
from app.models.exam import ExamGenerationRun, ExamGenerationStatus, Exam, ExamForm, ExamFormQuestion, ExamStatus
from app.services.exam_matrix_generator import load_pool_from_db, parse_matrix_rules, generate_multiple_versions, generate_exam
# Level enum cho message lỗi (đồng bộ với LEVEL_MAP trong exam_matrix_generator)
LEVEL_NAMES = {1: "Nhận biết", 2: "Thông hiểu", 3: "Vận dụng", 4: "Vận dụng cao"}


@router.get("/{matrix_id}/usage", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def get_matrix_usage(matrix_id: int, db: AsyncSession = Depends(get_db)):
    """Check how many times a matrix has been used to generate exams."""
    result = await db.execute(select(Matrix).where(Matrix.id == matrix_id))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Matrix not found")

    count_result = await db.execute(
        select(func.count()).select_from(ExamGenerationRun).where(ExamGenerationRun.matrix_id == matrix_id)
    )
    usage_count = count_result.scalar_one()

    success_result = await db.execute(
        select(func.count()).select_from(ExamGenerationRun).where(
            and_(ExamGenerationRun.matrix_id == matrix_id, ExamGenerationRun.status == ExamGenerationStatus.SUCCESS)
        )
    )
    success_count = success_result.scalar_one()

    return {
        "matrix_id": matrix_id,
        "total_runs": usage_count,
        "successful_runs": success_count,
        "is_used": usage_count > 0,
    }


@router.post("/{matrix_id}/create-version", response_model=MatrixResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_matrix_version(request: Request, matrix_id: int, db: AsyncSession = Depends(get_db)):
    """Create a new version of a matrix by copying all rules and groups."""
    result = await db.execute(
        select(Matrix).options(selectinload(Matrix.rules), selectinload(Matrix.groups)).where(Matrix.id == matrix_id)
    )
    source = result.scalars().first()
    if not source:
        raise HTTPException(status_code=404, detail="Matrix not found")

    # Create new matrix with "(Bản sao)" suffix
    new_matrix = Matrix(
        name=f"{source.name} (Bản sao)",
        description=source.description,
        subject=source.subject,
    )
    db.add(new_matrix)
    await db.flush()

    # Map old group IDs to new group IDs
    old_to_new_group = {}
    if source.groups:
        for group in source.groups:
            new_group = MatrixRuleGroup(
                matrix_id=new_matrix.id,
                label=group.label,
                required_passage_id=group.required_passage_id,
            )
            db.add(new_group)
            await db.flush()
            old_to_new_group[group.id] = new_group.id

    # Copy rules
    for rule in source.rules:
        new_group_id = old_to_new_group.get(rule.group_id) if rule.group_id else None
        new_rule = MatrixRule(
            matrix_id=new_matrix.id,
            knowledge_node_id=rule.knowledge_node_id,
            question_type=rule.question_type,
            level=rule.level,
            level_distribution=rule.level_distribution,
            count=rule.count,
            part=rule.part,
            target_irt_b=rule.target_irt_b,
            position=rule.position,
            group_id=new_group_id,
        )
        db.add(new_rule)

    await db.commit()
    capture(request, "matrix_version_created", {"source_id": matrix_id, "new_id": new_matrix.id})

    result = await db.execute(
        select(Matrix).options(selectinload(Matrix.rules), selectinload(Matrix.groups)).where(Matrix.id == new_matrix.id)
    )
    return result.scalars().first()


@router.post("/{matrix_id}/check-feasibility", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def check_matrix_feasibility(matrix_id: int, db: AsyncSession = Depends(get_db)):
    """Dry-run exam generation to check if matrix is feasible without saving results."""
    result = await db.execute(select(Matrix).options(selectinload(Matrix.rules)).where(Matrix.id == matrix_id))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")

    if not matrix.rules:
        return {"feasible": True, "shortages": [], "message": "Ma trận trống — không có ô nào cần kiểm tra"}

    pool = await load_pool_from_db(db, matrix.rules)
    matrix_cells = await parse_matrix_rules(db, matrix.rules)

    report = generate_exam(matrix=matrix_cells, pool=pool)

    if report.ok:
        return {"feasible": True, "shortages": [], "message": "Ma trận khả thi — đủ câu cho mọi ô/nhóm"}

    shortages = []
    for s in report.shortages:
        cell = s.cell
        label = f"Nhóm '{cell.group_label}'" if cell.group_label else f"Ô node#{cell.matrix_rule_id}"
        if cell.level is not None:
            level_name = LEVEL_NAMES.get(
                {"NB": 1, "TH": 2, "VD": 3, "VDC": 4}.get(cell.level, 0),
                cell.level
            )
            shortages.append(f"{label}: thiếu {s.shortage} câu (mức {level_name})")
        else:
            shortages.append(f"{label}: thiếu {s.shortage} câu")

    return {"feasible": False, "shortages": shortages, "message": f"Ma trận THẤT BẠI — thiếu câu cho {len(shortages)} ô/nhóm"}

@router.post("/{matrix_id}/generate", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def generate_exam_from_matrix(matrix_id: int, req: GenerateExamRequest, db: AsyncSession = Depends(get_db)):
    # Validate Matrix
    result = await db.execute(select(Matrix).options(selectinload(Matrix.rules)).where(Matrix.id == matrix_id))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")

    # Validate Exam
    exam_result = await db.execute(select(Exam).where(Exam.id == req.exam_id))
    exam = exam_result.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Create ExamGenerationRun (status RUNNING initially, but we don't have RUNNING enum, so just create later)

    # Load rules and pool
    pool = await load_pool_from_db(db, matrix.rules)
    matrix_cells = await parse_matrix_rules(db, matrix.rules)

    # Generate
    reports = generate_multiple_versions(
        matrix=matrix_cells,
        pool=pool,
        n_versions=req.number_of_forms,
        distinct_questions=req.distinct_questions
    )

    # Check if FAILED
    failed_report = next((r for r in reports if not r.ok), None)
    if not reports or failed_report:
        shortages = []
        if failed_report:
            for s in failed_report.shortages:
                if s.cell.level is not None:
                    # Advanced mode: báo rõ thiếu ở mức độ nào trong rule
                    level_name = LEVEL_NAMES.get(s.cell.level, str(s.cell.level))
                    shortages.append(
                        f"{s.cell.topic} > {s.cell.concept} > {s.cell.skill}"
                        f" (mức độ {level_name}): missing {s.shortage}"
                    )
                else:
                    shortages.append(
                        f"{s.cell.topic} > {s.cell.concept} > {s.cell.skill}: missing {s.shortage}"
                    )

        # Log failure
        gen_run = ExamGenerationRun(
            matrix_id=matrix.id,
            num_forms=req.number_of_forms,
            distinct_questions=req.distinct_questions,
            status=ExamGenerationStatus.FAILED,
            error_details=shortages
        )
        db.add(gen_run)
        await db.commit()
        raise HTTPException(status_code=422, detail={"message": "Failed to generate exam due to shortage", "shortages": shortages})

    # SUCCESS
    gen_run = ExamGenerationRun(
        matrix_id=matrix.id,
        num_forms=req.number_of_forms,
        distinct_questions=req.distinct_questions,
        status=ExamGenerationStatus.SUCCESS,
        error_details=None
    )
    db.add(gen_run)
    await db.flush() # To get gen_run.id

    import random

    for i, report in enumerate(reports):
        form_code = f"M{i+1:03d}"
        exam_form = ExamForm(
            exam_id=exam.id,
            code=form_code,
            is_original=(i == 0)
        )
        db.add(exam_form)
        await db.flush() # To get exam_form.id

        # Attach questions
        # We need to map selected_ids back to cell results to store matrix_rule_id
        question_to_rule_id = {}
        for cell_res in report.cell_results:
            for q_id in cell_res.selected_ids:
                question_to_rule_id[q_id] = cell_res.cell.matrix_rule_id

        # Shuffle questions for this form
        shuffled_ids = list(report.selected_ids)
        random.shuffle(shuffled_ids)

        for pos, q_id in enumerate(shuffled_ids):
            efq = ExamFormQuestion(
                exam_form_id=exam_form.id,
                question_id=q_id,
                position=pos + 1,
                part=1, # simplified
                matrix_rule_id=question_to_rule_id.get(q_id),
                exam_generation_run_id=gen_run.id
            )
            db.add(efq)

    await db.commit()

    # Breakdown thực tế (dạng câu/mức độ) cho mỗi rule — chỉ có ý nghĩa với rule đơn giản,
    # rule cũ (đã định dạng câu/mức độ) thì breakdown trùng với config.
    breakdown = []
    for cell_res in report.cell_results:
        rule = cell_res.cell.matrix_rule_id
        if cell_res.cell.question_type is None or cell_res.cell.level is None:
            breakdown.append({
                "rule_id": rule,
                "dang_cau": dict(cell_res.dang_cau_counts or {}),
                "muc_do": dict(cell_res.muc_do_counts or {}),
            })

    return {
        "message": "Generation successful",
        "run_id": gen_run.id,
        "forms_generated": req.number_of_forms,
        "breakdown": breakdown,
    }

@router.post("/{matrix_id}/import/preview", response_model=MatrixImportPreviewResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def preview_matrix_import(matrix_id: int, req: MatrixImportPreviewRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Matrix).where(Matrix.id == matrix_id))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Matrix not found")

    preview = await MatrixImportService.preview_import(
        db=db,
        content=req.content,
        level_ratios=req.level_ratios,
        type_ratios=req.type_ratios
    )
    return {"preview": preview}

@router.post("/{matrix_id}/import/execute", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def execute_matrix_import(matrix_id: int, req: MatrixImportExecuteRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Matrix).where(Matrix.id == matrix_id))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Matrix not found")

    total_count = await MatrixImportService.execute_import(
        db=db,
        matrix_id=matrix_id,
        confirmed_rows=req.confirmed_rows,
        strategy=req.strategy
    )
    return {"message": "Import successful", "total_questions_added": total_count}


# ============================================================
# SMART MATRIX BUILDER ENDPOINTS
# ============================================================

@router.post("/smart/leaves", response_model=SmartMatrixLeavesResponse)
async def get_smart_leaves(
    req: SmartMatrixLeavesRequest,
    db: AsyncSession = Depends(get_db),
):
    """Get all descendant leaf nodes for selected scope nodes, with question counts.
    
    Traverses ALL DAG relations (not just primary) to find every skill
    that belongs to the selected scope.
    """
    # Deduplicate input
    unique_ids = list(set(req.node_ids))
    
    # Get descendant leaf nodes via DAG traversal (all paths)
    leaf_ids = await KnowledgeService.get_all_descendant_leaves(db, unique_ids)
    
    # If a selected node IS a leaf itself, include it
    for nid in unique_ids:
        if await KnowledgeService.is_leaf(db, nid) and nid not in leaf_ids:
            leaf_ids.append(nid)
    
    # Deduplicate
    leaf_ids = list(set(leaf_ids))
    
    if not leaf_ids:
        return SmartMatrixLeavesResponse(leaves=[], total_questions_in_bank=0)
    
    # Load node details + question counts
    leaves = []
    total_count = 0
    
    for lid in leaf_ids:
        node_res = await db.execute(
            select(KnowledgeNode).where(KnowledgeNode.id == lid)
        )
        node = node_res.scalars().first()
        if not node:
            continue
        
        # Count APPROVED questions
        q_count = await KnowledgeService.count_approved_questions(db, lid)
        total_count += q_count
        
        # Resolve path (topic > concept > skill)
        path_parts = await _resolve_node_path(db, lid)
        
        # Find topic and concept names from path
        topic_name = None
        concept_name = None
        if len(path_parts) >= 1:
            topic_name = path_parts[0]
        if len(path_parts) >= 2:
            concept_name = path_parts[1]
        
        leaves.append(SmartMatrixLeafNode(
            node_id=lid,
            name=node.name,
            node_type=node.node_type.value if node.node_type else "SKILL",
            path=" > ".join(path_parts),
            question_count=q_count,
            topic_name=topic_name,
            concept_name=concept_name,
        ))
    
    # Sort: leaves with more questions first
    leaves.sort(key=lambda x: x.question_count, reverse=True)
    
    return SmartMatrixLeavesResponse(leaves=leaves, total_questions_in_bank=total_count)


async def _resolve_node_path(db: AsyncSession, node_id: int) -> List[str]:
    """Resolve the path from leaf up to root via primary parents."""
    path = []
    current_id = node_id
    visited = set()
    
    while current_id and current_id not in visited:
        visited.add(current_id)
        node_res = await db.execute(
            select(KnowledgeNode).where(KnowledgeNode.id == current_id)
        )
        node = node_res.scalars().first()
        if not node:
            break
        path.append(node.name)
        
        # Find primary parent
        parent_res = await db.execute(
            select(KnowledgeNodeParent.parent_id)
            .where(and_(
                KnowledgeNodeParent.child_id == current_id,
                KnowledgeNodeParent.is_primary == True
            ))
        )
        current_id = parent_res.scalar_one_or_none()
    
    return list(reversed(path))


@router.post("/smart/propose", response_model=SmartMatrixProposeResponse)
async def propose_smart_distribution(
    req: SmartMatrixProposeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Propose question distribution across skills based on available bank.
    
    Algorithm:
    1. Get all descendant leaves with question counts
    2. Distribute total_questions proportionally to available questions
    3. Each skill gets minimum 1 if it has any questions (unless bank = 0)
    4. Use largest-remainder method for exact integer distribution
    """
    unique_ids = list(set(req.node_ids))
    leaf_ids = await KnowledgeService.get_all_descendant_leaves(db, unique_ids)
    
    for nid in unique_ids:
        if await KnowledgeService.is_leaf(db, nid) and nid not in leaf_ids:
            leaf_ids.append(nid)
    leaf_ids = list(set(leaf_ids))
    
    # Load leaves with counts
    skill_data = []
    for lid in leaf_ids:
        node_res = await db.execute(
            select(KnowledgeNode).where(KnowledgeNode.id == lid)
        )
        node = node_res.scalars().first()
        if not node:
            continue
        
        q_count = await KnowledgeService.count_approved_questions(db, lid)
        path_parts = await _resolve_node_path(db, lid)
        
        skill_data.append({
            "node_id": lid,
            "name": node.name,
            "path": " > ".join(path_parts),
            "question_count": q_count,
        })
    
    # Filter out skills with 0 questions for allocation
    # (they will be listed but proposed = 0)
    skills_with_questions = [s for s in skill_data if s["question_count"] > 0]
    skills_without_questions = [s for s in skill_data if s["question_count"] == 0]
    
    total_available = sum(s["question_count"] for s in skills_with_questions)
    
    # Proportional allocation using largest-remainder
    if total_available > 0 and skills_with_questions:
        raw_shares = []
        for s in skills_with_questions:
            share = (s["question_count"] / total_available) * req.total_questions
            raw_shares.append(share)
        
        # Largest-remainder method
        allocated = _largest_remainder_round(raw_shares, req.total_questions)
        
        for i, s in enumerate(skills_with_questions):
            s["proposed_count"] = allocated[i]
    else:
        for s in skills_with_questions:
            s["proposed_count"] = 0
    
    # Skills without questions get 0
    for s in skills_without_questions:
        s["proposed_count"] = 0
    
    # Build response
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
    
    return SmartMatrixProposeResponse(
        skills=skills,
        total_proposed=total_proposed,
        total_in_bank=total_available,
    )


def _largest_remainder_round(values: List[float], target_total: int) -> List[int]:
    """Round float values to integers preserving exact total using largest-remainder method.
    
    Ensures each value gets at least 1 if it's > 0 (minimum allocation).
    """
    if not values:
        return []
    
    n = len(values)
    
    # Floor each value
    floored = [int(v) for v in values]
    remainders = [v - int(v) for v in values]
    
    # How many more we need
    deficit = target_total - sum(floored)
    
    # Distribute remaining by largest remainder
    indices_by_remainder = sorted(range(n), key=lambda i: remainders[i], reverse=True)
    
    for i in range(deficit):
        floored[indices_by_remainder[i % n]] += 1
    
    # Ensure minimum 1 for any with raw value > 0
    for i in range(n):
        if values[i] > 0 and floored[i] == 0:
            # Find the skill with the most to spare
            max_idx = max(range(n), key=lambda j: floored[j])
            if floored[max_idx] > 1:
                floored[max_idx] -= 1
                floored[i] = 1
    
    return floored


@router.post("/smart/confirm", response_model=MatrixResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def confirm_smart_matrix(
    request: Request,
    req: SmartMatrixConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create matrix with rules from smart builder allocations.
    
    Each skill allocation becomes multiple MatrixRules based on level_ratios
    and type_ratios (using largest-remainder for distribution).
    """
    # Create matrix
    matrix = Matrix(name=req.name, description=req.description, subject=req.subject)
    db.add(matrix)
    await db.flush()
    
    # Generate rules from allocations
    for alloc in req.allocations:
        if alloc.proposed_count <= 0:
            continue
        
        # Distribute across levels using level_ratios
        level_counts = _distribute_by_ratios(
            alloc.proposed_count,
            req.level_ratios,
            list(req.level_ratios.keys()),
        )
        
        # For each level, distribute across question types
        for level_val, level_count in level_counts.items():
            if level_count <= 0:
                continue
            
            type_counts = _distribute_by_ratios(
                level_count,
                req.type_ratios,
                list(req.type_ratios.keys()),
            )
            
            for type_name, type_count in type_counts.items():
                if type_count <= 0:
                    continue
                
                rule = MatrixRule(
                    matrix_id=matrix.id,
                    knowledge_node_id=alloc.node_id,
                    question_type=type_name,
                    level=level_val,
                    count=type_count,
                    part=1,  # default part, admin can adjust later
                )
                db.add(rule)
    
    await db.commit()
    
    # Track analytics
    capture(request, "smart_matrix_confirmed", {
        "matrix_id": matrix.id,
        "total_questions": req.total_questions,
        "skill_count": len(req.allocations),
        "name": req.name,
    })
    
    # Reload with rules
    result = await db.execute(
        select(Matrix)
        .options(selectinload(Matrix.rules), selectinload(Matrix.groups))
        .where(Matrix.id == matrix.id)
    )
    return result.scalars().first()


def _distribute_by_ratios(
    total: int,
    ratios: dict,
    keys: list,
) -> dict:
    """Distribute total across keys by ratios, returning dict of {key: count}."""
    if not ratios or total <= 0:
        return {k: 0 for k in keys}
    
    # Normalise ratios
    total_ratio = sum(ratios.values())
    if total_ratio <= 0:
        return {k: 0 for k in keys}
    
    normalised = {k: v / total_ratio for k, v in ratios.items()}
    
    raw_values = [normalised.get(k, 0) * total for k in keys]
    allocated = _largest_remainder_round(raw_values, total)
    
    return {keys[i]: allocated[i] for i in range(len(keys))}
