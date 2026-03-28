"""
Quick migration: add missing columns to the users table.
Run once after cloning on a machine that already has an older schema.
"""
from app.database import engine
from sqlalchemy import text

migrations = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS airport_iata VARCHAR(3)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password SMALLINT NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
]

with engine.connect() as conn:
    for sql in migrations:
        try:
            conn.execute(text(sql))
            print(f"OK {sql}")
        except Exception as e:
            print(f"SKIP (already exists?): {e}")
    conn.commit()

print("\nMigration complete.")
