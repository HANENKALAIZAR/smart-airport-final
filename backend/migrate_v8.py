"""
Migration v8: Correction request field selection + user.correction_unlock_fields;
add 'fulfilled' to correction_request status; requested_fields on correction_requests.

Run: .venv\\Scripts\\python.exe migrate_v8.py
"""
from sqlalchemy import text

from app.database import engine

print("Running v8 migration...")
dialect = engine.dialect.name

with engine.connect() as conn:
    if dialect == "postgresql":
        try:
            conn.execute(
                text(
                    "ALTER TYPE correction_request_status_enum ADD VALUE IF NOT EXISTS 'fulfilled'"
                )
            )
            print("  OK ADD VALUE fulfilled to correction_request_status_enum")
        except Exception as e:
            print(f"  ENUM NOTE: {e}")

        for sql in (
            "ALTER TABLE correction_requests ADD COLUMN IF NOT EXISTS requested_fields JSONB DEFAULT '[]'::jsonb",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS correction_unlock_fields JSONB",
        ):
            try:
                conn.execute(text(sql))
                print(f"  OK {sql[:70]}")
            except Exception as e:
                print(f"  SKIP: {e}")
    else:
        # SQLite / others: JSON as TEXT
        try:
            conn.execute(
                text(
                    "ALTER TABLE correction_requests ADD COLUMN requested_fields TEXT DEFAULT '[]'"
                )
            )
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN correction_unlock_fields TEXT"))
        except Exception:
            pass
        print(f"  NOTE dialect={dialect} — applied SQLite-style ALTER if needed.")

    conn.commit()

print("Migration v8 complete.")
