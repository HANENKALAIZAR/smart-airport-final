"""
Smart Airport Operations – Database Seeder
============================================
Loads data from flights_dataset.csv into MySQL via SQLAlchemy.
Can also run the SQL seed file directly.

Usage:
    python seed_database.py              # seed from CSV
    python seed_database.py --sql-only   # run seed_data.sql only
"""

import argparse
import csv
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

# ── Configuration ─────────────────────────────────────────────

DB_USER = os.environ.get("DB_USER", "root")
DB_PASS = os.environ.get("DB_PASS", "")
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "3306")
DB_NAME = os.environ.get("DB_NAME", "smart_airport")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

DATA_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = DATA_DIR.parent / "database" / "schema.sql"
SEED_SQL_PATH = DATA_DIR / "seed_data.sql"
CSV_PATH = DATA_DIR / "flights_dataset.csv"


def run_sql_file(engine, path: Path):
    """Execute a SQL file statement by statement."""
    print(f"📄 Running SQL file: {path.name}")
    sql_content = path.read_text(encoding="utf-8")

    # Split on semicolons but keep track of position
    statements = [s.strip() for s in sql_content.split(";") if s.strip()]

    with engine.connect() as conn:
        for i, stmt in enumerate(statements):
            if not stmt or stmt.startswith("--"):
                continue
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"  ⚠️  Statement {i+1} warning: {e}")
        conn.commit()
    print(f"  ✅ Executed {len(statements)} statements")


def create_schema(engine):
    """Create database schema from schema.sql."""
    if SCHEMA_PATH.exists():
        run_sql_file(engine, SCHEMA_PATH)
    else:
        print(f"  ⚠️  Schema file not found: {SCHEMA_PATH}")


def seed_from_sql(engine):
    """Run the generated seed_data.sql file."""
    if SEED_SQL_PATH.exists():
        run_sql_file(engine, SEED_SQL_PATH)
    else:
        print(f"  ⚠️  Seed SQL file not found: {SEED_SQL_PATH}")
        print("      Run generate_mock_data.py first!")


def seed_from_csv(engine):
    """Load flights_dataset.csv into the flights and flight_features tables."""
    if not CSV_PATH.exists():
        print(f"  ⚠️  CSV not found: {CSV_PATH}")
        print("      Run generate_mock_data.py first!")
        return

    print(f"📊 Loading CSV: {CSV_PATH.name}")
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"  Found {len(rows)} records")

    with engine.connect() as conn:
        for i, row in enumerate(rows):
            # Insert flight
            conn.execute(text("""
                INSERT INTO flights (flight_number, airline_id, origin_airport_id, dest_airport_id,
                    scheduled_departure, scheduled_arrival, actual_departure, actual_arrival,
                    status, delay_minutes, distance_km, aircraft_type)
                VALUES (
                    :flight_number,
                    (SELECT id FROM airlines WHERE iata_code = :airline_iata),
                    (SELECT id FROM airports WHERE iata_code = :origin_iata),
                    (SELECT id FROM airports WHERE iata_code = :dest_iata),
                    :sched_dep, :sched_arr, :act_dep, :act_arr,
                    :status, :delay_minutes, :distance_km, :aircraft_type
                )
            """), {
                "flight_number": row["flight_number"],
                "airline_iata": row["airline_iata"],
                "origin_iata": row["origin_iata"],
                "dest_iata": row["dest_iata"],
                "sched_dep": row["scheduled_departure"],
                "sched_arr": row["scheduled_arrival"],
                "act_dep": row["actual_departure"],
                "act_arr": row["actual_arrival"],
                "status": row["status"],
                "delay_minutes": int(row["delay_minutes"]),
                "distance_km": int(row["distance_km"]),
                "aircraft_type": row["aircraft_type"],
            })

            flight_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()

            # Insert flight features
            conn.execute(text("""
                INSERT INTO flight_features (flight_id, weather_severity, origin_weather_severity,
                    dest_weather_severity, hour_of_day, day_of_week, month, is_weekend, is_holiday,
                    congestion_level, origin_congestion, dest_congestion,
                    airline_reliability, distance_km, historical_delay_rate, is_delayed, delay_minutes)
                VALUES (
                    :fid, :ws, :ows, :dws, :hod, :dow, :mo, :we, :hol,
                    :cl, :oc, :dc, :ar, :dk, :hdr, :isd, :dm
                )
            """), {
                "fid": flight_id,
                "ws": float(row["weather_severity"]),
                "ows": float(row["origin_weather_severity"]),
                "dws": float(row["dest_weather_severity"]),
                "hod": int(row["hour_of_day"]),
                "dow": int(row["day_of_week"]),
                "mo": int(row["month"]),
                "we": int(row["is_weekend"]),
                "hol": int(row["is_holiday"]),
                "cl": float(row["congestion_level"]),
                "oc": float(row["origin_congestion"]),
                "dc": float(row["dest_congestion"]),
                "ar": float(row["airline_reliability"]),
                "dk": int(row["distance_km"]),
                "hdr": float(row["historical_delay_rate"]),
                "isd": int(row["is_delayed"]),
                "dm": int(row["delay_minutes"]),
            })

            if (i + 1) % 500 == 0:
                print(f"  Inserted {i+1}/{len(rows)} flights...")
                conn.commit()

        conn.commit()

    print(f"  ✅ Loaded {len(rows)} flights + features into MySQL")


def main():
    parser = argparse.ArgumentParser(description="Seed Smart Airport database")
    parser.add_argument("--sql-only", action="store_true", help="Only run seed_data.sql")
    parser.add_argument("--schema", action="store_true", help="Create schema first")
    args = parser.parse_args()

    print("🔌 Connecting to MySQL...")
    engine = create_engine(DATABASE_URL, echo=False)

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("  ✅ Connected!")
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
        print(f"     URL: mysql://{DB_USER}:***@{DB_HOST}:{DB_PORT}/{DB_NAME}")
        print("     Set DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_NAME env vars")
        sys.exit(1)

    if args.schema:
        create_schema(engine)

    if args.sql_only:
        seed_from_sql(engine)
    else:
        seed_from_sql(engine)  # airports, airlines, rights
        seed_from_csv(engine)  # full flight dataset

    print("\n🎉 Database seeding complete!")


if __name__ == "__main__":
    main()
