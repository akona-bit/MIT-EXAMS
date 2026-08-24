"""Add grading export fields.

Revision ID: 7d6d4f2a1c90
Revises: 4c449bf29194
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d6d4f2a1c90"
down_revision: Union[str, None] = "4c449bf29194"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user", sa.Column("full_name", sa.String(length=150), nullable=True))
    op.add_column("exam_participant", sa.Column("sbd", sa.String(length=50), nullable=True))
    op.add_column("exam_participant", sa.Column("target_score", sa.Float(), nullable=True))
    op.add_column("exam_result", sa.Column("raw_total_score", sa.Float(), nullable=False, server_default="0"))
    op.add_column("exam_result", sa.Column("item_scores", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("exam_result", sa.Column("score_method", sa.String(length=20), nullable=False, server_default="CTT"))


def downgrade() -> None:
    op.drop_column("exam_result", "score_method")
    op.drop_column("exam_result", "item_scores")
    op.drop_column("exam_result", "raw_total_score")
    op.drop_column("exam_participant", "target_score")
    op.drop_column("exam_participant", "sbd")
    op.drop_column("user", "full_name")