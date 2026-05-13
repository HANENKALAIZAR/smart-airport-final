"""
Flight Cache Service
=====================
Smart cache layer that decides whether to call Aviation Edge API or serve
data from the database. This is the single gateway for all flight data.

Rules:
  - If DB data for airport is < CACHE_TTL_MINUTES old → return DB only (no API call)
  - If DB data is stale or missing → fetch from AE, persist, return fresh
  - Manual refresh always bypasses cache

This eliminates 80–95% of Aviation Edge API calls.
"""

import logging
from datetime import datetime, date, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.ae_models import AEFlightSnapshot, AESyncLog

logger = logging.getLogger(__name__)

# ── Cache TTL: min minutes between AE API calls per airport/direction ─────────
CACHE_TTL_MINUTES: int = 10
MONITORED_AIRPORTS = ["TUN", "MIR", "NBE", "DJE", "SFA", "GAF"]


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_cache_age_minutes(airport_iata: str, direction: str, db: Session) -> Optional[float]:
    """Returns how many minutes ago the last successful sync ran. None if never synced."""
    last_sync = (
        db.query(func.max(AESyncLog.finished_at))
        .filter(
            AESyncLog.airport_iata == airport_iata,
            AESyncLog.direction == direction,
            AESyncLog.status.in_(["ok", "partial"]),
        )
        .scalar()
    )
    if not last_sync:
        return None
    if last_sync.tzinfo is None:
        last_sync = last_sync.replace(tzinfo=timezone.utc)
    return round((_now_utc() - last_sync).total_seconds() / 60, 1)


def is_cache_fresh(airport_iata: str, direction: str, db: Session) -> bool:
    """True if last successful sync is within CACHE_TTL_MINUTES."""
    age = get_cache_age_minutes(airport_iata, direction, db)
    if age is None:
        return False
    return age < CACHE_TTL_MINUTES


def _snapshot_to_api_dict(r: AEFlightSnapshot) -> dict:
    """Convert an ORM snapshot row back to the normalized dict the frontend adapter expects."""
    live = None
    if r.latitude is not None:
        live = {
            "latitude":  r.latitude,
            "longitude": r.longitude,
            "altitude":  r.altitude_ft,
            "speed":     r.speed_kmh,
            "direction": r.heading_deg,
            "is_ground": r.is_ground,
        }

    def _fmt(dt) -> Optional[str]:
        if dt is None:
            return None
        return dt.strftime("%Y-%m-%dT%H:%M:%S.000")

    return {
        "id":            r.flight_number,
        "flight_number": r.flight_number,
        "flight_date":   r.flight_date.isoformat() if r.flight_date else None,
        "status":        r.status,
        "direction":     r.direction,
        "source":        "aviation_edge_db",

        "airline_name":  r.airline_name or "—",
        "airline_iata":  r.airline_iata or "",
        "airline_icao":  r.airline_icao or "",

        "dep_airport":   r.dep_airport or "—",
        "dep_iata":      r.dep_iata or "",
        "dep_terminal":  r.dep_terminal,
        "dep_gate":      r.dep_gate,
        "dep_scheduled": _fmt(r.dep_scheduled),
        "dep_estimated": _fmt(r.dep_estimated),
        "dep_actual":    _fmt(r.dep_actual),
        "dep_delay":     str(r.dep_delay_min) if r.dep_delay_min is not None else None,

        "arr_airport":   r.arr_airport or "—",
        "arr_iata":      r.arr_iata or "",
        "arr_terminal":  r.arr_terminal,
        "arr_gate":      r.arr_gate,
        "arr_scheduled": _fmt(r.arr_scheduled),
        "arr_estimated": _fmt(r.arr_estimated),
        "arr_actual":    _fmt(r.arr_actual),
        "arr_delay":     str(r.arr_delay_min) if r.arr_delay_min is not None else None,

        "aircraft_type": r.aircraft_type or "",
        "aircraft_reg":  r.aircraft_reg or "",
        "delay_minutes": r.delay_minutes,
        "live":          live,
    }


def get_cached_flights(airport_iata: str, db: Session) -> list[dict]:
    """Return today's flight snapshots from DB as normalised dicts."""
    today = date.today()
    rows = (
        db.query(AEFlightSnapshot)
        .filter(
            AEFlightSnapshot.airport_iata == airport_iata,
            AEFlightSnapshot.snapshot_date == today,
        )
        .order_by(AEFlightSnapshot.dep_scheduled, AEFlightSnapshot.arr_scheduled)
        .all()
    )
    return [_snapshot_to_api_dict(r) for r in rows]


async def get_flights_smart(
    airport_iata: str,
    direction: str,
    db: Session,
    force_refresh: bool = False,
) -> tuple[list[dict], bool, Optional[float]]:
    """
    Cache-aware flight fetcher. Returns (flights, was_api_called, cache_age_minutes).

    Logic:
      1. force_refresh=True  → skip cache, call API, store, return
      2. cache is fresh       → return DB data immediately (NO API call)
      3. cache is stale       → call API, store, return fresh
    """
    cache_age = get_cache_age_minutes(airport_iata, direction, db)
    fetched_from_api = False
    needs_refresh = force_refresh or not is_cache_fresh(airport_iata, direction, db)

    if needs_refresh:
        reason = "FORCED" if force_refresh else f"STALE(age={cache_age}m,TTL={CACHE_TTL_MINUTES}m)"
        logger.info(f"[FlightCache] {airport_iata}/{direction} — {reason} → calling AE API")
        try:
            from app.services.ae_ingestion_service import ingest_airport
            stats = await ingest_airport(airport_iata, direction, db)
            fetched_from_api = True
            cache_age = 0.0
            logger.info(
                f"[FlightCache] {airport_iata}/{direction} — refreshed: "
                f"{stats.fetched} fetched, {stats.snapshots_upserted} stored"
            )
        except Exception as e:
            logger.error(f"[FlightCache] API refresh failed for {airport_iata}/{direction}: {e}")
            # Fall through: serve stale DB data rather than an empty response
    else:
        logger.debug(f"[FlightCache] {airport_iata}/{direction} — CACHE HIT (age={cache_age}m)")

    flights = get_cached_flights(airport_iata, db)
    return flights, fetched_from_api, cache_age
