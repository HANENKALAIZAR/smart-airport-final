"""
Smart Airport Operations - FastAPI Application
==============================================
Entry point for the backend server.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

import logging
import logging.config
from contextlib import asynccontextmanager



from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.config import settings


logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
            },
            "file": {
                "class": "logging.FileHandler",
                "filename": "app.log",
                "formatter": "default",
                "encoding": "utf-8",
            },
        },
        "root": {
            "level": "DEBUG" if settings.DEBUG else "INFO",
            "handlers": ["console", "file"],
        },
    }
)

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

from app.routers import aviationstack, opensky

_optional_routers = []
try:
    from app.routers import (
        airports,
        auth,
        dashboard,
        flights,
        messages,
        ml,
        notifications,
        predictions,
        users,
    )

    _optional_routers = [
        flights,
        predictions,
        auth,
        dashboard,
        airports,
        users,
        messages,
        notifications,
        ml,
    ]
except ImportError as exc:
    logger.warning(f"Some routers unavailable (missing deps): {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load AI model + start scheduler. Shutdown: stop scheduler."""
    if settings.TESTING or not settings.RUN_STARTUP_TASKS:
        logger.info("Skipping startup tasks because testing mode is active")
        yield
        logger.info("Server shutdown complete")
        return

    try:
        from app.services.prediction_service import load_model

        load_model()
        logger.info("AI model loaded at startup")
    except Exception as exc:
        logger.warning(f"AI model could not be loaded at startup: {exc}")

    try:
        from app.scheduler import start_scheduler

        start_scheduler()
    except Exception as exc:
        logger.warning(f"Scheduler could not start: {exc}")

    yield

    try:
        from app.scheduler import stop_scheduler

        stop_scheduler()
    except Exception:
        pass
    logger.info("Server shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered flight delay prediction with explainable insights",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SlowAPIMiddleware)

for mod in _optional_routers:
    app.include_router(mod.router)

app.include_router(opensky.router)
app.include_router(aviationstack.router)


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
