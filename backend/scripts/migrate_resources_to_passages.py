import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.question import Resource, ResourceType
from app.models.passage import Passage
import uuid

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Resource).where(Resource.type == ResourceType.IMAGE))
        resources = result.scalars().all()
        
        migrated_count = 0
        for res in resources:
            # Create a passage containing the markdown image syntax
            content = f"![{res.original_name}]({res.content_url}){{width=100% align=center}}"
            
            passage = Passage(
                public_code=f"mig-{res.id}-{uuid.uuid4().hex[:4]}",
                content=content,
                creator_id=res.uploader_id,
                source_title="Từ Kho ngữ liệu cũ"
            )
            db.add(passage)
            migrated_count += 1
            
        if migrated_count > 0:
            await db.commit()
            print(f"Successfully migrated {migrated_count} image resources to Passages.")
        else:
            print("No image resources found to migrate.")

if __name__ == "__main__":
    asyncio.run(main())
