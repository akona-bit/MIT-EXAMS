"""add student_id to user

Revision ID: d5e6f7a8b9c0
Revises: d3e4f5a6b7c8
Create Date: 2026-09-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add student_id column (6-digit unique identifier for login)
    op.add_column('user', sa.Column('student_id', sa.String(length=6), nullable=True))
    op.create_index(op.f('ix_user_student_id'), 'user', ['student_id'], unique=True)


def downgrade() -> None:
    # Remove student_id column
    op.drop_index(op.f('ix_user_student_id'), table_name='user')
    op.drop_column('user', 'student_id')
