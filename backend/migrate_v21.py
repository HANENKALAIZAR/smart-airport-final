"""
migrate_v21.py — FlightAware Smart Enrichment Columns
======================================================
Adds targeted-verification columns to ae_flight_snapshots:

  Cooldown & audit
    fa_last_called_at     TIMESTAMPTZ   — when FA was last called for this flight
    fa_call_count         INTEGER       — how many times FA has been called
    fa_call_reason        VARCHAR(100)  — why FA was triggered (e.g. 'ae_actual_missing')

  FA-sourced gate/terminal (stored separately from AE values)
    fa_dep_gate           VARCHAR(10)
    fa_arr_gate           VARCHAR(10)
    fa_dep_terminal       VARCHAR(10)
    fa_arr_terminal       VARCHAR(10)

  Original AE times (preserved before any FA correction)
    ae_dep_actual         TIMESTAMP     — original AE dep_actual before FA overwrite
    ae_arr_actual         TIMESTAMP     — original AE arr_actual before FA overwrite

  Source-tracking for displayed values
    displayed_dep_source  VARCHAR(20)   — 'aviation_edge' or 'flightaware'
    displayed_arr_source  VARCHAR(20)   — 'aviation_edge' or 'flightaware'

  Verification flag (set by AE ingestion when AE data has a gap)
    needs_fa_verification BOOLEAN       — triggers FA enrichment on next scheduler cycle

Usage:
    cd backend
    python migrate_v21.py
"""

import sys
import os

# Allow running from project root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from sqlalchemy import text
from app.database import engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("migrate_v21")

TABLE = "ae_flight_snapshots"

NEW_COLUMNS = [
    # (column_name, sql_type, default_clause)
    ("fa_last_called_at",     "TIMESTAMPTZ",   None),
    ("fa_call_count",         "INTEGER",        "DEFAULT 0"),
    ("fa_call_reason",        "VARCHAR(100)",   None),
    ("fa_dep_gate",           "VARCHAR(10)",    None),
    ("fa_arr_gate",           "VARCHAR(10)",    None),
    ("fa_dep_terminal",       "VARCHAR(10)",    None),
    ("fa_arr_terminal",       "VARCHAR(10)",    None),
    ("ae_dep_actual",         "TIMESTAMP",      None),
    ("ae_arr_actual",         "TIMESTAMP",      None),
    ("displayed_dep_source",  "VARCHAR(20)",    None),
    ("displayed_arr_source",  "VARCHAR(20)",    None),
    ("needs_fa_verification", "BOOLEAN",        "DEFAULT FALSE"),
]

NEW_INDEXES = [
    ("idx_ae_snapshot_fa_verify",  "needs_fa_verification"),
    ("idx_ae_snapshot_fa_called",  "fa_last_called_at"),
]


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
    log.info("=== migrate_v21: FlightAware Smart Enrichment Columns ===")

    with engine.begin() as conn:
        added_cols = 0
        for col_name, col_type, default in NEW_COLUMNS:
            if column_exists(conn, TABLE, col_name):
                log.info(f"  SKIP  column '{col_name}' already exists")
                continue
            default_sql = f" {default}" if default else ""
            sql = f"ALTER TABLE {TABLE} ADD COLUMN {col_name} {col_type}{default_sql}"
            conn.execute(text(sql))
            log.info(f"  ADD   column '{col_name}' {col_type}{default_sql}")
            added_cols += 1

        added_idx = 0
        for idx_name, col_name in NEW_INDEXES:
            if index_exists(conn, idx_name):
                log.info(f"  SKIP  index '{idx_name}' already exists")
                continue
            conn.execute(
                text(f"CREATE INDEX {idx_name} ON {TABLE} ({col_name})")
            )
            log.info(f"  CREATE INDEX {idx_name} ON {TABLE}({col_name})")
            added_idx += 1

    log.info(
        f"=== migrate_v21 complete: {added_cols} columns added, {added_idx} indexes created ==="
    )


if __name__ == "__main__":
    run()
