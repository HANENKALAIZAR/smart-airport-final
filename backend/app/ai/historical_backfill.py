"""
Real Historical Backfill Engine (Aviation Edge API)
===================================================
Fetches REAL historical flights from Aviation Edge `/v2/public/flightsHistory`.

Usage:
    cd backend
    python -m app.ai.historical_backfill          # full run (CLI)
    POST /api/ae-dataset/historical-backfill      # API (admin)
"""

from __future__ import annotations

import logging
import asyncio
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.api_clients.aviation_edge_client import fetch_flights_history
from app.services.ae_ingestion_service import _build_snapshot, _build_dataset_row
from app.models.ae_models import AEFlightSnapshot, AEFlightDataset

logger = logging.getLogger(__name__)

AIRPORTS = ["TUN", "MIR", "NBE", "DJE"]
DIRECTIONS = ["departure", "arrival"]

async def run_historical_backfill_async(
    db: Session,
    *,
    days: int = 30,
) -> dict:
    """
    Fetch and insert real historical flights from Aviation Edge API.
    """
    logger.info(f"[Real Backfill] Starting historical fetch for past {days} days")

    today = date.today()
    start_date = today - timedelta(days=days)

    total_fetched = 0
    total_upserted = 0

    for airport in AIRPORTS:
        for direction in DIRECTIONS:
            # The API allows date ranges. We query in chunks of 5 days to avoid timeouts or limits.
            current_start = start_date
            while current_start < today:
                current_end = current_start + timedelta(days=5)
                if current_end > today:
                    current_end = today
                
                try:
                    flights = await fetch_flights_history(
                        airport_iata=airport,
                        direction=direction,
                        date_from=current_start.strftime("%Y-%m-%d"),
                        date_to=current_end.strftime("%Y-%m-%d")
                    )
                    
                    if not flights:
                        current_start = current_end + timedelta(days=1)
                        continue

                    total_fetched += len(flights)
                    logger.info(f"[Real Backfill] Fetched {len(flights)} flights for {airport}/{direction} ({current_start} to {current_end})")

                    for flight in flights:
                        fnum = flight.get("flight_number", "")
                        if not fnum or fnum == "—":
                            continue

                        # Default flight date to current_start if not parsable
                        flight_date_str = flight.get("dep_scheduled") or flight.get("arr_scheduled")
                        flight_date = current_start
                        if flight_date_str:
                            try:
                                flight_date = datetime.strptime(flight_date_str[:10], "%Y-%m-%d").date()
                            except ValueError:
                                pass

                        try:
                            snap = _build_snapshot(flight, airport, flight_date)

                            # Snapshot Upsert
                            stmt = (
                                pg_insert(AEFlightSnapshot)
                                .values(**snap)
                                .on_conflict_do_update(
                                    index_elements=["flight_number", "snapshot_date", "airport_iata", "direction"],
                                    set_={
                                        "status": snap["status"],
                                        "delay_minutes": snap["delay_minutes"],
                                        "dep_actual": snap["dep_actual"],
                                        "arr_actual": snap["arr_actual"],
                                        "dep_delay_min": snap["dep_delay_min"],
                                        "arr_delay_min": snap["arr_delay_min"]
                                    }
                                )
                            )
                            db.execute(stmt)

                            # Dataset Upsert
                            ds_row = _build_dataset_row(snap)
                            ds_row["data_source"] = "aviation_edge"
                            
                            ds_stmt = (
                                pg_insert(AEFlightDataset)
                                .values(**ds_row)
                                .on_conflict_do_update(
                                    index_elements=["flight_number", "flight_date", "airport_iata", "direction"],
                                    set_={k: v for k, v in ds_row.items()
                                          if k not in ("flight_number", "flight_date", "airport_iata", "direction")}
                                )
                            )
                            db.execute(ds_stmt)
                            total_upserted += 1

                        except Exception as e:
                            logger.debug(f"[Real Backfill] Row error: {e}")
                            continue

                    db.commit()

                except Exception as e:
                    logger.error(f"[Real Backfill] API error for {airport} {current_start}: {e}")
                
                current_start = current_end + timedelta(days=1)

    return {
        "days_covered": days,
        "date_range": f"{start_date} -> {today}",
        "fetched": total_fetched,
        "upserted": total_upserted
    }


def run_historical_backfill(
    db: Session,
    *,
    days: int = 30,
    target_min: int = 0, # Ignored, kept for API compatibility
    daily_cap: int = 0,  # Ignored, kept for API compatibility
) -> dict:
    """Synchronous wrapper for the async backfill function."""
    return asyncio.run(run_historical_backfill_async(db, days=days))


def fix_incomplete_rows(db: Session) -> dict:
    """Same as before."""
    from app.services.ae_ingestion_service import _haversine_km
    logger.info("[Backfill] Fixing incomplete rows...")

    rows_missing_dist = db.execute(text("""
        SELECT id, dep_iata, arr_iata FROM ae_flight_dataset
        WHERE distance_km IS NULL AND dep_iata IS NOT NULL AND arr_iata IS NOT NULL
    """)).fetchall()

    fixed_dist = 0
    for r in rows_missing_dist:
        km = _haversine_km(r[1], r[2])
        db.execute(text("UPDATE ae_flight_dataset SET distance_km = :km WHERE id = :id"), {"km": km, "id": r[0]})
        fixed_dist += 1

    marked_unusable = db.execute(text("""
        UPDATE ae_flight_dataset SET usable_for_ml = false
        WHERE dep_hour IS NULL AND usable_for_ml = true
    """)).rowcount

    db.execute(text("""
        UPDATE ae_flight_dataset SET airline_enc = 0
        WHERE airline_enc IS NULL AND airline_iata IS NULL
    """))

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

    return {
        "distance_km_fixed": fixed_dist,
        "marked_unusable": marked_unusable,
    }


if __name__ == "__main__":
    import sys, json
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

    import logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    from app.database import SessionLocal
    _db = SessionLocal()
    try:
        # Step 1: Run historical fetch
        result = run_historical_backfill(_db, days=30)
        print("\\n=== Historical API Backfill ===")
        print(json.dumps(result, indent=2, default=str))

        # Step 2: Fix incomplete rows
        fix_result = fix_incomplete_rows(_db)
        print("\\n=== Fix Incomplete Rows ===")
        print(json.dumps(fix_result, indent=2, default=str))
    finally:
        _db.close()
