"""Add answer_source to ExamSubmissionAnswer

Revision ID: a1b2c3d4e5f6
Revises: ffae5d6f8264
Create Date: 2026-09-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, None] = '6754a9df4ade'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exam_submission_answer', sa.Column('answer_source', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('exam_submission_answer', 'answer_source')
