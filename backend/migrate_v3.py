"""
Migration v3: add personal_email column to users table.
Run: .venv\\Scripts\\python.exe migrate_v3.py
"""
from app.database import engine
from sqlalchemy import text

migrations = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255)",
]

print("Running v3 migration...")
with engine.connect() as conn:
    for sql in migrations:
        try:
            conn.execute(text(sql))
            print(f"  OK {sql.strip()[:70]}")
        except Exception as e:
            print(f"  SKIP: {e}")
    conn.commit()

print("Migration v3 complete.")
