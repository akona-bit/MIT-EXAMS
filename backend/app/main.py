from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="MIT EXAMS API",
    description="API for MIT EXAMS platform",
    version="1.0.0",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.api.v1 import auth, knowledge, questions, matrix, exams, grading, omr, statistics, admin

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev, restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(knowledge.router, prefix="/api/v1/knowledge", tags=["Knowledge"])
app.include_router(questions.router, prefix="/api/v1/questions", tags=["Questions"])
app.include_router(matrix.router, prefix="/api/v1/matrix", tags=["Matrix"])
app.include_router(exams.router, prefix="/api/v1/exams", tags=["Exams"])
app.include_router(grading.router, prefix="/api/v1/grading", tags=["Grading"])
app.include_router(omr.router, prefix="/api/v1/omr", tags=["OMR"])
app.include_router(statistics.router, prefix="/api/v1/statistics", tags=["Statistics"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

@app.get("/api/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint to verify the API is running.
    """
    return {"status": "ok"}
