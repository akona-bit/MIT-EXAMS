"""Add SUB_SKILL level to KnowledgeNodeType enum

Revision ID: b5c2e9f1a7d8
Revises: a6b0ec018166
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa

revision = "b5c2e9f1a7d8"
down_revision = "a6b0ec018166"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE knowledgenodetype ADD VALUE IF NOT EXISTS 'SUB_SKILL'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    pass
