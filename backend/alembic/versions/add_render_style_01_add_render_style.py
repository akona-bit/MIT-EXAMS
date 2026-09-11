"""add_render_style

Revision ID: add_render_style_01
Revises: 0ec5b1337c2a
Create Date: 2026-09-11 14:50:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_render_style_01'
down_revision = '129f0b9b29e6'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add render_style column
    op.add_column('question', sa.Column('render_style', sa.String(length=50), server_default='standard', nullable=False))

def downgrade() -> None:
    op.drop_column('question', 'render_style')
