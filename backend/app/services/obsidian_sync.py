from datetime import datetime, timezone
import hashlib
from typing import Any, Dict, List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.obsidian import ObsidianFile, ObsidianSyncRun
from app.services.obsidian_api_client import ObsidianApiClient
from app.services.obsidian_parser import ObsidianParser


class ObsidianSyncService:
    def __init__(self, db: AsyncSession, creator_id: int):
        self.db = db
        self.creator_id = creator_id

    async def sync(
        self,
        api_url: str,
        api_key: str,
        verify_ssl: bool = True,
    ) -> Dict[str, Any]:
        sync_run = ObsidianSyncRun(api_url=api_url, status='RUNNING')
        self.db.add(sync_run)
        await self.db.flush()

        results: Dict[str, Any] = {
            'success': 0,
            'skipped': 0,
            'error': 0,
            'details': [],
            'sync_run_id': sync_run.id,
        }
        parser = ObsidianParser(self.db, self.creator_id)
        client = ObsidianApiClient(api_url, api_key, verify_ssl=verify_ssl)

        try:
            files_data = await client.get_all_markdown_contents()
            for filename, file_content in files_data:
                result = await self._sync_file(parser, filename, file_content, sync_run.id)
                results[result['status']] += 1
                results['details'].append({
                    'file': filename,
                    'status': result['status'],
                    'reason': result.get('reason'),
                    'question_id': result.get('question_id'),
                    'wikilinks': result.get('wikilinks', []),
                })

            sync_run.success_count = results['success']
            sync_run.skipped_count = results['skipped']
            sync_run.error_count = results['error']
            sync_run.status = 'COMPLETED'
        except Exception:
            sync_run.status = 'FAILED'
            raise
        finally:
            sync_run.finished_at = datetime.now(timezone.utc)
            await self.db.commit()

        return results

    async def _sync_file(
        self,
        parser: ObsidianParser,
        filename: str,
        content: str,
        sync_run_id: int,
    ) -> Dict[str, Any]:
        checksum = hashlib.sha256(content.encode('utf-8')).hexdigest()
        existing_result = await self.db.execute(
            select(ObsidianFile).where(ObsidianFile.file_path == filename)
        )
        existing = existing_result.scalars().first()

        if existing and existing.checksum == checksum and existing.status == 'SYNCED':
            return {'status': 'skipped', 'reason': 'File unchanged', 'question_id': existing.question_id}

        try:
            parent_question_id = existing.question_id if existing else None
            result = await parser.parse_and_import(
                filename,
                content,
                parent_question_id=parent_question_id,
            )
            if result['status'] != 'success':
                if existing:
                    existing.status = 'SKIPPED'
                    existing.last_error = result.get('reason')
                return result

            if existing:
                existing.checksum = checksum
                existing.status = 'SYNCED'
                existing.question_id = result.get('question_id')
                existing.last_error = None
                existing.last_synced_at = datetime.now(timezone.utc)
            else:
                self.db.add(ObsidianFile(
                    file_path=filename,
                    checksum=checksum,
                    status='SYNCED',
                    question_id=result.get('question_id'),
                    last_synced_at=datetime.now(timezone.utc),
                ))
            return result
        except Exception as error:
            if existing:
                existing.status = 'ERROR'
                existing.last_error = str(error)
            return {'status': 'error', 'reason': str(error)}
