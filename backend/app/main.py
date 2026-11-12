from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.middleware.audit import AuditLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.api.v1 import (
    auth,
    health,
    devices,
    discovery,
    monitoring,
    topology,
    plugins,
    notifications,
    workflows,
    events_stream,
    metrics,
    multisite,
    routers,
    family,
    system
)
from app.services.plugins.plugin_registry import PluginRegistry, register_all_upstream_plugins
from app.services.plugins.plugin_scheduler import PluginScheduler

setup_logging()

# Global scheduler instance
scheduler = PluginScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions: Register upstream plugins & start scheduler
    registry = PluginRegistry.get_instance()
    register_all_upstream_plugins(registry)
    await scheduler.start()
    yield
    # Shutdown actions
    await scheduler.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# Attach SlowAPI rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Administrative Audit Logging middleware
app.add_middleware(AuditLoggingMiddleware)

# API Routers
app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(devices.router, prefix=settings.API_V1_STR)
app.include_router(discovery.router, prefix=settings.API_V1_STR)
app.include_router(monitoring.router, prefix=settings.API_V1_STR)
app.include_router(topology.router, prefix=settings.API_V1_STR)
app.include_router(plugins.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(workflows.router, prefix=settings.API_V1_STR)
app.include_router(events_stream.router, prefix=settings.API_V1_STR)
app.include_router(metrics.router, prefix=settings.API_V1_STR)
app.include_router(multisite.router, prefix=settings.API_V1_STR)
app.include_router(routers.router, prefix=settings.API_V1_STR)
app.include_router(family.router, prefix=settings.API_V1_STR)
app.include_router(system.router, prefix=settings.API_V1_STR)
