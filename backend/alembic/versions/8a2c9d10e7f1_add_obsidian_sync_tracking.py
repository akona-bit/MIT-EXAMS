"""Add Obsidian sync tracking.

Revision ID: 8a2c9d10e7f1
Revises: 7d6d4f2a1c90
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8a2c9d10e7f1'
down_revision: Union[str, None] = '7d6d4f2a1c90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'obsidian_sync_run',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('api_url', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('success_count', sa.Integer(), nullable=False),
        sa.Column('skipped_count', sa.Integer(), nullable=False),
        sa.Column('error_count', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_obsidian_sync_run_id', 'obsidian_sync_run', ['id'], unique=False)

    op.create_table(
        'obsidian_file',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('checksum', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['question.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_path', name='uq_obsidian_file_path'),
    )
    op.create_index('ix_obsidian_file_id', 'obsidian_file', ['id'], unique=False)
    op.create_index('ix_obsidian_file_file_path', 'obsidian_file', ['file_path'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_obsidian_file_file_path', table_name='obsidian_file')
    op.drop_index('ix_obsidian_file_id', table_name='obsidian_file')
    op.drop_table('obsidian_file')
    op.drop_index('ix_obsidian_sync_run_id', table_name='obsidian_sync_run')
    op.drop_table('obsidian_sync_run')