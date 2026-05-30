"""
migrate_v16.py — Add lifecycle timestamps to snapshots and datasets
====================================================================
Adds departed_at, airborne_at, landed_at, last_status_change, and
last_position_update columns to both ae_flight_snapshots and ae_flight_dataset.

Run: python migrate_v16.py
"""

import sys
import os
from sqlalchemy import text
from app.database import SessionLocal

def run():
    db = SessionLocal()
    try:
        print("Starting migration v16...")

        tables = ["ae_flight_snapshots", "ae_flight_dataset"]
        columns = {
            "departed_at": "TIMESTAMP WITH TIME ZONE",
            "airborne_at": "TIMESTAMP WITH TIME ZONE",
            "landed_at": "TIMESTAMP WITH TIME ZONE",
            "last_status_change": "TIMESTAMP WITH TIME ZONE",
            "last_position_update": "TIMESTAMP WITH TIME ZONE"
        }

        for table in tables:
            for col_name, col_type in columns.items():
                try:
                    db.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                    print(f"SUCCESS: Added column {col_name} to table {table}.")
                except Exception as e:
                    db.rollback()
                    print(f"NOTICE: Add column {col_name} to {table} error: {e}")

        db.commit()
        print("Migration v16 complete.")
    except Exception as exc:
        db.rollback()
        print(f"FATAL ERROR: Migration failed: {exc}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
