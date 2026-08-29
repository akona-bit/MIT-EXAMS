from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    PROJECT_NAME: str = "MIT EXAMS"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./mit_exams.db"

    # JWT Authentication
    SECRET_KEY: str = "your_super_secret_jwt_key_here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SUPABASE_JWT_SECRET: str = ""

    # PostHog analytics
    POSTHOG_PROJECT_TOKEN: Optional[str] = None
    POSTHOG_HOST: Optional[str] = None

    class Config:
        env_file = BACKEND_DIR / ".env"
        extra = "ignore"


settings = Settings()


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton used by main.py PostHog init."""
    return Settings()
