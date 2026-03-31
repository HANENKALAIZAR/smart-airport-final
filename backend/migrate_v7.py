"""
Migration v7: Staff profile expansion — employee_id, nationality, gender, address,
emergency contacts, CIN + Passport columns; remove id_type/id_number/id_document_url.

Run: .venv\\Scripts\\python.exe migrate_v7.py
"""
import re

from sqlalchemy import text

from app.database import engine

print("Running v7 migration...")
dialect = engine.dialect.name

with engine.connect() as conn:
    if dialect == "postgresql":
        stmts = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(32)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality VARCHAR(120)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS residential_address TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(40)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(30)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS cin_number VARCHAR(50)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS cin_document_url TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_number VARCHAR(50)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_document_url TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_expiry_date DATE",
        ]
        for sql in stmts:
            try:
                conn.execute(text(sql))
                print(f"  OK {sql[:80]}")
            except Exception as e:
                print(f"  SKIP: {e}")

        # Unique index on employee_id (nullable allowed)
        try:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_employee_id_unique "
                    "ON users (employee_id) WHERE employee_id IS NOT NULL AND TRIM(employee_id) <> ''"
                )
            )
            print("  OK partial unique index on employee_id")
        except Exception as e:
            print(f"  INDEX SKIP: {e}")

        # Migrate legacy id_* into cin or passport before drop
        conn.execute(
            text(
                """
                UPDATE users SET cin_number = id_number, cin_document_url = id_document_url
                WHERE id_type::text = 'CIN' AND cin_number IS NULL AND id_number IS NOT NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE users SET passport_number = id_number, passport_document_url = id_document_url
                WHERE id_type::text = 'Passport' AND passport_number IS NULL AND id_number IS NOT NULL
                """
            )
        )

        for drop_sql in (
            "ALTER TABLE users DROP COLUMN IF EXISTS id_type",
            "ALTER TABLE users DROP COLUMN IF EXISTS id_number",
            "ALTER TABLE users DROP COLUMN IF EXISTS id_document_url",
        ):
            try:
                conn.execute(text(drop_sql))
                print(f"  OK {drop_sql}")
            except Exception as e:
                print(f"  DROP SKIP: {e}")

        try:
            conn.execute(text("DROP TYPE IF EXISTS id_type_enum CASCADE"))
            print("  OK DROP TYPE id_type_enum")
        except Exception as e:
            print(f"  DROP TYPE SKIP: {e}")

        # Backfill employee_id for admins missing it (max suffix per airport + increment)
        result = conn.execute(
            text(
                """
                SELECT DISTINCT airport_iata FROM users
                WHERE role = 'admin' AND airport_iata IS NOT NULL
                """
            )
        )
        airports = [r[0] for r in result.fetchall()]
        for iata in airports:
            row = conn.execute(
                text(
                    """
                    SELECT COALESCE(MAX(
                        CASE
                            WHEN employee_id ~ '^[A-Z]{3}-[0-9]{4}$'
                            THEN SUBSTRING(employee_id FROM 5 FOR 4)::int
                            ELSE 0
                        END
                    ), 0) AS mx
                    FROM users
                    WHERE role = 'admin' AND airport_iata = :iata
                    """
                ),
                {"iata": iata},
            ).fetchone()
            next_n = int(row[0] or 0) if row else 0
            missing = conn.execute(
                text(
                    """
                    SELECT id FROM users
                    WHERE role = 'admin' AND airport_iata = :iata
                    AND (employee_id IS NULL OR TRIM(employee_id) = '')
                    ORDER BY id ASC
                    """
                ),
                {"iata": iata},
            ).fetchall()
            for (uid,) in missing:
                next_n += 1
                eid = f"{iata}-{next_n:04d}"
                conn.execute(
                    text("UPDATE users SET employee_id = :eid WHERE id = :uid"),
                    {"eid": eid, "uid": uid},
                )
        print("  OK backfill employee_id per airport")

    else:
        print(f"  NOTE dialect={dialect} — run PostgreSQL migration manually.")

    conn.commit()

print("Migration v7 complete.")
