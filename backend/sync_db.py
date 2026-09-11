import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.models.base import Base

# Import all models so they are registered with Base.metadata
from app.models.user import User, Role
from app.models.otp import OTPToken
from app.models.question import KnowledgeNode, ResourceType, Question, Answer, QuestionSubItem
from app.models.exam import Matrix, MatrixRule, Exam, ExamForm, ExamFormQuestion, ExamFormAnswer, ExamParticipant, ExamSubmission, ExamSubmissionAnswer, ExamTrackingLog
from app.models.grading import ExamResult, IrtTask, ItemAnalysisResult
from app.models.omr import OmrJob, OmrSheet
from app.models.audit import AuditLog
from app.models.obsidian import ObsidianSyncRun, ObsidianFile
from app.models.passage import Passage
from app.models.system import SystemSetting
from app.models.feedback import Feedback
from app.models.notification import Notification, NotificationType
from app.models.student_profile import StudentActivityDaily, StudentKnowledgeMastery

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        print("Creating missing tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Done!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
