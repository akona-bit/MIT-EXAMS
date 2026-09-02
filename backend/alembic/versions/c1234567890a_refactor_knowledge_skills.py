"""refactor knowledge and skills

Revision ID: c1234567890a
Revises: b5c2e9f1a7d8
Create Date: 2026-09-02 09:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1234567890a'
down_revision: Union[str, None] = 'b5c2e9f1a7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create question_skill_tag table
    op.create_table('question_skill_tag',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('question_id', sa.Integer(), nullable=False),
    sa.Column('knowledge_node_id', sa.Integer(), nullable=False),
    sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='0'),
    sa.ForeignKeyConstraint(['knowledge_node_id'], ['knowledge_node.id'], ),
    sa.ForeignKeyConstraint(['question_id'], ['question.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_question_skill_tag_id'), 'question_skill_tag', ['id'], unique=False)
    op.create_index(op.f('ix_question_skill_tag_knowledge_node_id'), 'question_skill_tag', ['knowledge_node_id'], unique=False)
    op.create_index(op.f('ix_question_skill_tag_question_id'), 'question_skill_tag', ['question_id'], unique=False)

    # 2. Add is_leaf to knowledge_node
    op.add_column('knowledge_node', sa.Column('is_leaf', sa.Boolean(), server_default='1', nullable=False))

    # 3. Data Migration: Copy question.knowledge_node_id to question_skill_tag
    connection = op.get_bind()
    result = connection.execute(sa.text("SELECT id, knowledge_node_id FROM question WHERE knowledge_node_id IS NOT NULL"))
    for row in result:
        connection.execute(
            sa.text("INSERT INTO question_skill_tag (question_id, knowledge_node_id, is_primary) VALUES (:qid, :knid, :primary)"),
            {"qid": row[0], "knid": row[1], "primary": True}
        )

    # 4. Data Migration: Update is_leaf based on knowledge_node_parent
    connection.execute(sa.text("""
        UPDATE knowledge_node
        SET is_leaf = false
        WHERE id IN (
            SELECT parent_id FROM knowledge_node_parent
        )
    """))

    # 5. Drop old columns using batch_alter_table to handle constraints automatically where possible
    with op.batch_alter_table('question', schema=None) as batch_op:
        batch_op.drop_constraint('question_knowledge_node_id_fkey', type_='foreignkey')
        batch_op.drop_column('knowledge_node_id')

    with op.batch_alter_table('knowledge_node', schema=None) as batch_op:
        batch_op.drop_constraint('knowledge_node_parent_id_fkey', type_='foreignkey')
        batch_op.drop_column('parent_id')


def downgrade() -> None:
    # 1. Re-add old columns
    op.add_column('knowledge_node', sa.Column('parent_id', sa.INTEGER(), autoincrement=False, nullable=True))
    op.create_foreign_key('knowledge_node_parent_id_fkey', 'knowledge_node', 'knowledge_node', ['parent_id'], ['id'])

    op.add_column('question', sa.Column('knowledge_node_id', sa.INTEGER(), autoincrement=False, nullable=True))
    op.create_foreign_key('question_knowledge_node_id_fkey', 'question', 'knowledge_node', ['knowledge_node_id'], ['id'])

    # 2. Copy data back
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE question
        SET knowledge_node_id = (
            SELECT knowledge_node_id
            FROM question_skill_tag
            WHERE question_skill_tag.question_id = question.id
            AND is_primary = true
            LIMIT 1
        )
    """))

    # 3. Drop new columns and tables
    op.drop_column('knowledge_node', 'is_leaf')
    op.drop_index(op.f('ix_question_skill_tag_question_id'), table_name='question_skill_tag')
    op.drop_index(op.f('ix_question_skill_tag_knowledge_node_id'), table_name='question_skill_tag')
    op.drop_index(op.f('ix_question_skill_tag_id'), table_name='question_skill_tag')
    op.drop_table('question_skill_tag')
