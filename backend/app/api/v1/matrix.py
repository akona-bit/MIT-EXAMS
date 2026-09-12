from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, and_
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.exam import Matrix, MatrixRule, ExamGenerationRun, ExamGenerationStatus
from app.models.question import KnowledgeNode, Question, QuestionStatus, KnowledgeNodeType
from app.schemas.exam import (
    MatrixCreate, MatrixResponse, MatrixImportPreviewRequest, MatrixImportPreviewResponse,
    MatrixImportExecuteRequest,
    MatrixRuleCreate
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


from app.services.dgnl_blueprint import get_blueprint as get_dgnl_blueprint, match_nodes, validate_blueprint
from pydantic import BaseModel as _PydanticBaseModel


class DgnlBlueprintCreateRequest(_PydanticBaseModel):
    name: str
    description: Optional[str] = None
    # slot.key (vd "p1s1") -> knowledge_node_id. Thiếu slot nào sẽ auto-match theo node_hint.
    node_map: Optional[Dict[str, int]] = None


@router.get("/dgnl-blueprint")
async def dgnl_blueprint():
    """Blueprint ĐGNL chuẩn 120 câu (khung xương đối chiếu 3 nguồn) + self-check."""
    blueprint = get_dgnl_blueprint()
    return {"blueprint": blueprint, "structure_errors": validate_blueprint()}


@router.get("/dgnl-blueprint/template")
async def dgnl_blueprint_template(db: AsyncSession = Depends(get_db)):
    """Trả về dữ liệu rules và groups từ blueprint để điền sẵn vào form tạo Matrix."""
    from app.services.dgnl_blueprint import BLUEPRINT_SLOTS
    
    nodes_result = await db.execute(select(KnowledgeNode.id, KnowledgeNode.name))
    nodes = [{"id": n.id, "name": n.name} for n in nodes_result.all()]
    auto_map = match_nodes(nodes)

    groups = []
    rules = []
    
    group_local_ids = []
    for slot in BLUEPRINT_SLOTS:
        if slot.passage and slot.key not in group_local_ids:
            group_local_ids.append(slot.key)
            groups.append({
                "local_id": slot.key,
                "label": slot.label
            })
            
    for slot in BLUEPRINT_SLOTS:
        node_id = auto_map.get(slot.key)
        rules.append({
            "knowledge_node_id": node_id,
            "count": slot.count,
            "part": slot.part,
            "position": slot.position,
            "group_local_id": slot.key if slot.passage else None,
            "_slot_key": slot.key,
            "_slot_label": slot.label,
            "_node_hint": slot.node_hint,
            "_order_locked": slot.order_locked,
            "_shuffle_group": slot.shuffle_group,
            "_note": slot.note,
            "_passage": slot.passage
        })

    return {
        "groups": groups,
        "rules": rules
    }


@router.post("/from-dgnl-blueprint", response_model=MatrixResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_matrix_from_dgnl_blueprint(request: Request, req: DgnlBlueprintCreateRequest, db: AsyncSession = Depends(get_db)):
    """Tạo ma trận hoàn chỉnh theo blueprint ĐGNL 120 câu, auto-match KnowledgeNode."""
    from app.services.dgnl_blueprint import BLUEPRINT_SLOTS, PART_NAMES

    structure_errors = validate_blueprint()
    if structure_errors:
        raise HTTPException(status_code=500, detail={"message": "Blueprint cấu trúc không hợp lệ", "errors": structure_errors})

    nodes_result = await db.execute(select(KnowledgeNode.id, KnowledgeNode.name))
    nodes = [{"id": n.id, "name": n.name} for n in nodes_result.all()]
    auto_map = match_nodes(nodes)

    node_map: Dict[str, Optional[int]] = {}
    for slot in BLUEPRINT_SLOTS:
        override = (req.node_map or {}).get(slot.key)
        node_map[slot.key] = int(override) if override else auto_map.get(slot.key)

    matched = [{"slot": k, "node_id": v} for k, v in node_map.items() if v]
    unmatched = [
        {"slot": s.key, "label": s.label, "node_hint": s.node_hint}
        for s in BLUEPRINT_SLOTS if not node_map.get(s.key)
    ]

    matrix = Matrix(name=req.name, description=req.description, subject="ĐGNL ĐHQG-HCM")
    db.add(matrix)
    await db.flush()

    # Mỗi cụm đọc hiểu (passage group) là 1 MatrixRuleGroup riêng — giáo viên
    # gắn Passage cụ thể sau khi tạo.
    group_local_ids = []
    for slot in BLUEPRINT_SLOTS:
        if slot.passage and slot.key not in group_local_ids:
            group_local_ids.append(slot.key)

    slot_to_group_id: Dict[str, int] = {}
    for g_key in group_local_ids:
        slot = next(s for s in BLUEPRINT_SLOTS if s.key == g_key)
        group = MatrixRuleGroup(matrix_id=matrix.id, label=slot.label)
        db.add(group)
        await db.flush()
        slot_to_group_id[g_key] = group.id

    for slot in BLUEPRINT_SLOTS:
        node_id = node_map.get(slot.key)
        if not node_id:
            continue  # bỏ slot chưa map — báo unmatched cho client
        db.add(MatrixRule(
            matrix_id=matrix.id,
            knowledge_node_id=node_id,
            question_type=None,  # rule đơn giản — engine tự cân bằng dạng/mức độ
            level=None,
            count=slot.count,
            part=slot.part,
            position=slot.position,
            group_id=slot_to_group_id.get(slot.key),
        ))

    await db.commit()
    capture(request, "matrix_created_from_dgnl_blueprint", {
        "matrix_id": matrix.id,
        "matched_slots": len(matched),
        "unmatched_slots": len(unmatched),
    })

    result = await db.execute(
        select(Matrix).options(
            selectinload(Matrix.rules).selectinload(MatrixRule.knowledge_node),
            selectinload(Matrix.groups),
        ).where(Matrix.id == matrix.id)
    )
    created = result.scalars().first()

    return {
        **MatrixResponse.model_validate(created).model_dump(mode="json"),
        "matched": matched,
        "unmatched": unmatched,
    }


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
            target_irt_b=r.target_irt_b,
            group_id=local_to_group_id.get(r.group_local_id) if r.group_local_id else None,
            note=r.note
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
            target_irt_b=r.target_irt_b,
            group_id=local_to_group_id.get(r.group_local_id) if r.group_local_id else None,
            note=r.note
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

from app.schemas.exam import GenerateExamFormsRequest
from app.models.exam import ExamGenerationRun, ExamGenerationStatus, Exam, ExamForm, ExamFormQuestion, ExamStatus
from app.services.exam_matrix_generator import load_pool_from_db, parse_matrix_rules, generate_multiple_versions, generate_exam, build_form_layout
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
        return {
            "feasible": True, 
            "shortages": [], 
            "message": "Ma trận trống — không có ô nào cần kiểm tra",
            "health_score": 100.0,
            "total_required": 0,
            "total_shortage": 0
        }

    pool = await load_pool_from_db(db, matrix.rules)
    matrix_cells = await parse_matrix_rules(db, matrix.rules)

    report = generate_exam(matrix=matrix_cells, pool=pool)

    total_required = sum(c.count for c in matrix_cells)
    total_shortage = sum(s.shortage for s in report.shortages)
    health_score = round((total_required - total_shortage) / total_required * 100, 1) if total_required > 0 else 100.0

    if report.ok:
        return {
            "feasible": True, 
            "shortages": [], 
            "message": "Ma trận khả thi — đủ câu cho mọi ô/nhóm",
            "health_score": health_score,
            "total_required": total_required,
            "total_shortage": 0
        }

    shortages = []
    for s in report.shortages:
        cell = s.cell
        label = f"Nhóm '{cell.group_label}'" if cell.group_label else f"Ô node#{cell.matrix_rule_id}"
        if cell.level is not None:
            level_name = LEVEL_NAMES.get(cell.level, cell.level)
            shortages.append(f"{label}: thiếu {s.shortage} câu (mức {level_name})")
        else:
            shortages.append(f"{label}: thiếu {s.shortage} câu")

    return {
        "feasible": False, 
        "shortages": shortages, 
        "message": f"Ma trận THẤT BẠI — thiếu câu cho {len(shortages)} ô/nhóm",
        "health_score": health_score,
        "total_required": total_required,
        "total_shortage": total_shortage
    }

@router.post("/{matrix_id}/generate", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def generate_exam_from_matrix(matrix_id: int, req: GenerateExamFormsRequest, db: AsyncSession = Depends(get_db)):
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
    # Bất biến khung xương: ô được xử lý theo đúng thứ tự (part, position)
    matrix_cells.sort(key=lambda c: (c.part, c.position))
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

        # Gắn câu hỏi theo KHUNG XƯƠNG ma trận: part đúng theo rule,
        # khối/cụm chung dữ kiện liền kề theo (part, position) — chỉ xáo
        # câu bên trong khối (xáo mã đề có kiểm soát, không phá blueprint).
        question_to_rule_id = {}
        for cell_res in report.cell_results:
            for q_id in cell_res.selected_ids:
                question_to_rule_id[q_id] = cell_res.cell.matrix_rule_id

        layout = build_form_layout(report.cell_results)

        for pos, (q_id, q_part, rule_id) in enumerate(layout):
            efq = ExamFormQuestion(
                exam_form_id=exam_form.id,
                question_id=q_id,
                position=pos + 1,
                part=q_part,
                matrix_rule_id=rule_id if rule_id is not None else question_to_rule_id.get(q_id),
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

from fastapi import UploadFile, File, Form
import json

@router.post("/{matrix_id}/import/vision", response_model=MatrixImportPreviewResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def preview_vision_import(
    matrix_id: int, 
    file: UploadFile = File(...),
    level_ratios: str = Form("{}"),
    type_ratios: str = Form('{"SINGLE_CHOICE": 1.0}'),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Matrix).where(Matrix.id == matrix_id))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Matrix not found")

    image_bytes = await file.read()
    try:
        from app.services.matrix.vision import MatrixVisionService
        tsv_content = await MatrixVisionService.parse_image_to_tsv(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    try:
        level_ratios_dict = json.loads(level_ratios)
        # convert keys to int
        level_ratios_dict = {int(k): float(v) for k, v in level_ratios_dict.items()}
    except (json.JSONDecodeError, ValueError, TypeError):
        level_ratios_dict = {}
        
    try:
        type_ratios_dict = json.loads(type_ratios)
    except (json.JSONDecodeError, ValueError, TypeError):
        type_ratios_dict = {"SINGLE_CHOICE": 1.0}

    preview = await MatrixImportService.preview_import(
        db=db,
        content=tsv_content,
        level_ratios=level_ratios_dict,
        type_ratios=type_ratios_dict
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

@router.post("/parse-structure-file", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def parse_structure_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    content_bytes = await file.read()
    content = content_bytes.decode('utf-8-sig', errors='ignore')
    
    preview = await MatrixImportService.preview_import(
        db=db,
        content=content,
        level_ratios={}, # Simple rule
        type_ratios={}   # Simple rule
    )
    
    rules = []
    for row in preview:
        if row.get("node_id"):
            for rule_data in row.get("distributed_rules", []):
                rules.append({
                    "knowledge_node_id": row["node_id"],
                    "question_type": rule_data.get("question_type") or None,
                    "level": rule_data.get("level") or None,
                    "count": rule_data.get("count", 1),
                    "part": rule_data.get("part", 1),
                    "note": rule_data.get("note", "")
                })
    
    return {"rules": rules, "preview_details": preview}



