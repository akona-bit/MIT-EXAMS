from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.exam import Matrix, MatrixRule
from app.schemas.exam import MatrixCreate, MatrixResponse
from app.api.dependencies import RequireRole

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
        select(Matrix).options(selectinload(Matrix.rules), selectinload(Matrix.groups)).where(Matrix.id == matrix_id)
    )
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")
    return matrix

from app.models.exam import MatrixRuleGroup

@router.post("/", response_model=MatrixResponse, dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def create_matrix(matrix_in: MatrixCreate, db: AsyncSession = Depends(get_db)):
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
            question_type=r.question_type,
            level=r.level,
            count=r.count,
            part=r.part,
            group_id=local_to_group_id.get(r.group_local_id) if r.group_local_id else None
        )
        db.add(rule)
        
    await db.commit()
    await db.refresh(matrix)
    
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
            question_type=r.question_type,
            level=r.level,
            count=r.count,
            part=r.part,
            group_id=local_to_group_id.get(r.group_local_id) if r.group_local_id else None
        ))

    await db.commit()
    result = await db.execute(select(Matrix).options(selectinload(Matrix.rules), selectinload(Matrix.groups)).where(Matrix.id == matrix.id))
    return result.scalars().first()


@router.delete("/{matrix_id}", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def delete_matrix(matrix_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Matrix).where(Matrix.id == matrix_id))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Matrix not found")
    await db.delete(matrix)
    await db.commit()
    return {"message": "Matrix deleted"}

from app.schemas.exam import GenerateExamRequest
from app.models.exam import ExamGenerationRun, ExamGenerationStatus, Exam, ExamForm, ExamFormQuestion, ExamStatus
from app.services.exam_matrix_generator import load_pool_from_db, parse_matrix_rules, generate_multiple_versions

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
                shortages.append(f"{s.cell.topic} > {s.cell.concept} > {s.cell.skill}: missing {s.shortage}")
        
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
    return {"message": "Generation successful", "run_id": gen_run.id, "forms_generated": req.number_of_forms}
