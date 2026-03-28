"""
Migration v5: ID document review fields + password_reset_tokens.

Run: .venv\\Scripts\\python.exe migrate_v5.py
"""
from app.database import engine
from sqlalchemy import text

print("Running v5 migration...")
dialect = engine.dialect.name

with engine.connect() as conn:
    if dialect == "postgresql":
        conn.execute(
            text(
                """
                DO $$ BEGIN
                    CREATE TYPE id_document_status_enum AS ENUM ('pending', 'approved', 'rejected');
                EXCEPTION WHEN duplicate_object THEN NULL;
                END $$
                """
            )
        )
        for sql in (
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS id_document_status id_document_status_enum",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS id_document_rejection_reason TEXT",
        ):
            try:
                conn.execute(text(sql))
                print(f"  OK {sql[:70]}")
            except Exception as e:
                print(f"  SKIP: {e}")

        conn.execute(
            text(
                """
                UPDATE users SET id_document_status = 'approved'
                WHERE profile_complete = 1 AND id_document_status IS NULL AND role = 'admin'
                """
            )
        )

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id VARCHAR(36) PRIMARY KEY,
                    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token VARCHAR(255) NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    used SMALLINT NOT NULL DEFAULT 0
                )
                """
            )
        )
        print("  OK password_reset_tokens")
    else:
        print(f"  NOTE dialect={dialect}: run Postgres migration for production; dev SQLite uses metadata create_all")
    conn.commit()

print("Migration v5 complete.")
