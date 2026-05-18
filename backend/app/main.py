"""
Smart Airport Operations - FastAPI Application
==============================================
Entry point for the backend server.

Run with (from the /backend directory):
    python -m uvicorn app.main:app --reload --port 8000
"""

import logging
import logging.config
import logging.handlers
from contextlib import asynccontextmanager


# Monkeypatch bcrypt for passlib 1.7.4 incompatibility with bcrypt 4.0.0+
import bcrypt
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = bcrypt

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.config import settings


class _JsonFormatter(logging.Formatter):
    """Single-line JSON log formatter — compatible with ELK, Datadog, CloudWatch."""
    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        import json, traceback as tb_mod
        payload: dict = {
            "ts":      self.formatTime(record, "%Y-%m-%dT%H:%M:%SZ"),
            "level":   record.levelname,
            "logger":  record.name,
            "msg":     record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = tb_mod.format_exception(*record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def _build_logging_config() -> dict:
    """Build dictConfig using JSON formatter + daily rotating file (14-day retention)."""
    is_debug = settings.DEBUG
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {"()": _JsonFormatter},
            "plain": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                # Plain text in dev (easier to read); JSON in prod
                "formatter": "plain" if is_debug else "json",
            },
            "file": {
                "class": "logging.FileHandler",
                "filename": "app.log",
                "encoding": "utf-8",
                "formatter": "json",     # Always JSON on disk for aggregators
            },
        },
        "root": {
            "level": "DEBUG" if is_debug else "INFO",
            "handlers": ["console", "file"],
        },
        # Quieten noisy third-party loggers
        "loggers": {
            "uvicorn.access": {"level": "INFO", "propagate": True},
            "apscheduler":    {"level": "WARNING", "propagate": True},
        },
    }

logging.config.dictConfig(_build_logging_config())

# Route uvicorn logs to our root logger for structured JSON output
for _logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
    _uvicorn_logger = logging.getLogger(_logger_name)
    _uvicorn_logger.handlers.clear()
    _uvicorn_logger.propagate = True


logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

from app.routers import aviation_edge
from app.routers import alerts
from app.routers import ae_dataset
from app.routers import intelligence
from app.routers import passenger as passenger_router

# Ensure AE pipeline tables (including new intelligence tables) are registered
import app.models.ae_models  # noqa: F401  (AEFlightSnapshot, AEFlightDataset, AEFutureSchedule, AEAviationStats)

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

# ── Global Exception Handlers ─────────────────────────────────────────────
# All errors return the standardized envelope: { "data": null, "error": "..." }

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP 4xx/5xx with standardized { data, error } envelope."""
    logger.warning(f"HTTP {exc.status_code} on {request.url.path}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"data": None, "error": str(exc.detail)},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors (422) with a clean message."""
    errors = [f"{'.'.join(str(l) for l in e['loc'])}: {e['msg']}" for e in exc.errors()]
    message = "; ".join(errors)
    logger.warning(f"Validation error on {request.url.path}: {message}")
    return JSONResponse(
        status_code=422,
        content={"data": None, "error": message},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all handler — prevents raw tracebacks leaking to clients."""
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"data": None, "error": "Internal server error. Please try again later."},
    )

# ── CORS ──────────────────────────────────────────────────────────────────
# Use explicit origins from config — wildcard '*' is rejected by browsers
# when credentials are required.
_cors_origins = settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)

app.add_middleware(SlowAPIMiddleware)

for mod in _optional_routers:
    app.include_router(mod.router)

app.include_router(aviation_edge.router)
app.include_router(alerts.router)
app.include_router(ae_dataset.router)
app.include_router(intelligence.router)
app.include_router(passenger_router.router)


@app.get("/")
def root():
    return {
        "data": {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "status": "running",
        },
        "error": None,
    }


@app.get("/health")
def health_check():
    return {"data": {"status": "healthy"}, "error": None}

