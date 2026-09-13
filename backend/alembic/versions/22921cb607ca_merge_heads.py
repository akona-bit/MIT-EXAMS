"""Merge heads

Revision ID: 22921cb607ca
Revises: a1b2c3d4e5f7, c69794f84d66
Create Date: 2026-09-13 11:37:58.121617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22921cb607ca'
down_revision: Union[str, None] = ('a1b2c3d4e5f7', 'c69794f84d66')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
