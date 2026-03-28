"""
Smart Airport Operations – Application Configuration
=====================================================
All secrets come from the .env file — never hardcode them here.
"""

import logging
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Application ──
    APP_NAME: str = "Smart Airport Operations"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Database ──
    DB_USER: str = "postgres"          # postgres default, not root
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

    # ── JWT Authentication ──
    SECRET_KEY: str = ""               # MUST be set in .env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── AI Model ──
    MODEL_DIR: str = str(Path(__file__).resolve().parent / "ai" / "model")

    # ── External APIs ──
    AVIATIONSTACK_KEY: str = ""        # Set in .env — never hardcode

    # ── Email (Gmail SMTP) ──
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # ── Frontend ──
    FRONTEND_URL: str = "http://localhost:5173"

    # ── CORS ──
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# ── Validate critical settings at startup ────────────────────────────────
if not settings.SECRET_KEY:
    logging.warning(
        "SECRET_KEY is not set in .env — JWT authentication will fail. "
        "Generate one: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
