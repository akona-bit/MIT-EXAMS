"""Matrix rule simple mode: nullable question_type/level + level_distribution

Revision ID: b7a1c9d4e2f8
Revises: 0ec5b1337c2a
Create Date: 2026-08-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b7a1c9d4e2f8'
down_revision: Union[str, None] = '0ec5b1337c2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # question_type/level thành nullable — rule "đơn giản" (node + count) không cần thiết lập
    # Dữ liệu cũ giữ nguyên giá trị, hành vi generate không đổi (xem exam_matrix_generator.py)
    op.alter_column(
        'matrix_rule', 'question_type',
        existing_type=postgresql.ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANK', 'COMPOSITE',
                                      name='questiontype'),
        nullable=True,
    )
    op.alter_column(
        'matrix_rule', 'level',
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.add_column(
        'matrix_rule',
        sa.Column('level_distribution', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.execute("DELETE FROM matrix_rule WHERE question_type IS NULL OR level IS NULL")
    op.drop_column('matrix_rule', 'level_distribution')
    op.alter_column('matrix_rule', 'level', existing_type=sa.Integer(), nullable=False)
    op.alter_column(
        'matrix_rule', 'question_type',
        existing_type=postgresql.ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANK', 'COMPOSITE',
                                      name='questiontype'),
        nullable=False,
    )
