"""
Historical + Future Schedule Ingestion
========================================
Two responsibilities:

1. fetch_future_schedules(db)
   Pull the Aviation Edge timetable for all Tunisian airports,
   apply feature_engineering.py encoders, and UPSERT into ae_future_schedules.
   → These are prediction-only rows; they NEVER touch ae_flight_dataset.

2. compute_aviation_stats(db)
   Aggregate ae_flight_dataset (historical labelled data) into:
     ae_aviation_stats  — per-route, per-airline, per-airport, per-hour stats.
   → Used for feature enrichment; does NOT modify the training table.

3. enrich_dataset_with_stats(db)
   (Optional safe append) — reads ae_aviation_stats and writes derived
   insight columns back to ae_flight_dataset WITHOUT touching any existing
   column or the training / evaluation pipeline.

Usage
-----
    cd backend
    python -m app.ai.historical_ingestion          # full run (CLI)
    POST /api/intelligence/fetch-future            # API: Step 1 only
    POST /api/intelligence/compute-stats           # API: Step 2 only
    POST /api/intelligence/run-all                 # API: Steps 1+2+3
"""

from __future__ import annotations

import asyncio
import logging
import math
import os
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

logger = logging.getLogger(__name__)

# ── Tunisian airports to query ─────────────────────────────────────────────────
_TUNISIAN_AIRPORTS = ["TUN", "MIR", "NBE", "DJE"]  # Supported Tunisian airports
_DIRECTIONS        = ["departure", "arrival"]


# ══════════════════════════════════════════════════════════════════════════════
# Step 1 — Fetch future schedules
# ══════════════════════════════════════════════════════════════════════════════

def _parse_dt(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt)
        except (ValueError, TypeError):
            continue
    return None


def _build_future_row(flight: dict, airport_iata: str) -> Optional[dict]:
    """Normalise one Aviation Edge timetable flight → ae_future_schedules row."""
    fnum = flight.get("flight_number", "")
    if not fnum or fnum == "—":
        return None

    dep_scheduled = _parse_dt(flight.get("dep_scheduled"))
    arr_scheduled = _parse_dt(flight.get("arr_scheduled"))
    flight_date_val = (
        dep_scheduled.date() if dep_scheduled
        else (arr_scheduled.date() if arr_scheduled else None)
    )
    if flight_date_val is None:
        return None

    dep_iata = flight.get("dep_iata") or None
    arr_iata = flight.get("arr_iata") or None

    # Time features
    dep_hour   = dep_scheduled.hour if dep_scheduled else None
    day_of_week = dep_scheduled.weekday() if dep_scheduled else None
    is_weekend  = 1 if day_of_week in (5, 6) else 0 if day_of_week is not None else 0

    # Duration
    duration_min = None
    if dep_scheduled and arr_scheduled:
        diff = (arr_scheduled - dep_scheduled).total_seconds() / 60
        if 0 < diff < 1440:
            duration_min = round(diff)

    # Distance (via feature_engineering haversine) + encodings
    from app.ml.feature_engineering import _haversine_km, _get_encoders
    dist = _haversine_km(dep_iata, arr_iata)   # returns None if unknown
    if dist is None:
        dist = 1_800   # fallback median

    enc_airline, enc_dep, enc_arr = _get_encoders()
    airline_iata = flight.get("airline_iata") or None
    enc_airline.fit_extend([airline_iata])
    enc_dep.fit_extend([dep_iata])
    enc_arr.fit_extend([arr_iata])

    return {
        "flight_number":     fnum,
        "airline_iata":      airline_iata,
        "airline_name":      flight.get("airline_name"),
        "dep_iata":          dep_iata,
        "arr_iata":          arr_iata,
        "dep_airport":       flight.get("dep_airport"),
        "arr_airport":       flight.get("arr_airport"),
        "scheduled_departure": dep_scheduled,
        "scheduled_arrival":   arr_scheduled,
        "flight_date":       flight_date_val,
        "day_of_week":       day_of_week,
        "dep_hour":          dep_hour,
        "distance_km":       dist,
        "duration_min":      duration_min,
        "is_weekend":        is_weekend,
        "airline_enc":       enc_airline.transform(airline_iata),
        "dep_airport_enc":   enc_dep.transform(dep_iata),
        "arr_airport_enc":   enc_arr.transform(arr_iata),
        "source":            "aviation_edge",
        "fetched_at":        datetime.now(timezone.utc),
        "airport_iata":      airport_iata,
    }


