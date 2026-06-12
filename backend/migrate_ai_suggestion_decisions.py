"""
Migration: add ai_suggestion_decisions table for persisted approve/reject workflow.

Usage:
    cd backend
    python migrate_ai_suggestion_decisions.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import engine
from app.config import settings


def run():
    print("[migrate_ai_suggestion_decisions] Starting migration...")

    inspector = __import__("sqlalchemy", fromlist=["inspect"]).inspect(engine)
    if "ai_suggestion_decisions" in inspector.get_table_names():
        print("[migrate_ai_suggestion_decisions] Table already exists. Skipping.")
        return

    dialect = engine.dialect.name

    with engine.connect() as conn:
        if dialect == "postgresql":
            conn.execute(text("""
                CREATE TABLE ai_suggestion_decisions (
                    id               SERIAL PRIMARY KEY,
                    suggestion_key   VARCHAR(200) NOT NULL,
                    airport_iata     VARCHAR(3) NOT NULL,
                    suggestion_type  VARCHAR(30) NOT NULL,
                    status           VARCHAR(10) NOT NULL DEFAULT 'approved',
                    admin_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    timestamp        TIMESTAMP NOT NULL DEFAULT NOW(),
                    suggestion_payload JSONB NULL
                )
            """))
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_aisd_key ON ai_suggestion_decisions (suggestion_key)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_aisd_airport ON ai_suggestion_decisions (airport_iata)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_aisd_status ON ai_suggestion_decisions (status)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_aisd_admin ON ai_suggestion_decisions (admin_user_id)
            """))
        else:
            conn.execute(text("""
                CREATE TABLE ai_suggestion_decisions (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    suggestion_key   VARCHAR(200) NOT NULL,
                    airport_iata     VARCHAR(3) NOT NULL,
                    suggestion_type  VARCHAR(30) NOT NULL,
                    status           VARCHAR(10) NOT NULL DEFAULT 'approved',
                    admin_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    timestamp        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    suggestion_payload JSON NULL
                )
            """))
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_aisd_key ON ai_suggestion_decisions (suggestion_key)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_aisd_airport ON ai_suggestion_decisions (airport_iata)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_aisd_status ON ai_suggestion_decisions (status)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_aisd_admin ON ai_suggestion_decisions (admin_user_id)
            """))
        conn.commit()

    print("[migrate_ai_suggestion_decisions] SUCCESS — table created.")


if __name__ == "__main__":
    run()
