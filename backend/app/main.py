"""
Smart Airport Operations – FastAPI Application
================================================
Entry point for the backend server.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

import logging
import logging.config
from contextlib import asynccontextmanager

import bcrypt
# Passlib 1.7.4 compatibility with bcrypt 4.0+
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type('about', (object,), {'__version__': bcrypt.__version__})

# Mock bcrypt.hashpw to truncate long passwords (fixes ValueError in passlib 1.7.4 + bcrypt 4.1+)
_original_hashpw = bcrypt.hashpw
def _patched_hashpw(password, salt):
    if isinstance(password, str):
        p_bytes = password.encode('utf-8')
    else:
        p_bytes = password
    if len(p_bytes) > 72:
        # Passlib's check uses a 72+ char string, which bcrypt 4.1+ rejects.
        # We truncate to 72 to keep passlib happy.
        p_bytes = p_bytes[:72]
    return _original_hashpw(p_bytes, salt)
bcrypt.hashpw = _patched_hashpw

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings

# ── Logging configuration ─────────────────────────────────────────────────
logging.config.dictConfig({
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
})

logger = logging.getLogger(__name__)

# ── Rate limiter (shared instance) ───────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── Routers ───────────────────────────────────────────────────────────────
from app.routers import opensky, aviationstack

_optional_routers = []
try:
    from app.routers import flights, predictions, auth, dashboard, airports, users, messages, notifications
    _optional_routers = [flights, predictions, auth, dashboard, airports, users, messages, notifications]
except ImportError as e:
    logger.warning(f"Some routers unavailable (missing deps): {e}")


# ── Lifespan ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the AI model at startup for fast first-prediction response."""
    try:
        from app.services.prediction_service import load_model
        load_model()
        logger.info("AI model loaded successfully at startup")
    except Exception as e:
        logger.warning(f"AI model could not be loaded at startup: {e}")

    yield

    logger.info("Server shutting down")


# ── Application ───────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered flight delay prediction with explainable insights",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Rate limiting ─────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
for mod in _optional_routers:
    app.include_router(mod.router)

app.include_router(opensky.router)
app.include_router(aviationstack.router)


# ── Root & Health ─────────────────────────────────────────────────────────

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
