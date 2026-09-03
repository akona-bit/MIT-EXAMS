import os
from celery import Celery

# Configure Celery
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

is_local = REDIS_URL == "redis://localhost:6379/0"

celery_app = Celery(
    "exams_worker",
    broker=REDIS_URL,
    backend=REDIS_URL if not is_local else None,
    include=["app.services.grading.scorer", "app.services.omr.tasks", "app.services.email_tasks"]
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],  
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_always_eager=REDIS_URL == "redis://localhost:6379/0", # Bỏ qua Redis khi chạy máy ảo local
)
