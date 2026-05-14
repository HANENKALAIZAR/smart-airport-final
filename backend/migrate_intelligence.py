"""
Migration: Add ae_future_schedules and ae_aviation_stats tables

Run with:
    cd backend
    python migrate_intelligence.py

Or via Alembic if preferred — this standalone script is safe to run
multiple times (CREATE TABLE IF NOT EXISTS semantics).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def run():
    from app.database import Base, engine
    import app.models.ae_models  # registers all AE ORM classes with Base

    logger.info("Creating intelligence tables if they don't exist...")
    try:
        # create_all is idempotent — skips existing tables
        Base.metadata.create_all(
            bind=engine,
            tables=[
                Base.metadata.tables["ae_future_schedules"],
                Base.metadata.tables["ae_aviation_stats"],
            ],
        )
        logger.info("  ✔  ae_future_schedules — OK")
        logger.info("  ✔  ae_aviation_stats   — OK")
        logger.info("Migration complete.")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


if __name__ == "__main__":
    run()
