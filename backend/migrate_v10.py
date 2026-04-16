"""
Migration v10: Production AI pipeline upgrades (PostgreSQL only).

Changes:
  1. flights        — ADD flight_date, dep_iata, arr_iata, source
                       ADD UNIQUE (flight_number, flight_date)
  2. weather_conditions — ADD UNIQUE (airport_id, recorded_at)
  3. flight_features — ADD temperature_c, wind_speed_kmh, visibility_km,
                            precipitation_mm, feature_version
                       ENSURE is_holiday column exists
  4. predictions    — make flight_id NULLABLE; ADD flight_number
  5. CREATE model_metrics table

Run:
    cd backend
    .venv\\Scripts\\python.exe migrate_v10.py
"""

from sqlalchemy import text
from app.database import engine

print("=" * 60)
print("  Migration v10 — Production AI Pipeline")
print("=" * 60)


def run(conn, label, sql):
    try:
        conn.execute(text(sql))
        print(f"  ✅  {label}")
    except Exception as e:
        print(f"  ⚠️   {label}: {e}")


with engine.connect() as conn:

    # ── 1. flights: new columns ──────────────────────────────────────
    run(conn, "flights: ADD flight_date",
        "ALTER TABLE flights ADD COLUMN IF NOT EXISTS flight_date DATE")
    run(conn, "flights: ADD dep_iata",
        "ALTER TABLE flights ADD COLUMN IF NOT EXISTS dep_iata VARCHAR(3)")
    run(conn, "flights: ADD arr_iata",
        "ALTER TABLE flights ADD COLUMN IF NOT EXISTS arr_iata VARCHAR(3)")
    run(conn, "flights: ADD source",
        "ALTER TABLE flights ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual'")

    # Backfill flight_date from scheduled_departure
    run(conn, "flights: backfill flight_date",
        "UPDATE flights SET flight_date = scheduled_departure::DATE WHERE flight_date IS NULL")

    # Unique index (partial — only where both values are non-null)
    run(conn, "flights: unique index (flight_number, flight_date)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_flight_number_date "
        "ON flights (flight_number, flight_date) "
        "WHERE flight_date IS NOT NULL AND flight_number IS NOT NULL")

    # ── 2. weather_conditions: unique constraint ─────────────────────
    run(conn, "weather_conditions: unique (airport_id, recorded_at)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_weather_airport_time "
        "ON weather_conditions (airport_id, recorded_at)")

    # ── 3. flight_features: new columns ─────────────────────────────
    run(conn, "flight_features: ADD is_holiday (ensure)",
        "ALTER TABLE flight_features ADD COLUMN IF NOT EXISTS "
        "is_holiday SMALLINT NOT NULL DEFAULT 0")
    run(conn, "flight_features: ADD temperature_c",
        "ALTER TABLE flight_features ADD COLUMN IF NOT EXISTS temperature_c DECIMAL(5,2)")
    run(conn, "flight_features: ADD wind_speed_kmh",
        "ALTER TABLE flight_features ADD COLUMN IF NOT EXISTS wind_speed_kmh DECIMAL(6,2)")
    run(conn, "flight_features: ADD visibility_km",
        "ALTER TABLE flight_features ADD COLUMN IF NOT EXISTS visibility_km DECIMAL(5,2)")
    run(conn, "flight_features: ADD precipitation_mm",
        "ALTER TABLE flight_features ADD COLUMN IF NOT EXISTS precipitation_mm DECIMAL(5,2)")
    run(conn, "flight_features: ADD feature_version",
        "ALTER TABLE flight_features ADD COLUMN IF NOT EXISTS "
        "feature_version VARCHAR(10) DEFAULT 'v1'")

    # Mark all existing (synthetic) rows as v1 so they are reprocessed by the pipeline
    run(conn, "flight_features: tag existing rows as v1",
        "UPDATE flight_features SET feature_version = 'v1' WHERE feature_version IS NULL")

    # ── 4. predictions: nullable flight_id + flight_number col ───────
    run(conn, "predictions: DROP NOT NULL on flight_id",
        "ALTER TABLE predictions ALTER COLUMN flight_id DROP NOT NULL")
    run(conn, "predictions: ADD flight_number",
        "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS "
        "flight_number VARCHAR(10)")

    # ── 5. model_metrics table ───────────────────────────────────────
    run(conn, "CREATE model_metrics",
        """
        CREATE TABLE IF NOT EXISTS model_metrics (
            id                SERIAL PRIMARY KEY,
            model_version     VARCHAR(30)  NOT NULL,
            trained_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
            n_train_samples   INTEGER,
            n_test_samples    INTEGER,
            train_cutoff_date DATE,
            accuracy          DECIMAL(5,4),
            precision_score   DECIMAL(5,4),
            recall            DECIMAL(5,4),
            f1                DECIMAL(5,4),
            roc_auc           DECIMAL(5,4),
            mae_minutes       DECIMAL(6,2),
            rmse_minutes      DECIMAL(6,2),
            r2_score          DECIMAL(5,4),
            feature_columns   JSON,
            hyperparams       JSON,
            notes             TEXT,
            is_active         SMALLINT NOT NULL DEFAULT 0
        )
        """)

    conn.commit()

print("=" * 60)
print("  Migration v10 complete.")
print("=" * 60)
