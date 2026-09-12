"""add_exam_mode_to_participant

Revision ID: a1b2c3d4e5f6
Revises: d43dac9bbb93
Create Date: 2026-09-12 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd43dac9bbb93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type
    exam_mode_enum = sa.Enum('ONLINE', 'PAPER', name='exammode')
    exam_mode_enum.create(op.get_bind(), checkfirst=True)
    
    # Add columns
    op.add_column('exam_participant', sa.Column('exam_mode', sa.Enum('ONLINE', 'PAPER', name='exammode'), nullable=True))
    op.add_column('exam_participant', sa.Column('exam_mode_changed', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('exam_participant', 'exam_mode_changed')
    op.drop_column('exam_participant', 'exam_mode')
    sa.Enum(name='exammode').drop(op.get_bind(), checkfirst=True)
