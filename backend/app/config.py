"""
Smart Airport Operations - Application Configuration
====================================================
All secrets come from the .env file - never hardcode them here.
"""

import logging
import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Smart Airport Operations"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    TESTING: bool = False
    RUN_STARTUP_TASKS: bool = True

    DB_USER: str = "postgres"
    DB_PASS: str = ""
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "smart_airport"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASS}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    MODEL_DIR: str = str(Path(__file__).resolve().parent / "ai" / "model")

    AVIATION_EDGE_KEY: str = ""
    HISTORICAL_DAYS: int = 2
    OPENWEATHER_KEY: str = ""

    # ── FlightAware AeroAPI (secondary enrichment provider) ───────────────
    FLIGHTAWARE_API_KEY: str = ""
    FLIGHTAWARE_BASE_URL: str = "https://aeroapi.flightaware.com/aeroapi"
    FLIGHTAWARE_ENABLED: bool = True
    FLIGHTAWARE_ENRICH_INTERVAL_MINUTES: int = 15   # scheduler job interval
    FLIGHTAWARE_CACHE_TTL_SECONDS: int = 180         # per-ident TTL dedup cache
    FLIGHTAWARE_TIMEOUT_SECONDS: float = 5.0         # HTTP timeout (hard limit)
    FLIGHTAWARE_WINDOW_PAST_HOURS: int = 2           # enrich flights up to 2h ago
    FLIGHTAWARE_WINDOW_FUTURE_HOURS: int = 12        # enrich flights up to 12h ahead

    COLLECTION_INTERVAL_HOURS: int = 12
    MIN_TRAIN_SAMPLES: int = 300

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    FRONTEND_URL: str = "http://localhost:5173"

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:8082",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8082",
    ]

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env")
        if os.getenv("TESTING", "").lower() in {"1", "true", "yes", "on"}
        else str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

if not settings.SECRET_KEY:
    raise RuntimeError(
        "FATAL: SECRET_KEY is not set in .env — the application cannot start securely. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
