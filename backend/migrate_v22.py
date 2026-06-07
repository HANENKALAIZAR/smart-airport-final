"""
migrate_v22.py — User Profile Edit Unlock and CIN Uniqueness Index
==================================================================
Adds:
  1. profile_edit_unlocked Column to users table
  2. ix_users_cin_unique partial unique index to users table

Usage:
    cd backend
    python migrate_v22.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from sqlalchemy import text
from app.database import engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("migrate_v22")

TABLE = "users"


def column_exists(conn, table: str, col: str) -> bool:
    result = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :tbl AND column_name = :col"
        ),
        {"tbl": table, "col": col},
    )
    return result.fetchone() is not None


def index_exists(conn, idx_name: str) -> bool:
    result = conn.execute(
        text(
            "SELECT 1 FROM pg_indexes WHERE indexname = :idx"
        ),
        {"idx": idx_name},
    )
    return result.fetchone() is not None


def run():
    log.info("=== migrate_v22: User Profile Unlock Column & CIN Unique Index ===")

    with engine.begin() as conn:
        # 1. Add profile_edit_unlocked column
        col_name = "profile_edit_unlocked"
        if column_exists(conn, TABLE, col_name):
            log.info(f"  SKIP  column '{col_name}' already exists")
        else:
            conn.execute(text(f"ALTER TABLE {TABLE} ADD COLUMN {col_name} BOOLEAN NOT NULL DEFAULT FALSE"))
            log.info(f"  ADD   column '{col_name}' BOOLEAN NOT NULL DEFAULT FALSE")

        # 2. Add partial unique index on cin_number
        idx_name = "ix_users_cin_unique"
        if index_exists(conn, idx_name):
            log.info(f"  SKIP  index '{idx_name}' already exists")
        else:
            conn.execute(text(
                f"CREATE UNIQUE INDEX {idx_name} ON {TABLE} (cin_number) "
                f"WHERE cin_number IS NOT NULL"
            ))
            log.info(f"  CREATE UNIQUE INDEX {idx_name} ON {TABLE}(cin_number) WHERE cin_number IS NOT NULL")

    log.info("=== migrate_v22 complete ===")


if __name__ == "__main__":
    run()
