"""Add question scoring configuration and sub-items.

Revision ID: a4e5f6b7c8d9
Revises: 9b3d4e21f8a2
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4e5f6b7c8d9"
down_revision: Union[str, None] = "9b3d4e21f8a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'COMPOSITE'")

    op.add_column(
        "question",
        sa.Column("scoring_config", sa.JSON(), nullable=True, server_default="{}"),
    )
    op.create_table(
        "question_sub_item",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=20), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("point_weight", sa.Float(), nullable=False, server_default="0.25"),
        sa.Column("kind", sa.String(length=20), nullable=False, server_default="tf"),
        sa.ForeignKeyConstraint(["question_id"], ["question.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_question_sub_item_id", "question_sub_item", ["id"], unique=False)
    op.add_column(
        "answer",
        sa.Column("sub_item_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_answer_sub_item_id",
        "answer",
        "question_sub_item",
        ["sub_item_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_answer_sub_item_id", "answer", type_="foreignkey")
    op.drop_column("answer", "sub_item_id")
    op.drop_index("ix_question_sub_item_id", table_name="question_sub_item")
    op.drop_table("question_sub_item")
    op.drop_column("question", "scoring_config")
