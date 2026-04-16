"""
migrate_v11.py — Admin Onboarding Approval Workflow Migration
==============================================================
Auto-approves any airport admin who already has:
  - profile_complete = 1
  - id_document_status is NULL or 'pending'

This prevents existing working admins from being locked out after the
new approval gate is enforced. New admins must go through the full
approval workflow (pending → super admin approves → approved).

Run: python backend/migrate_v11.py
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.database import SessionLocal

def run():
    db = SessionLocal()
    try:
        result = db.execute(
            text("""
                UPDATE users
                SET id_document_status = 'approved'
                WHERE role = 'admin'
                  AND profile_complete = 1
                  AND (id_document_status IS NULL OR id_document_status = 'pending')
            """)
        )
        db.commit()
        print(f"✅ Migration complete: {result.rowcount} admin(s) auto-approved.")
    except Exception as exc:
        db.rollback()
        print(f"❌ Migration failed: {exc}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run()