async def _fetch_one(airport_iata: str, direction: str) -> list[dict]:
    from app.api_clients.aviation_edge_client import fetch_timetable
    return await fetch_timetable(airport_iata, direction)


async def fetch_future_schedules(db: Session) -> dict:
    """
    Pull Aviation Edge timetable for all Tunisian airports × both directions,
    apply feature engineering, and UPSERT into ae_future_schedules.

    Returns stats dict: {fetched, upserted, skipped, errors}
    """
    from app.models.ae_models import AEFutureSchedule

    logger.info("[FutureSchedules] Starting fetch...")
    tasks = [
        _fetch_one(iata, direction)
        for iata in _TUNISIAN_AIRPORTS
        for direction in _DIRECTIONS
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    fetched = upserted = skipped = errors = 0
    batch: list[dict] = []

    for chunk in results:
        if isinstance(chunk, Exception):
            logger.warning(f"[FutureSchedules] Fetch error: {chunk}")
            errors += 1
            continue
        for flight in chunk:
            fetched += 1
            # Determine which airport was queried (use dep_iata or arr_iata based on direction)
            airport_iata = flight.get("dep_iata") or flight.get("arr_iata") or "TUN"
            row = _build_future_row(flight, airport_iata)
            if row is None:
                skipped += 1
                continue
            batch.append(row)

    # Bulk UPSERT
    for row in batch:
        try:
            stmt = (
                pg_insert(AEFutureSchedule)
                .values(**row)
                .on_conflict_do_update(
                    index_elements=["flight_number", "flight_date", "dep_iata", "arr_iata"],
                    set_={
                        k: v for k, v in row.items()
                        if k not in ("flight_number", "flight_date", "dep_iata", "arr_iata")
                    },
                )
            )
            db.execute(stmt)
            upserted += 1
        except Exception as e:
            logger.debug(f"[FutureSchedules] UPSERT error: {e}")
            errors += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[FutureSchedules] Commit failed: {e}")
        errors += len(batch)
        upserted = 0

    logger.info(
        f"[FutureSchedules] Done: fetched={fetched} upserted={upserted} "
        f"skipped={skipped} errors={errors}"
    )
    return {"fetched": fetched, "upserted": upserted, "skipped": skipped, "errors": errors}


# ══════════════════════════════════════════════════════════════════════════════
# Step 2 — Compute aviation statistics
# ══════════════════════════════════════════════════════════════════════════════

def _upsert_stat(db, stat_type: str, entity_key: str, payload: dict) -> None:
    from app.models.ae_models import AEAviationStats
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    row = {
        "stat_type":  stat_type,
        "entity_key": entity_key,
        "computed_at": datetime.now(timezone.utc),
        **payload,
    }
    stmt = (
        pg_insert(AEAviationStats)
        .values(**row)
        .on_conflict_do_update(
            index_elements=["stat_type", "entity_key"],
            set_={k: v for k, v in row.items() if k not in ("stat_type", "entity_key")},
        )
    )
    db.execute(stmt)


def _delay_stats(delays: list[float]) -> dict:
    """Compute delay statistics for a list of delay_minutes values."""
    if not delays:
        return {}
    import statistics
    sorted_d = sorted(delays)
    n = len(sorted_d)
    avg   = sum(sorted_d) / n
    med   = statistics.median(sorted_d)
    p90   = sorted_d[int(n * 0.9)]
    rate  = sum(1 for d in sorted_d if d > 15) / n
    on_t  = 1.0 - rate
    rel   = round(on_t, 4)
    return {
        "avg_delay_min":    round(avg,  2),
        "median_delay_min": round(med,  2),
        "p90_delay_min":    round(p90,  2),
        "delay_rate":       round(rate, 4),
        "on_time_rate":     round(on_t, 4),
        "reliability_score": rel,
        "total_flights":    n,
    }


def compute_aviation_stats(db: Session) -> dict:
    """
    Aggregate ae_flight_dataset into ae_aviation_stats.

    Computes:
      • per-route (dep_iata→arr_iata) delay stats
      • per-airline delay stats
      • per-airport (dep_iata) stats
      • per-hour-of-day stats

    Safe: reads ae_flight_dataset, writes only to ae_aviation_stats.
    Does NOT modify ae_flight_dataset or any training columns.
    """
    from app.models.ae_models import AEFlightDataset

    logger.info("[AviationStats] Loading ae_flight_dataset for aggregation...")
    rows = (
        db.query(AEFlightDataset)
        .filter(
            AEFlightDataset.usable_for_ml == True,
            AEFlightDataset.delay_minutes.isnot(None),
        )
        .all()
    )

    if not rows:
        logger.warning("[AviationStats] No usable rows found — stats not computed")
        return {"stat_rows_written": 0, "source_rows": 0}

    logger.info(f"[AviationStats] Computing stats from {len(rows)} rows...")

    # Accumulators
    route_delays:   dict[str, list[float]] = {}
    airline_delays: dict[str, list[float]] = {}
    airport_delays: dict[str, list[float]] = {}
    hour_delays:    dict[str, list[float]] = {}
    all_dates: list[date] = []

    for r in rows:
        delay = float(r.delay_minutes or 0)
        dep   = r.dep_iata or "UNK"
        arr   = r.arr_iata or "UNK"
        al    = r.airline_iata or "UNK"
        hr    = str(r.dep_hour) if r.dep_hour is not None else "UNK"
        route = f"{dep}\u2192{arr}"

        route_delays.setdefault(route, []).append(delay)
        airline_delays.setdefault(al,   []).append(delay)
        airport_delays.setdefault(dep,  []).append(delay)
        hour_delays.setdefault(hr,      []).append(delay)

        if r.flight_date:
            all_dates.append(r.flight_date)

    data_from = min(all_dates) if all_dates else None
    data_to   = max(all_dates) if all_dates else None
    stat_rows = 0

    def _write(stat_type, entity_key, delays):
        nonlocal stat_rows
        stats = _delay_stats(delays)
        if not stats:
            return
        stats["sample_days"]    = len({d for d in all_dates}) if all_dates else 0
        stats["data_from_date"] = data_from
        stats["data_to_date"]   = data_to
        _upsert_stat(db, stat_type, entity_key, stats)
        stat_rows += 1

    for route, delays in route_delays.items():
        _write("route", route, delays)

    for al, delays in airline_delays.items():
        _write("airline", al, delays)

    for ap, delays in airport_delays.items():
        _write("airport", ap, delays)

    for hr, delays in hour_delays.items():
        _write("hour", hr, delays)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[AviationStats] Commit failed: {e}")
        return {"stat_rows_written": 0, "source_rows": len(rows), "error": str(e)}

    logger.info(f"[AviationStats] Written {stat_rows} stat rows to ae_aviation_stats")
    return {"stat_rows_written": stat_rows, "source_rows": len(rows)}


# ══════════════════════════════════════════════════════════════════════════════
# Step 3 — Enrich ae_flight_dataset with computed stats (safe append)
# ══════════════════════════════════════════════════════════════════════════════
# NOTE: This is purely additive — no existing columns are overwritten.
# The training pipeline reads only the 7 REQUIRED_ML_FEATURES from FE;
# these annotations are informational and can be used in future model versions.

def enrich_dataset_with_stats(db: Session) -> dict:
    """
    Cross-reference ae_flight_dataset rows against ae_aviation_stats and
    log enrichment coverage. Does NOT write back to the dataset — enrichment
    is applied at inference time via get_stats_for_flight() below.
    Returns a coverage report dict.
    """
    from app.models.ae_models import AEFlightDataset, AEAviationStats

    stats_map: dict[tuple[str, str], dict] = {}
    for s in db.query(AEAviationStats).all():
        stats_map[(s.stat_type, s.entity_key)] = {
            "avg_delay":   s.avg_delay_min,
            "delay_rate":  s.delay_rate,
            "reliability": s.reliability_score,
        }

    if not stats_map:
        return {"coverage": "0%", "note": "No ae_aviation_stats found — run compute_aviation_stats first"}

    rows = db.query(AEFlightDataset).filter(AEFlightDataset.usable_for_ml == True).all()
    covered = 0
    for r in rows:
        route = f"{r.dep_iata or 'UNK'}\u2192{r.arr_iata or 'UNK'}"
        if ("route", route) in stats_map or ("airline", r.airline_iata or "UNK") in stats_map:
            covered += 1

    pct = round(covered / len(rows) * 100, 1) if rows else 0.0
    logger.info(f"[Enrich] Stats coverage: {covered}/{len(rows)} rows ({pct}%)")
    return {
        "total_dataset_rows": len(rows),
        "covered_rows":       covered,
        "coverage_pct":       pct,
        "stat_types_available": list({k[0] for k in stats_map}),
    }


def get_stats_for_flight(
    db: Session,
    dep_iata: Optional[str],
    arr_iata: Optional[str],
    airline_iata: Optional[str],
    dep_hour: Optional[int],
) -> dict:
    """
    Retrieve pre-computed stats for a specific flight context.
    Used by future_predictions.py to enrich feature vectors at inference time.
    Returns dict with: route_avg_delay, airline_reliability, hour_delay_rate.
    """
    from app.models.ae_models import AEAviationStats

    def _get(stat_type, key):
        if not key:
            return None
        return db.query(AEAviationStats).filter(
            AEAviationStats.stat_type == stat_type,
            AEAviationStats.entity_key == key,
        ).first()

    route   = _get("route",   f"{dep_iata or 'UNK'}\u2192{arr_iata or 'UNK'}")
    airline = _get("airline", airline_iata or "UNK")
    hour    = _get("hour",    str(dep_hour) if dep_hour is not None else "UNK")

    return {
        "route_avg_delay":    float(route.avg_delay_min)    if route    and route.avg_delay_min    is not None else None,
        "route_delay_rate":   float(route.delay_rate)       if route    and route.delay_rate        is not None else None,
        "airline_reliability":float(airline.reliability_score) if airline and airline.reliability_score is not None else None,
        "hour_delay_rate":    float(hour.delay_rate)        if hour     and hour.delay_rate         is not None else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Orchestrator
# ══════════════════════════════════════════════════════════════════════════════

async def run_full_intelligence_pipeline(db: Session) -> dict:
    """Run Steps 1 + 2 + 3 sequentially."""
    logger.info("[Intelligence] Full pipeline starting...")

    future_result = await fetch_future_schedules(db)
    stats_result  = compute_aviation_stats(db)
    enrich_result = enrich_dataset_with_stats(db)

    return {
        "future_schedules": future_result,
        "aviation_stats":   stats_result,
        "enrichment":       enrich_result,
    }


# ══════════════════════════════════════════════════════════════════════════════
# CLI entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys, json
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    from app.database import SessionLocal
    _db = SessionLocal()
    try:
        result = asyncio.run(run_full_intelligence_pipeline(_db))
        print(json.dumps(result, indent=2, default=str))
    finally:
        _db.close()
