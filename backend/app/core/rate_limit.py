"""
Rate Limiting Infrastructure for WatchNet.
Uses SlowAPI with Redis token-bucket / in-memory storage fallback.
Provides standard limiters for authentication endpoints and general public APIs.
"""
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import redis
from app.core.config import settings

logger = logging.getLogger("watchnet.rate_limit")

def get_real_client_ip(request: Request) -> str:
    """
    Extracts the client IP address considering reverse proxies (X-Forwarded-For).
    Falls back to request.client.host if not present.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)

# Probe redis availability; fallback to memory storage for tests / standalone mode
storage_uri = "memory://"
if settings.REDIS_URL and settings.REDIS_URL.startswith("redis"):
    try:
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.5, socket_timeout=0.5)
        r.ping()
        storage_uri = settings.REDIS_URL
        logger.info("Rate limiter connected to Redis storage.")
    except Exception:
        logger.info("Redis not reachable at startup; rate limiter falling back to in-memory storage.")
        storage_uri = "memory://"

# Limiter instance
limiter = Limiter(
    key_func=get_real_client_ip,
    default_limits=["1000/hour"],
    storage_uri=storage_uri,
    strategy="fixed-window"
)

def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Custom handler returning RFC-compliant 429 Too Many Requests response."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}",
            "retry_after": getattr(exc, "retry_after", 60)
        },
        headers={"Retry-After": str(getattr(exc, "retry_after", 60))}
    )

