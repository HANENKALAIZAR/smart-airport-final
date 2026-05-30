"""
migrate_v19.py
==============
Adds FlightAware provider metadata columns to ae_flight_snapshots.

Safe to run on an existing database — all columns are nullable with no
default constraints, so existing rows are unaffected.

New columns on ae_flight_snapshots:
  raw_flightaware_payload  JSONB   — full FA API response for debugging
  last_verified_by         VARCHAR — provider name ('flightaware')
  last_verified_at         TIMESTAMPTZ — when FA last enriched this row
  provider_sources         JSONB   — structured audit of each provider's contribution

Run from the /backend directory:
    python migrate_v19.py
"""

import os
import sys
from pathlib import Path

# Ensure backend app is importable
sys.path.insert(0, str(Path(__file__).parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

import psycopg2


def run():
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASS", "")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "smart_airport")

    dsn = f"host={db_host} port={db_port} dbname={db_name} user={db_user} password={db_pass}"

    print(f"[migrate_v19] Connecting to {db_host}:{db_port}/{db_name} ...")
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("[migrate_v19] Adding provider metadata columns to ae_flight_snapshots ...")

        # Add raw_flightaware_payload (JSONB)
        cur.execute("""
            ALTER TABLE ae_flight_snapshots
            ADD COLUMN IF NOT EXISTS raw_flightaware_payload JSONB;
        """)
        print("[migrate_v19]   + raw_flightaware_payload JSONB")

        # Add last_verified_by (VARCHAR 30)
        cur.execute("""
            ALTER TABLE ae_flight_snapshots
            ADD COLUMN IF NOT EXISTS last_verified_by VARCHAR(30);
        """)
        print("[migrate_v19]   + last_verified_by VARCHAR(30)")

        # Add last_verified_at (TIMESTAMPTZ)
        cur.execute("""
            ALTER TABLE ae_flight_snapshots
            ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
        """)
        print("[migrate_v19]   + last_verified_at TIMESTAMPTZ")

        # Add provider_sources (JSONB)
        cur.execute("""
            ALTER TABLE ae_flight_snapshots
            ADD COLUMN IF NOT EXISTS provider_sources JSONB;
        """)
        print("[migrate_v19]   + provider_sources JSONB")

        # Optional: add a partial index for faster enrichment window queries
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_ae_snapshot_enrich_candidate
            ON ae_flight_snapshots (snapshot_date, status, dep_scheduled)
            WHERE status IN ('scheduled', 'delayed', 'unknown');
        """)
        print("[migrate_v19]   + idx_ae_snapshot_enrich_candidate (partial index)")

        conn.commit()
        print("[migrate_v19] SUCCESS — migration complete.")

    except Exception as e:
        conn.rollback()
        print(f"[migrate_v19] FAILED — rolled back: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run()
