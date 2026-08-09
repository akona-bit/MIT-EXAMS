from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "MIT EXAMS"
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./mit_exams.db"

    # JWT Authentication
    SECRET_KEY: str = "your_super_secret_jwt_key_here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"

settings = Settings()
