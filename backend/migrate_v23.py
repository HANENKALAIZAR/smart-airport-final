"""
migrate_v23.py — Expand id_document_status_enum with new expired-verification statuses
========================================================================================
Adds three new values to the PostgreSQL enum type used for id_document_status:
  - expired_verification
  - archived
  - permanently_rejected

These values support the Super Admin expired-verification workflow introduced in v23:
  - A background sweeper sets status to 'expired_verification' after 30 days of inactivity.
  - Super Admin can then: reopen (→ rejected), archive (→ archived), or permanently reject.

Usage:
    cd backend
    python migrate_v23.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from sqlalchemy import text
from app.database import engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("migrate_v23")

ENUM_NAME = "id_document_status_enum"
NEW_VALUES = ["expired_verification", "archived", "permanently_rejected"]


def enum_value_exists(conn, enum_name: str, value: str) -> bool:
    result = conn.execute(
        text(
            "SELECT 1 FROM pg_enum e "
            "JOIN pg_type t ON t.oid = e.enumtypid "
            "WHERE t.typname = :enum_name AND e.enumlabel = :value"
        ),
        {"enum_name": enum_name, "value": value},
    )
    return result.fetchone() is not None


def run():
    log.info("=== migrate_v23: Expand id_document_status_enum ===")

    with engine.begin() as conn:
        for value in NEW_VALUES:
            if enum_value_exists(conn, ENUM_NAME, value):
                log.info(f"  SKIP  enum value '{value}' already exists")
            else:
                conn.execute(
                    text(f"ALTER TYPE {ENUM_NAME} ADD VALUE :val"),
                    {"val": value},
                )
                log.info(f"  ADD   enum value '{value}' to {ENUM_NAME}")

    log.info("=== migrate_v23 complete ===")


if __name__ == "__main__":
    run()
