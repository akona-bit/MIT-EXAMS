class CheckFeasibilityLocalRequest(_PydanticBaseModel):
    rules: List[MatrixRuleCreate]

@router.post("/check-feasibility-local", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def check_matrix_feasibility_local(payload: CheckFeasibilityLocalRequest, db: AsyncSession = Depends(get_db)):
    """Dry-run exam generation for unsaved matrix rules from the frontend form."""
    if not payload.rules:
        return {
            "feasible": True, 
            "shortages": [], 
            "message": "Ma trận trống — không có ô nào cần kiểm tra",
            "health_score": 100.0,
            "total_required": 0,
            "total_shortage": 0
        }

    rules_in_memory = []
    for r in payload.rules:
        rules_in_memory.append(MatrixRule(
            knowledge_node_id=r.knowledge_node_id,
            question_type=r.question_type or None,
            level=r.level,
            count=r.count,
            part=r.part,
            target_irt_b=r.target_irt_b
        ))

    pool = await load_pool_from_db(db, rules_in_memory)
    matrix_cells = await parse_matrix_rules(db, rules_in_memory)

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
    from app.models.question import LEVEL_NAMES
    for s in report.shortages:
        cell = s.cell
        label = f"Nhóm '{cell.group_label}'" if cell.group_label else f"Ô node#{cell.matrix_rule_id}"
        if cell.level is not None:
            level_name = LEVEL_NAMES.get(cell.level, cell.level)
            label += f" (Mức: {level_name})"
        if cell.question_type:
            label += f" (Dạng: {cell.question_type.value})"
        shortages.append(f"{label}: Yêu cầu {cell.count} - Có sẵn {s.available} -> Thiếu {s.shortage} câu.")

    return {
        "feasible": False,
        "shortages": shortages,
        "message": f"Cảnh báo: Ngân hàng thiếu {total_shortage} câu.",
        "health_score": health_score,
        "total_required": total_required,
        "total_shortage": total_shortage
    }
