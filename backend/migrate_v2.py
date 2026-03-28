"""
Migration: add new columns to users table and create audit_log.
Run once: .venv\\Scripts\\python.exe migrate_v2.py
"""
from app.database import engine
from sqlalchemy import text

migrations = [
    # New user profile columns
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete SMALLINT NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number VARCHAR(50)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS id_document_url TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT",
    # id_type enum
    """
    DO $$ BEGIN
        CREATE TYPE id_type_enum AS ENUM ('CIN', 'Passport');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS id_type id_type_enum",
    # Audit log table
    """
    CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        super_admin_id INTEGER NOT NULL REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        target_name VARCHAR(120) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )
    """,
]

print("Running v2 migration...")
with engine.connect() as conn:
    for sql in migrations:
        try:
            conn.execute(text(sql))
            short = sql.strip().split('\n')[0][:60]
            print(f"  OK {short}")
        except Exception as e:
            print(f"  SKIP: {e}")
    conn.commit()

print("\nMigration complete.")
