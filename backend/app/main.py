import atexit
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from posthog import Posthog
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.error_log import log_error
from app.schemas.user import TokenPayload

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


class PostHogContextMiddleware:
    """Bind an authenticated user to PostHog for the duration of a request."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        posthog_client = getattr(scope["app"].state, "posthog_client", None)
        distinct_id = self._get_authenticated_user_id(scope)
        if posthog_client and distinct_id:
            with posthog_client.new_context():
                posthog_client.identify_context(distinct_id)
                await self.app(scope, receive, send)
            return

        await self.app(scope, receive, send)

    @staticmethod
    def _get_authenticated_user_id(scope):
        """Read the stable user primary key from a valid bearer token."""
        authorization = dict(scope.get("headers", [])).get(b"authorization", b"")
        scheme, _, token = authorization.decode("latin-1").partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None

        settings = get_settings()
        try:
            payload = jwt.decode(
                token, settings.SUPABASE_JWT_SECRET, algorithms=[settings.ALGORITHM],
                options={"verify_aud": False}
            )
            return payload.get("sub")
        except (JWTError, TypeError, ValueError):
            return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and flush the shared PostHog client with the application."""
    settings = get_settings()
    project_token = settings.POSTHOG_PROJECT_TOKEN
    host = settings.POSTHOG_HOST

    if project_token and host:
        posthog_client = Posthog(
            project_api_key=project_token,
            host=host,
            enable_exception_autocapture=True,
        )
        app.state.posthog_client = posthog_client
        atexit.register(posthog_client.shutdown)
    else:
        missing_variable = (
            "POSTHOG_PROJECT_TOKEN" if not project_token else "POSTHOG_HOST"
        )
        message = (
            f"{missing_variable} variable required by PostHog is missing or "
            f"un-configured, this causes events to be silently missed. This error "
            f"stops appearing once {missing_variable} is configured"
        )
        if settings.DEBUG:
            raise RuntimeError(message)
        logger.warning(message)

    yield

    posthog_client = getattr(app.state, "posthog_client", None)
    if posthog_client:
        posthog_client.flush()


app = FastAPI(
    title="MIT EXAMS API",
    description="API for MIT EXAMS platform",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(PostHogContextMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log_error(f"Unhandled exception: {request.method} {request.url.path} - {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

from app.api.v1 import auth
from app.api.v1 import users
from app.api.v1 import knowledge
from app.api.v1 import questions
from app.api.v1 import matrix
from app.api.v1 import exams
from app.api.v1 import grading
from app.api.v1 import omr
from app.api.v1 import statistics
from app.api.v1 import admin
from app.api.v1 import obsidian
from app.api.v1 import resources
from app.api.v1 import analytics
from app.api.v1 import advanced_analytics
from app.api.v1 import passages
from app.api.v1 import vector
from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(knowledge.router, prefix="/api/v1/knowledge", tags=["Knowledge"])
app.include_router(questions.router, prefix="/api/v1/questions", tags=["Questions"])
app.include_router(passages.router, prefix="/api/v1/passages", tags=["Passages"])
app.include_router(matrix.router, prefix="/api/v1/matrix", tags=["Matrix"])
app.include_router(exams.router, prefix="/api/v1/exams", tags=["Exams"])
app.include_router(grading.router, prefix="/api/v1/grading", tags=["Grading"])
app.include_router(omr.router, prefix="/api/v1/omr", tags=["OMR"])
app.include_router(statistics.router, prefix="/api/v1/statistics", tags=["Statistics"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(obsidian.router, prefix="/api/v1/obsidian", tags=["Obsidian"])
app.include_router(resources.router, prefix="/api/v1/resources", tags=["Resources"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(advanced_analytics.router, prefix="/api/v1/advanced-analytics", tags=["Advanced Analytics"])
app.include_router(vector.router, prefix="/api/v1/vector", tags=["Vector / Semantic Search"])

resource_upload_dir = Path(__file__).resolve().parents[1] / "uploads" / "resources"
resource_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/resources", StaticFiles(directory=resource_upload_dir), name="resource-files")

@app.get("/api/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint to verify the API is running.
    """
    return {"status": "ok"}

from fastapi import WebSocket, WebSocketDisconnect
from typing import Set
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        await self.broadcast_online_users()

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        # We can't await broadcast here because it's sync, we'll schedule it
        asyncio.create_task(self.broadcast_online_users())

    async def broadcast_online_users(self):
        count = len(self.active_connections)
        
        # Lấy dữ liệu fraud từ DB
        fraud_alerts = []
        try:
            from app.db.database import AsyncSessionLocal
            from sqlalchemy import select, func
            from sqlalchemy.orm import selectinload
            from app.models.exam import ExamParticipant, ExamTrackingLog, ParticipantStatus
            from app.models.system import SystemSetting
            
            async with AsyncSessionLocal() as session:
                setting_result = await session.execute(select(SystemSetting).where(SystemSetting.key == "FRAUD_THRESHOLD"))
                setting = setting_result.scalars().first()
                threshold = int(setting.value) if setting and setting.value.isdigit() else 3

                # Đếm số event theo participant đang thi
                stmt = select(
                    ExamParticipant,
                    func.count(ExamTrackingLog.id).label('risk_score')
                ).outerjoin(
                    ExamTrackingLog, ExamParticipant.id == ExamTrackingLog.exam_participant_id
                ).where(
                    ExamParticipant.status == ParticipantStatus.IN_PROGRESS
                ).group_by(ExamParticipant.id).options(selectinload(ExamParticipant.user))
                
                result = await session.execute(stmt)
                for participant, risk_score in result.all():
                    fraud_alerts.append({
                        "session_id": participant.id,
                        "exam_id": participant.exam_id,
                        "user_id": participant.user_id,
                        "student_name": participant.user.full_name if participant.user else "Unknown",
                        "risk_score": risk_score,
                        "status": participant.status.value,
                        "flagged": risk_score > threshold
                    })
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error fetching fraud alerts: {e}")

        for connection in list(self.active_connections):
            try:
                await connection.send_json({
                    "onlineUsers": count,
                    "fraud_alerts": fraud_alerts
                })
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/ws/online")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
