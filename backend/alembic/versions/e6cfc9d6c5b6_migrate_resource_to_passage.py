"""migrate_resource_to_passage

Revision ID: e6cfc9d6c5b6
Revises: 28c3d855a747
Create Date: 2026-08-29 22:29:30.805295

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6cfc9d6c5b6'
down_revision: Union[str, None] = '28c3d855a747'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Fetch all resources
    connection = op.get_bind()
    resources = connection.execute(sa.text("SELECT id, original_name, content_url, uploader_id, created_at FROM resource")).fetchall()
    
    # 2. Insert into passage
    for res in resources:
        # Create markdown content
        filename = res[1] or f"image_{res[0]}"
        content = f"![{filename}]({res[2]}){{width=100%}}"
        public_code = f"RES-{res[0]}"
        
        # Check if already exists (idempotency)
        exists = connection.execute(sa.text("SELECT 1 FROM passage WHERE public_code = :pc"), {"pc": public_code}).scalar()
        if not exists:
            connection.execute(sa.text("""
                INSERT INTO passage (public_code, content, creator_id, created_at, updated_at)
                VALUES (:pc, :content, :creator, :created_at, :created_at)
            """), {
                "pc": public_code,
                "content": content,
                "creator": res[3],
                "created_at": res[4]
            })

def downgrade() -> None:
    pass
    pass
