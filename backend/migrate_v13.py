"""
migrate_v13.py — Final stabilization for Admin Management & Weather Sync.
========================================================================
1. Adds `correction_attempts` column to `users` table.
2. Fixes `weather_conditions` index: makes `idx_airport_time` unique to support ON CONFLICT.

Run: python migrate_v13.py
"""

import sys
import os
from sqlalchemy import text
from app.database import SessionLocal

def run():
    db = SessionLocal()
    try:
        print("Starting migration v13...")

        # 1. Add correction_attempts to users
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN correction_attempts INTEGER DEFAULT 0 NOT NULL"))
            print("SUCCESS: Added column correction_attempts to users.")
        except Exception as e:
            db.rollback()
            if "already exists" in str(e):
                print("INFO: Column correction_attempts already exists.")
            else:
                print(f"NOTICE: correction_attempts error: {e}")

        # 2. Fix weather_conditions index
        try:
            # Drop existing non-unique index if it exists
            db.execute(text("DROP INDEX IF EXISTS idx_airport_time"))
            # Create unique index
            db.execute(text("CREATE UNIQUE INDEX idx_airport_time ON weather_conditions (airport_id, recorded_at)"))
            print("SUCCESS: Created unique index idx_airport_time on weather_conditions.")
        except Exception as e:
            db.rollback()
            print(f"NOTICE: weather index error: {e}")

        db.commit()
        print("Migration v13 complete.")
    except Exception as exc:
        db.rollback()
        print(f"FATAL ERROR: Migration failed: {exc}")
        # Re-raise without emojis
    finally:
        db.close()

if __name__ == "__main__":
    run()
