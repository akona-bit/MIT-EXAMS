# Plan: Smart Matrix Builder

## Context
Admins currently have to manually enter each skill and its required question count when creating an exam matrix. This is tedious and error-prone, especially when wanting to cover a broad topic. The Smart Matrix Builder allows admins to select a broad knowledge scope (e.g., a Topic or Concept), automatically identify all descendant skills, and receive a distribution proposal based on the actual number of approved questions in the bank. This allows for data-driven exam design while maintaining human control through an interactive adjustment interface.

## Goals
1. **Broad Scope Selection**: Enable selecting any node in the DAG and retrieving all descendant leaf nodes (skills) via any relation.
2. **Data-Driven Proposal**: Suggest a distribution of the total requested questions proportional to the actual count of approved questions per skill.
3. **Interactive Refinement**: Provide a UI where admins can see proposed vs. actual counts, receive warnings if proposed > actual, and manually adjust counts in real-time.
4. **Automated Rule Creation**: Convert the final agreed distribution into detailed `MatrixRule` entries by splitting counts across levels and types using existing ratio logic.

## Implementation Approach

### 1. Backend - Knowledge Discovery
- **Descendant Traversal**: Implement `get_all_descendant_leaves(node_ids: List[int])` in `KnowledgeService`.
  - Use BFS/DFS to find all reachable nodes in the DAG.
  - Filter for nodes where `KnowledgeService.is_leaf()` is true.
  - Ensure no duplicates if multiple starting nodes are selected.
- **Counting Utility**: Implement `count_approved_questions(db, node_id)` in `KnowledgeService` to count `Question` entries where `status == APPROVED` and `knowledge_node_id == node_id`.

### 2. Backend - Distribution Logic
- **Utility Extraction**: Move `_largest_remainder` from `app/services/exam_matrix_generator.py` to a reusable utility module (e.g., `app/core/math_utils.py`) or into a new `MatrixService`.
- **Proposed Distribution Calculation**:
  - For each leaf node in scope:
    - Get actual approved count.
    - Calculate proportional share: `(actual_count / total_bank_count) * total_requested`.
    - Ensure minimum of 1 question if `actual_count > 0`.
    - Use `_largest_remainder` to ensure the sum equals `total_requested`.
- **Rule Generation**:
  - Reuse the logic from `exam_matrix_generator.py` to split a skill's total count into multiple `MatrixRule` entries based on Level and Type ratios.

### 3. Backend - API Endpoints
- `POST /api/v1/matrix/suggest-distribution`:
  - Input: `node_ids`, `total_questions`, `level_ratios`, `type_ratios`.
  - Output: List of `{skill_id, skill_name, proposed_count, actual_count, percentage}`.
- `POST /api/v1/matrix/create-from-distribution`:
  - Input: `matrix_id`, `final_distribution` (list of `{skill_id, count}`).
  - Process: Generate `MatrixRule`s $\rightarrow$ Save to DB.
  - Output: Summary of created rules.

### 4. Frontend - Smart Matrix UI
- **Scope Selection**: Multi-select node selector.
- **Configuration**: Inputs for total questions and distribution ratios.
- **Interactive Table/Chart**:
  - Use **`recharts`** (specifically `BarChart`) for the distribution visualization.
  - Column 1: Skill name.
  - Column 2: Actual count (Read-only).
  - Column 3: Proposed count (Editable input).
  - Column 4: Real-time percentage of total.
  - Visuals: Red warning text/border if `proposed > actual`.
- **Confirmation**: Preview of the final `MatrixRule` split before saving.

## Critical Files
- `backend/app/services/knowledge_service.py`: Descendant discovery.
- `backend/app/services/exam_matrix_generator.py`: Ratio splitting logic.
- `backend/app/api/v1/matrix.py`: New API endpoints.
- `frontend/src/pages/admin/Matrix.tsx`: (or new page) Interactive UI.

## Verification Plan
1. **Scope Test**: Select a Topic node and verify all its descendant skills (across all paths) are identified.
2. **Distribution Test**: Check that the initial proposal is proportional to bank size and sums exactly to the requested total.
3. **Constraint Test**: Verify that modifying a count to be > actual triggers a red warning.
4. **Integrity Test**: Ensure the final `MatrixRule` count matches the manual overrides in the UI.
5. **E2E Test**: Create a matrix via Smart Builder $\rightarrow$ Use it to generate an exam $\rightarrow$ Verify correct questions are picked.
