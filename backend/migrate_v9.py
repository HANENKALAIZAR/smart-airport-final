"""
Migration v9: AI alerts persistence (ai_alerts table).

Run: .venv\\Scripts\\python.exe migrate_v9.py
"""

from sqlalchemy import text

from app.database import engine


print("Running v9 migration (AI alerts)...")
dialect = engine.dialect.name

with engine.connect() as conn:
    if dialect == "postgresql":
        # enum for decision
        try:
            conn.execute(
                text(
                    "DO $$ BEGIN "
                    "IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_alert_decision_enum') THEN "
                    "CREATE TYPE ai_alert_decision_enum AS ENUM ('pending','approved','rejected'); "
                    "END IF; "
                    "END $$;"
                )
            )
        except Exception as e:
            print(f"  ENUM NOTE: {e}")

        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS ai_alerts ("
                "  id VARCHAR(36) PRIMARY KEY,"
                "  flight_number VARCHAR(32) NOT NULL,"
                "  airport_iata VARCHAR(3) NOT NULL,"
                "  airport_name VARCHAR(150) NOT NULL,"
                "  risk_pct SMALLINT NOT NULL DEFAULT 0,"
                "  cause TEXT NOT NULL DEFAULT '',"
                "  recommendation TEXT NOT NULL DEFAULT '',"
                "  decision ai_alert_decision_enum NOT NULL DEFAULT 'pending',"
                "  acted_by_admin_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,"
                "  decided_at TIMESTAMP NULL,"
                "  created_at TIMESTAMP NOT NULL DEFAULT NOW()"
                ");"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_ai_alert_airport_flight ON ai_alerts (airport_iata, flight_number);"
            )
        )
    else:
        # SQLite-style best effort
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS ai_alerts ("
                "  id TEXT PRIMARY KEY,"
                "  flight_number TEXT NOT NULL,"
                "  airport_iata TEXT NOT NULL,"
                "  airport_name TEXT NOT NULL,"
                "  risk_pct INTEGER NOT NULL DEFAULT 0,"
                "  cause TEXT NOT NULL DEFAULT '',"
                "  recommendation TEXT NOT NULL DEFAULT '',"
                "  decision TEXT NOT NULL DEFAULT 'pending',"
                "  acted_by_admin_id INTEGER NULL,"
                "  decided_at TEXT NULL,"
                "  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                ");"
            )
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS idx_ai_alert_airport_flight ON ai_alerts (airport_iata, flight_number);")
        )

    conn.commit()

print("Migration v9 complete.")

