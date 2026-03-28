"""
Migration v6: in_app_notifications, correction_requests, id_fields_unlocked.

Run: .venv\\Scripts\\python.exe migrate_v6.py
"""
from app.database import engine
from sqlalchemy import text

print("Running v6 migration...")
dialect = engine.dialect.name

with engine.connect() as conn:
    if dialect == "postgresql":
        conn.execute(
            text(
                """
                DO $$ BEGIN
                    CREATE TYPE correction_request_status_enum AS ENUM ('pending', 'unlocked', 'dismissed');
                EXCEPTION WHEN duplicate_object THEN NULL;
                END $$
                """
            )
        )
        stmts = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS id_fields_unlocked SMALLINT NOT NULL DEFAULT 0",
            """
            CREATE TABLE IF NOT EXISTS in_app_notifications (
                id VARCHAR(36) PRIMARY KEY,
                recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                kind VARCHAR(64) NOT NULL,
                body TEXT NOT NULL,
                context JSONB,
                is_read SMALLINT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS correction_requests (
                id VARCHAR(36) PRIMARY KEY,
                admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                status correction_request_status_enum NOT NULL DEFAULT 'pending',
                super_admin_note TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
        ]
        for sql in stmts:
            try:
                conn.execute(text(sql))
                first = sql.strip().split("\n")[0][:70]
                print(f"  OK {first}")
            except Exception as e:
                print(f"  SKIP: {e}")
        for idx_sql in (
            "CREATE INDEX IF NOT EXISTS ix_in_app_notif_recipient ON in_app_notifications (recipient_user_id)",
            "CREATE INDEX IF NOT EXISTS ix_in_app_notif_read ON in_app_notifications (is_read)",
            "CREATE INDEX IF NOT EXISTS ix_correction_admin ON correction_requests (admin_id)",
        ):
            try:
                conn.execute(text(idx_sql))
            except Exception as e:
                print(f"  IDX SKIP: {e}")
    else:
        print(f"  NOTE dialect={dialect}")
    conn.commit()

print("Migration v6 complete.")
