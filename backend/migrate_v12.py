"""
migrate_v12.py — Admin Approval Workflow strict constraints.
==============================================================
1. Adds `rejected_fields` JSON column to `users`.
2. Drops `id_fields_unlocked` and `correction_unlock_fields` from `users`.
3. Drops the `correction_requests` table entirely.
4. Ensures EXACTLY ONE super admin exists. If there are multiple, keeps the earliest and demotes the rest to 'admin'.
5. Adds partial unique index on `role` for 'super_admin'.

Run: python backend/migrate_v12.py
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.database import SessionLocal

def run():
    db = SessionLocal()
    try:
        # 1. & 2. Modify users table columns
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN rejected_fields JSON NULL"))
        except Exception as e:
            print(f"Notice (rejected_fields): {e}")
            db.rollback()

        # Remove legacy columns
        try:
            db.execute(text("ALTER TABLE users DROP COLUMN id_fields_unlocked"))
        except Exception:
            db.rollback()
            
        try:
            db.execute(text("ALTER TABLE users DROP COLUMN correction_unlock_fields"))
        except Exception:
            db.rollback()

        # 3. Drop correction_requests table
        try:
            db.execute(text("DROP TABLE IF EXISTS correction_requests CASCADE"))
        except Exception as e:
            print(f"Notice (drop table): {e}")
            db.rollback()

        # 4. Enforce exactly one super admin
        super_admins = db.execute(
            text("SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at ASC")
        ).fetchall()

        if len(super_admins) > 1:
            print(f"Found {len(super_admins)} super admins. Demoting extras...")
            # Keep the first one
            keep_id = super_admins[0][0]
            db.execute(
                text("UPDATE users SET role = 'admin' WHERE role = 'super_admin' AND id != :keep_id"),
                {"keep_id": keep_id}
            )
        
        # 5. Add partial unique index
        try:
            db.execute(text("CREATE UNIQUE INDEX ix_unique_super_admin ON users (role) WHERE role = 'super_admin'"))
        except Exception as e:
            print(f"Notice (create index): {e}")
            db.rollback()

        db.commit()
        print("✅ Migration v12 complete.")
    except Exception as exc:
        db.rollback()
        print(f"❌ Migration failed: {exc}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run()
