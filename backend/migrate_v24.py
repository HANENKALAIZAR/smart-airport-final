"""
migrate_v24.py — Add section-specific profile unlock columns to the users table
========================================================================================
Adds four new boolean columns to the users table for identity, passport, cin_doc, and contact sections.

Usage:
    cd backend
    python migrate_v24.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from sqlalchemy import text
from app.database import engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("migrate_v24")


def column_exists(conn, table_name: str, column_name: str) -> bool:
    result = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table_name AND column_name = :column_name"
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    return result.fetchone() is not None


def run():
    log.info("=== migrate_v24: Add profile section unlock flags ===")

    new_columns = [
        "profile_unlock_identity",
        "profile_unlock_passport",
        "profile_unlock_cin_doc",
        "profile_unlock_contact",
    ]

    with engine.begin() as conn:
        for col in new_columns:
            if column_exists(conn, "users", col):
                log.info(f"  SKIP  column '{col}' already exists in table 'users'")
            else:
                conn.execute(
                    text(f"ALTER TABLE users ADD COLUMN {col} BOOLEAN NOT NULL DEFAULT FALSE")
                )
                log.info(f"  ADD   column '{col}' to table 'users'")

    log.info("=== migrate_v24 complete ===")


if __name__ == "__main__":
    run()
