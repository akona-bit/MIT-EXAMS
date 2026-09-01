"""
Audit: Liệt kê mọi KnowledgeNode KHÔNG PHẢI leaf (có ít nhất 1 node con)
nhưng vẫn có câu hỏi gắn trực tiếp (question.knowledge_node_id = node.id).

Đây là vi phạm quy tắc "chỉ node lá mới được gắn câu hỏi".

Chạy: python -m scripts.audit_knowledge_leaves
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.database import AsyncSessionLocal


AUDIT_SQL = """
WITH
-- Tìm tất cả node_id có ít nhất 1 node con (parent trong knowledge_node_parent)
nodes_with_children AS (
    SELECT DISTINCT parent_id AS node_id
    FROM knowledge_node_parent
),
-- Tìm tất cả node_id có câu hỏi gắn trực tiếp
nodes_with_questions AS (
    SELECT knowledge_node_id AS node_id, COUNT(*) AS question_count
    FROM question
    GROUP BY knowledge_node_id
),
-- Phân loại node
all_nodes AS (
    SELECT
        kn.id,
        kn.name,
        kn.node_type::text AS node_type,
        kn.short_code,
        kn.path_code,
        CASE WHEN nwc.node_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_children,
        CASE WHEN nwq.node_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_questions,
        COALESCE(nwq.question_count, 0) AS question_count
    FROM knowledge_node kn
    LEFT JOIN nodes_with_children nwc ON kn.id = nwc.node_id
    LEFT JOIN nodes_with_questions nwq ON kn.id = nwq.node_id
)
SELECT * FROM all_nodes
WHERE has_children = TRUE AND has_questions = TRUE
ORDER BY question_count DESC, name;
"""

SUMMARY_SQL = """
SELECT
    COUNT(*) AS total_nodes,
    COUNT(DISTINCT knp.parent_id) AS nodes_with_children,
    COUNT(DISTINCT q.knowledge_node_id) AS nodes_with_questions,
    (
        SELECT COUNT(DISTINCT knp2.parent_id)
        FROM knowledge_node_parent knp2
        INNER JOIN question q2 ON q2.knowledge_node_id = knp2.parent_id
    ) AS violating_nodes
FROM knowledge_node kn
LEFT JOIN knowledge_node_parent knp ON kn.id = knp.parent_id
LEFT JOIN question q ON kn.id = q.knowledge_node_id;
"""

LEAF_ONLY_CHECK = """
-- Kiểm tra: câu hỏi gắn vào leaf (đúng quy tắc)
SELECT
    kn.id,
    kn.name,
    kn.node_type::text AS node_type,
    COUNT(q.id) AS question_count
FROM knowledge_node kn
INNER JOIN question q ON q.knowledge_node_id = kn.id
WHERE NOT EXISTS (
    SELECT 1 FROM knowledge_node_parent knp WHERE knp.parent_id = kn.id
)
GROUP BY kn.id, kn.name, kn.node_type
ORDER BY question_count DESC;
"""


async def run_audit():
    async with AsyncSessionLocal() as db:
        # 1. Violations
        print("=" * 80)
        print("AUDIT: Node KHÔNG PHẢI LEAF nhưng có câu hỏi gắn trực tiếp")
        print("=" * 80)
        result = await db.execute(text(AUDIT_SQL))
        rows = result.fetchall()

        if not rows:
            print("\n[OK] Không có vi phạm nào — tất cả câu hỏi đều gắn vào leaf nodes.\n")
        else:
            print(f"\n[VI PHẠM] Tìm thấy {len(rows)} node vi phạm:\n")
            print(f"{'ID':<6} {'Tên':<35} {'Type':<10} {'ShortCode':<12} {'PathCode':<30} {'Số câu hỏi':<12}")
            print("-" * 105)
            for row in rows:
                print(f"{row.id:<6} {row.name:<35} {row.node_type:<10} {(row.short_code or '-'):<12} {(row.path_code or '-'):<30} {row.question_count:<12}")

        # 2. Summary
        print("\n" + "=" * 80)
        print("TỔNG QUAN")
        print("=" * 80)
        summary = await db.execute(text(SUMMARY_SQL))
        s = summary.fetchone()
        print(f"  Tổng node:              {s.total_nodes}")
        print(f"  Node có con:            {s.nodes_with_children}")
        print(f"  Node có câu hỏi:       {s.nodes_with_questions}")
        print(f"  Node vi phạm:           {s.violating_nodes}")

        # 3. Leaf nodes with questions (correct)
        print("\n" + "=" * 80)
        print("CÁC NODE LEAF CÓ CÂU HỎI (ĐÚNG QUY TẮC)")
        print("=" * 80)
        leaves = await db.execute(text(LEAF_ONLY_CHECK))
        leaf_rows = leaves.fetchall()
        if leaf_rows:
            print(f"\n{'ID':<6} {'Tên':<40} {'Type':<10} {'Số câu hỏi':<12}")
            print("-" * 68)
            for row in leaf_rows:
                print(f"{row.id:<6} {row.name:<40} {row.node_type:<10} {row.question_count:<12}")
        else:
            print("\n  (Không có leaf node nào có câu hỏi)")

        return rows


if __name__ == "__main__":
    violations = asyncio.run(run_audit())
    sys.exit(1 if violations else 0)
