"""Add resource file metadata.

Revision ID: 9b3d4e21f8a2
Revises: 8a2c9d10e7f1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b3d4e21f8a2"
down_revision: Union[str, None] = "8a2c9d10e7f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("resource", sa.Column("original_name", sa.String(length=255), nullable=False, server_default="resource"))
    op.add_column("resource", sa.Column("mime_type", sa.String(length=150), nullable=True))
    op.add_column("resource", sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("resource", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False))


def downgrade() -> None:
    op.drop_column("resource", "created_at")
    op.drop_column("resource", "size_bytes")
    op.drop_column("resource", "mime_type")
    op.drop_column("resource", "original_name")