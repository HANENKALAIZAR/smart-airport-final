"""
migrate_v20.py
==============
Adds raw_status column to ae_flight_snapshots.
Safe to run on an existing database — the column is nullable with no default constraints, so existing rows are unaffected.

Run from the /backend directory:
    python migrate_v20.py
"""

import os
import sys
from pathlib import Path

# Ensure backend app is importable
sys.path.insert(0, str(Path(__file__).parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

from app.database import engine
from sqlalchemy import text

def run():
    print("Starting migration v20 (raw_status column)...")
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE ae_flight_snapshots ADD COLUMN raw_status VARCHAR(20);"))
            print("SUCCESS: added raw_status to ae_flight_snapshots.")
        except Exception as e:
            # Column might already exist, which is fine
            print(f"Note/Error adding raw_status (column may already exist): {e}")

if __name__ == "__main__":
    run()
