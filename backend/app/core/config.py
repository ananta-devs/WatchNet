import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List

# Base directory dynamically computed relative to repository root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_BACKUP_DIR = str(REPO_ROOT / "backups")

class Settings(BaseSettings):
    PROJECT_NAME: str = "WatchNet"
    VERSION: str = "1.0.0-rc.1"
    API_V1_STR: str = "/api/v1"
    
    # Security & JWT
    SECRET_KEY: str = Field(default="watchnet-secret-super-secure-key-change-in-production-32chars!", description="Cryptographic secret key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/watchnet",
        description="Async PostgreSQL connection string"
    )
    DATABASE_URL_SYNC: str = Field(
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/watchnet",
        description="Sync PostgreSQL connection string for Alembic"
    )
    
    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0", description="Redis cache/broker URL")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000"
    ]
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # Backups directory
    BACKUP_DIR: str = Field(
        default=DEFAULT_BACKUP_DIR,
        description="Directory where backups are stored"
    )
    
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )

settings = Settings()
