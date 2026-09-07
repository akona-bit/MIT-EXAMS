import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def migrate():
    async with AsyncSessionLocal() as db:
        print("Starting migration...")
        
        # 1. Add parent_id to knowledge_node
        print("Adding parent_id to knowledge_node...")
        try:
            await db.execute(text("ALTER TABLE knowledge_node ADD COLUMN parent_id INTEGER REFERENCES knowledge_node(id)"))
        except Exception as e:
            print(f"Column might already exist: {e}")
            
        # 2. Add knowledge_node_id to question
        print("Adding knowledge_node_id to question...")
        try:
            await db.execute(text("ALTER TABLE question ADD COLUMN knowledge_node_id INTEGER REFERENCES knowledge_node(id)"))
        except Exception as e:
            print(f"Column might already exist: {e}")
            
        # 3. Migrate data from knowledge_node_parent -> parent_id (only is_primary=True)
        print("Migrating parent data...")
        try:
            await db.execute(text("""
                UPDATE knowledge_node kn
                SET parent_id = knp.parent_id
                FROM knowledge_node_parent knp
                WHERE kn.id = knp.child_id AND knp.is_primary = TRUE
            """))
        except Exception as e:
            print(e)
        
        # 4. Migrate data from question_skill_tag -> knowledge_node_id (only is_primary=True)
        print("Migrating question tag data...")
        try:
            await db.execute(text("""
                UPDATE question q
                SET knowledge_node_id = qst.knowledge_node_id
                FROM question_skill_tag qst
                WHERE q.id = qst.question_id AND qst.is_primary = TRUE
            """))
        except Exception as e:
            print(e)
            
        # 5. Drop tables
        print("Dropping old tables...")
        await db.execute(text("DROP TABLE IF EXISTS question_skill_tag CASCADE"))
        await db.execute(text("DROP TABLE IF EXISTS knowledge_node_parent CASCADE"))
        await db.execute(text("DROP TABLE IF EXISTS knowledge_node_link CASCADE"))
        
        await db.commit()
        print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
