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

    AVIATIONSTACK_KEY: str = ""
    AVIATIONSTACK_MAX_REQUESTS: int = 80
    HISTORICAL_DAYS: int = 2
    OPENWEATHER_KEY: str = ""

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
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=None
        if os.getenv("TESTING", "").lower() in {"1", "true", "yes", "on"}
        else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

if not settings.SECRET_KEY:
    logging.warning(
        "SECRET_KEY is not set in .env - JWT authentication will fail. "
        "Generate one: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
