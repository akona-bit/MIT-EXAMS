import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    url = 'postgresql+asyncpg://postgres.hsqasoggkhdfzchfnmhb:Leminhduc1902@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        # Count rows in all tables
        result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
        tables = result.fetchall()
        
        print('=== TABLE ROW COUNTS ===')
        total = 0
        for t in tables:
            table_name = t[0]
            count_result = await conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
            count = count_result.scalar()
            total += count
            if count > 0:
                print(f'  {table_name}: {count}')
        
        print(f'\nTotal tables: {len(tables)}')
        print(f'Total rows: {total}')
        
        # Check for orphaned records
        print('\n=== ORPHAN CHECKS ===')
        orphan_query = """
            SELECT 'exam_participant without exam' as issue, COUNT(*) as count
            FROM exam_participant ep
            LEFT JOIN exam e ON ep.exam_id = e.id
            WHERE e.id IS NULL
            UNION ALL
            SELECT 'exam_submission without exam' as issue, COUNT(*) as count
            FROM exam_submission es
            LEFT JOIN exam e ON es.exam_id = e.id
            WHERE e.id IS NULL
            UNION ALL
            SELECT 'answer without exam_submission' as issue, COUNT(*) as count
            FROM answer a
            LEFT JOIN exam_submission es ON a.exam_submission_id = es.id
            WHERE es.id IS NULL
            UNION ALL
            SELECT 'question without knowledge_node' as issue, COUNT(*) as count
            FROM question q
            LEFT JOIN knowledge_node kn ON q.knowledge_node_id = kn.id
            WHERE q.knowledge_node_id IS NOT NULL AND kn.id IS NULL;
        """
        orphan_result = await conn.execute(text(orphan_query))
        orphans = orphan_result.fetchall()
        has_orphans = False
        for issue, count in orphans:
            if count > 0:
                print(f'  WARNING: {issue}: {count}')
                has_orphans = True
        if not has_orphans:
            print('  OK No orphaned records found')
        
        # Check duplicate questions
        print('\n=== DUPLICATE CHECKS ===')
        dup_query = """
            SELECT 'duplicate questions (same content)' as issue, COUNT(*) as count FROM (
                SELECT content, COUNT(*) as cnt
                FROM question
                WHERE content IS NOT NULL
                GROUP BY content
                HAVING COUNT(*) > 1
            ) sub
            UNION ALL
            SELECT 'users with same username' as issue, COUNT(*) as count FROM (
                SELECT username, COUNT(*) as cnt
                FROM "user"
                WHERE username IS NOT NULL
                GROUP BY username
                HAVING COUNT(*) > 1
            ) sub;
        """
        dup_result = await conn.execute(text(dup_query))
        dups = dup_result.fetchall()
        has_dups = False
        for issue, count in dups:
            if count > 0:
                print(f'  WARNING: {issue}: {count}')
                has_dups = True
        if not has_dups:
            print('  OK No duplicate records found')
        
        # Check NULL values in critical fields
        print('\n=== NULL CHECKS (Critical Fields) ===')
        null_query = """
            SELECT 'questions with NULL content' as issue, COUNT(*) as count FROM question WHERE content IS NULL
            UNION ALL
            SELECT 'users with NULL username' as issue, COUNT(*) as count FROM "user" WHERE username IS NULL
            UNION ALL
            SELECT 'exams with NULL title' as issue, COUNT(*) as count FROM exam WHERE title IS NULL
            UNION ALL
            SELECT 'knowledge_nodes with NULL name' as issue, COUNT(*) as count FROM knowledge_node WHERE name IS NULL
            UNION ALL
            SELECT 'question_skill_tag with NULL skill_name' as issue, COUNT(*) as count FROM question_skill_tag WHERE skill_name IS NULL;
        """
        null_result = await conn.execute(text(null_query))
        nulls = null_result.fetchall()
        has_nulls = False
        for issue, count in nulls:
            if count > 0:
                print(f'  WARNING: {issue}: {count}')
                has_nulls = True
        if not has_nulls:
            print('  OK No NULL values in critical fields')
        
        # Check data distribution
        print('\n=== DATA DISTRIBUTION ===')
        dist_query = """
            SELECT 'exams by status' as info, status::text as label, COUNT(*) as count FROM exam GROUP BY status
            UNION ALL
            SELECT 'users by role' as info, r.name as label, COUNT(*) as count FROM "user" u JOIN role r ON u.role_id = r.id GROUP BY r.name
            UNION ALL
            SELECT 'questions by difficulty' as info, difficulty_level::text as label, COUNT(*) as count FROM question WHERE difficulty_level IS NOT NULL GROUP BY difficulty_level;
        """
        dist_result = await conn.execute(text(dist_query))
        dists = dist_result.fetchall()
        for info, label, count in dists:
            print(f'  {info} [{label}]: {count}')
        
        # Check alembic version
        print('\n=== ALEMBIC VERSION ===')
        alembic_result = await conn.execute(text("SELECT version_num FROM alembic_version"))
        versions = alembic_result.fetchall()
        for v in versions:
            print(f'  Current migration: {v[0]}')
    
    await engine.dispose()

asyncio.run(check())
