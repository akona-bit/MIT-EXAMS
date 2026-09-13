"""merge multiple heads

Revision ID: 6754a9df4ade
Revises: b1c2d3e4f5a6, ffae5d6f8264
Create Date: 2026-09-13 10:49:59.966532

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6754a9df4ade'
down_revision: Union[str, None] = ('b1c2d3e4f5a6', 'ffae5d6f8264')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
