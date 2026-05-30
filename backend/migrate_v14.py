"""
migrate_v14.py — Add cin_document_back_url to users table.
========================================================================
Adds `cin_document_back_url` TEXT NULL column to `users` table.

Run: python migrate_v14.py
"""

import sys
import os
from sqlalchemy import text
from app.database import SessionLocal

def run():
    db = SessionLocal()
    try:
        print("Starting migration v14...")

        # 1. Add cin_document_back_url to users
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN cin_document_back_url TEXT"))
            print("SUCCESS: Added column cin_document_back_url to users.")
        except Exception as e:
            db.rollback()
            if "already exists" in str(e):
                print("INFO: Column cin_document_back_url already exists.")
            else:
                print(f"NOTICE: cin_document_back_url error: {e}")

        db.commit()
        print("Migration v14 complete.")
    except Exception as exc:
        db.rollback()
        print(f"FATAL ERROR: Migration failed: {exc}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
