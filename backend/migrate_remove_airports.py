"""
One-shot migration: Remove decommissioned airports from the database.
=====================================================================
Removes SFA (Sfax), TOE (Tozeur), TBJ (Tabarka), GAF (Gafsa) and all
linked records (flights, weather, predictions, features, users).

Only TUN, MIR, DJE, NBE are retained.

Usage:
    python migrate_remove_airports.py
"""

import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.database import engine

REMOVED_IATAS = ("SFA", "TOE", "TBJ", "GAF")


def run():
    with engine.begin() as conn:
        # 1. Find airport IDs to remove
        rows = conn.execute(
            text("SELECT id, iata_code FROM airports WHERE iata_code IN :codes"),
            {"codes": REMOVED_IATAS},
        ).fetchall()

        if not rows:
            print("[OK] No decommissioned airports found in the database -- already clean.")
            return

        airport_ids = [r[0] for r in rows]
        print(f"[DELETE] Found {len(rows)} airports to remove: {[r[1] for r in rows]}")

        # 2. Remove flight_features linked to flights at these airports
        res = conn.execute(text("""
            DELETE FROM flight_features
            WHERE flight_id IN (
                SELECT id FROM flights
                WHERE origin_airport_id IN :ids OR dest_airport_id IN :ids
            )
        """), {"ids": tuple(airport_ids)})
        print(f"   Deleted {res.rowcount} flight_features rows")

        # 3. Remove predictions linked to those flights
        res = conn.execute(text("""
            DELETE FROM predictions
            WHERE flight_id IN (
                SELECT id FROM flights
                WHERE origin_airport_id IN :ids OR dest_airport_id IN :ids
            )
        """), {"ids": tuple(airport_ids)})
        print(f"   Deleted {res.rowcount} predictions rows")

        # 4. Remove weather conditions for these airports
        res = conn.execute(text("""
            DELETE FROM weather_conditions WHERE airport_id IN :ids
        """), {"ids": tuple(airport_ids)})
        print(f"   Deleted {res.rowcount} weather_conditions rows")

        # 5. Remove flights at these airports
        res = conn.execute(text("""
            DELETE FROM flights
            WHERE origin_airport_id IN :ids OR dest_airport_id IN :ids
        """), {"ids": tuple(airport_ids)})
        print(f"   Deleted {res.rowcount} flights rows")

        # 6. Reassign any admin users linked to removed airports to TUN
        res = conn.execute(text("""
            UPDATE users SET airport_iata = 'TUN'
            WHERE airport_iata IN :codes AND role = 'admin'
        """), {"codes": REMOVED_IATAS})
        if res.rowcount:
            print(f"   [WARN] Reassigned {res.rowcount} admin user(s) from removed airports -> TUN")

        # 7. Remove the airport records themselves
        res = conn.execute(text("""
            DELETE FROM airports WHERE iata_code IN :codes
        """), {"codes": REMOVED_IATAS})
        print(f"   Deleted {res.rowcount} airports rows")

        print("[OK] Database cleanup complete. Only TUN, MIR, DJE, NBE remain.")


if __name__ == "__main__":
    run()
