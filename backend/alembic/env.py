import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.core.config import settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

from app.models.base import Base
from app.models.user import User, Role
from app.models.question import KnowledgeNode, Resource, Question, Answer, QuestionSubItem
from app.models.exam import Matrix, MatrixRule, Exam, ExamForm, ExamFormQuestion, ExamFormAnswer, ExamParticipant, ExamSubmission, ExamSubmissionAnswer, ExamTrackingLog
from app.models.grading import ExamResult, IrtTask
from app.models.grading import ExamResult, IrtTask
from app.models.omr import OmrJob, OmrSheet
from app.models.audit import AuditLog
from app.models.obsidian import ObsidianSyncRun, ObsidianFile
from app.models.passage import Passage
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
