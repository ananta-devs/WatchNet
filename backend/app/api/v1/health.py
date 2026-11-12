from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timezone
import redis.asyncio as aioredis

from app.core.database import get_db
from app.core.config import settings
from app.schemas.domain import HealthCheckResponse, VersionResponse

router = APIRouter(tags=["System"])

@router.get("/health", response_model=HealthCheckResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        
    redis_status = "healthy"
    try:
        r = aioredis.from_url(settings.REDIS_URL, socket_timeout=2)
        await r.ping()
        await r.close()
    except Exception as e:
        redis_status = f"unhealthy: {str(e)}"
        
    overall = "healthy" if db_status == "healthy" and redis_status == "healthy" else "degraded"
    
    return HealthCheckResponse(
        status=overall,
        database=db_status,
        redis=redis_status,
        timestamp=datetime.now(timezone.utc)
    )

@router.get("/version", response_model=VersionResponse)
async def get_version():
    return VersionResponse(
        version=settings.VERSION,
        project=settings.PROJECT_NAME,
        environment="development"
    )
