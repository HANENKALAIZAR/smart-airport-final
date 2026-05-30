"""
migrate_v15.py — Add soft deletion, passenger details, and assignment columns.
========================================================================
Adds columns to the messages table and drops the NOT NULL constraint on from_user_id.

Run: python migrate_v15.py
"""

import sys
import os
from sqlalchemy import text
from app.database import SessionLocal

def run():
    db = SessionLocal()
    try:
        print("Starting migration v15...")

        # 1. Alter from_user_id to be nullable
        try:
            db.execute(text("ALTER TABLE messages ALTER COLUMN from_user_id DROP NOT NULL"))
            print("SUCCESS: Altered columns: from_user_id is now NULLABLE.")
        except Exception as e:
            db.rollback()
            print(f"NOTICE: Alter columns from_user_id error: {e}")

        # 2. Add deleted_by_sender to messages
        try:
            db.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by_sender BOOLEAN DEFAULT FALSE"))
            print("SUCCESS: Added column deleted_by_sender to messages.")
        except Exception as e:
            db.rollback()
            print(f"NOTICE: Add deleted_by_sender error: {e}")

        # 3. Add deleted_by_recipient to messages
        try:
            db.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by_recipient BOOLEAN DEFAULT FALSE"))
            print("SUCCESS: Added column deleted_by_recipient to messages.")
        except Exception as e:
            db.rollback()
            print(f"NOTICE: Add deleted_by_recipient error: {e}")

        # 4. Add passenger columns to messages
        cols = {
            "passenger_name": "VARCHAR(200)",
            "passenger_email": "VARCHAR(200)",
            "airport_code": "VARCHAR(10)",
            "sender_type": "VARCHAR(50) DEFAULT 'internal'",
            "assigned_admin_id": "INTEGER",
            "assigned_admin_name": "VARCHAR(200)",
            "assigned_at": "TIMESTAMP"
        }
        for col_name, col_type in cols.items():
            try:
                db.execute(text(f"ALTER TABLE messages ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                print(f"SUCCESS: Added column {col_name} to messages.")
            except Exception as e:
                db.rollback()
                print(f"NOTICE: Add column {col_name} error: {e}")

        db.commit()
        print("Migration v15 complete.")
    except Exception as exc:
        db.rollback()
        print(f"FATAL ERROR: Migration failed: {exc}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
