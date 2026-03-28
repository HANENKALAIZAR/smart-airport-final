"""
Migration v4: widen id_document_url and profile_photo_url to TEXT.

VARCHAR(2000) overflows when the frontend sends full JPEG/PNG base64 data URLs
(Postgres raises StringDataRightTruncation on POST /api/users/me/profile).

Run: .venv\\Scripts\\python.exe migrate_v4.py
"""
from app.database import engine
from sqlalchemy import text

print("Running v4 migration...")
dialect = engine.dialect.name

with engine.connect() as conn:
    if dialect == "postgresql":
        for sql in (
            "ALTER TABLE users ALTER COLUMN id_document_url TYPE TEXT",
            "ALTER TABLE users ALTER COLUMN profile_photo_url TYPE TEXT",
        ):
            try:
                conn.execute(text(sql))
                print(f"  OK {sql}")
            except Exception as e:
                print(f"  SKIP: {e}")
    else:
        print(f"  NOTE dialect={dialect}: skipping ALTER TYPE (use fresh schema or SQLite)")
    conn.commit()

print("Migration v4 complete.")
