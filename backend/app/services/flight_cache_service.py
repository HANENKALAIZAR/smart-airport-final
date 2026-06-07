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
CACHE_TTL_MINUTES: int = 2
MONITORED_AIRPORTS = ["TUN", "MIR", "NBE", "DJE"]  # Supported Tunisian airports


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
    """True if last successful sync is within CACHE_TTL_MINUTES and occurred on the same UTC date."""
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
        return False
    if last_sync.tzinfo is None:
        last_sync = last_sync.replace(tzinfo=timezone.utc)
    
    now = _now_utc()
    if last_sync.date() != now.date():
        return False  # UTC date changed, cache is stale
    
    age = (now - last_sync).total_seconds() / 60
    return 0 <= age < CACHE_TTL_MINUTES


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

    from zoneinfo import ZoneInfo
    
    AIRPORT_TIMEZONES = {
        "TUN": "Africa/Tunis",
        "MIR": "Africa/Tunis",
        "NBE": "Africa/Tunis",
        "DJE": "Africa/Tunis",
        "TOE": "Africa/Tunis",
        "CDG": "Europe/Paris",
        "ORY": "Europe/Paris",
        "LHR": "Europe/London",
        "FRA": "Europe/Berlin",
        "FCO": "Europe/Rome",
        "MXP": "Europe/Rome",
        "MAD": "Europe/Madrid",
        "BCN": "Europe/Madrid",
        "IST": "Europe/Istanbul",
        "SAW": "Europe/Istanbul",
        "DOH": "Asia/Qatar",
        "DXB": "Asia/Dubai",
        "AMM": "Asia/Amman",
        "CAI": "Africa/Cairo",
        "JED": "Asia/Riyadh",
        "CMN": "Africa/Casablanca",
        "ALG": "Africa/Algiers",
        "GVA": "Europe/Zurich",
        "BRU": "Europe/Brussels",
        "VIE": "Europe/Vienna",
        "MUC": "Europe/Berlin",
        "DUS": "Europe/Berlin",
        "LYS": "Europe/Paris",
        "NCE": "Europe/Paris",
        "MRS": "Europe/Paris",
        "MLA": "Europe/Malta",
        "DSS": "Africa/Dakar",
        "YUL": "America/Montreal",
    }

    def _fmt_tz(dt, iata: Optional[str]) -> Optional[str]:
        if dt is None:
            return None
        tz_name = AIRPORT_TIMEZONES.get((iata or "").upper(), "UTC")
        try:
            if dt.tzinfo is not None:
                localized = dt.astimezone(ZoneInfo(tz_name))
            else:
                localized = dt.replace(tzinfo=ZoneInfo(tz_name))
            return localized.isoformat()
        except Exception as e:
            logger.error(f"Error localizing datetime {dt} for airport {iata}: {e}")
            return dt.strftime("%Y-%m-%dT%H:%M:%S.000")

    def _fmt_utc(dt) -> Optional[str]:
        if dt is None:
            return None
        try:
            if dt.tzinfo is not None:
                localized = dt.astimezone(timezone.utc)
            else:
                localized = dt.replace(tzinfo=timezone.utc)
            return localized.isoformat()
        except Exception:
            return dt.strftime("%Y-%m-%dT%H:%M:%S.000")

    return {
        "id":            r.flight_number,
        "flight_number": r.flight_number,
        "flight_date":   r.flight_date.isoformat() if r.flight_date else None,
        "status":        r.status,
        "raw_status":    r.raw_status,
        "direction":     r.direction,
        "source":        "aviation_edge_db",

        "airline_name":  r.airline_name or "—",
        "airline_iata":  r.airline_iata or "",
        "airline_icao":  r.airline_icao or "",

        "dep_airport":   r.dep_airport or "—",
        "dep_iata":      r.dep_iata or "",
        "dep_terminal":  r.dep_terminal,
        "dep_gate":      r.dep_gate,
        "dep_scheduled": _fmt_tz(r.dep_scheduled, r.dep_iata),
        "dep_estimated": _fmt_tz(r.dep_estimated, r.dep_iata),
        "dep_actual":    _fmt_tz(r.dep_actual, r.dep_iata),
        "dep_delay":     str(r.dep_delay_min) if r.dep_delay_min is not None else None,

        "arr_airport":   r.arr_airport or "—",
        "arr_iata":      r.arr_iata or "",
        "arr_terminal":  r.arr_terminal,
        "arr_gate":      r.arr_gate,
        "arr_scheduled": _fmt_tz(r.arr_scheduled, r.arr_iata),
        "arr_estimated": _fmt_tz(r.arr_estimated, r.arr_iata),
        "arr_actual":    _fmt_tz(r.arr_actual, r.arr_iata),
        "arr_delay":     str(r.arr_delay_min) if r.arr_delay_min is not None else None,

        "aircraft_type": r.aircraft_type or "",
        "aircraft_reg":  r.aircraft_reg or "",
        "delay_minutes": r.delay_minutes,
        "departed_at":   _fmt_utc(r.departed_at),
        "airborne_at":   _fmt_utc(r.airborne_at),
        "landed_at":     _fmt_utc(r.landed_at),
        "last_status_change": _fmt_utc(r.last_status_change),
        "last_position_update": _fmt_utc(r.last_position_update),
        "live":          live,
        # FlightAware smart enrichment fields
        "fa_dep_gate":   r.fa_dep_gate,
        "fa_arr_gate":   r.fa_arr_gate,
        "fa_dep_terminal": r.fa_dep_terminal,
        "fa_arr_terminal": r.fa_arr_terminal,
        "ae_dep_actual": _fmt_tz(r.ae_dep_actual, r.dep_iata),
        "ae_arr_actual": _fmt_tz(r.ae_arr_actual, r.arr_iata),
        "displayed_dep_source": r.displayed_dep_source,
        "displayed_arr_source": r.displayed_arr_source,
        # FlightAware enrichment metadata (null if not yet enriched)
        "last_verified_by":  r.last_verified_by,
        "last_verified_at":  _fmt_utc(r.last_verified_at),
        "provider_sources":  r.provider_sources or {},
    }


def get_cached_flights(airport_iata: str, db: Session, target_date: Optional[str] = None) -> list[dict]:
    """Return flight snapshots from DB as normalised dicts for a specific date."""
    if target_date:
        try:
            query_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            query_date = datetime.now(timezone.utc).date()
    else:
        query_date = datetime.now(timezone.utc).date()
        
    rows = (
        db.query(AEFlightSnapshot)
        .filter(
            AEFlightSnapshot.airport_iata == airport_iata,
            AEFlightSnapshot.snapshot_date == query_date,
        )
        .order_by(AEFlightSnapshot.dep_scheduled, AEFlightSnapshot.arr_scheduled)
        .all()
    )

    # Intercept and auto-reconcile stale active flights on the fly
    modified = False
    from app.services.flight_reconciliation_service import reconcile_stale_flight_status
    for r in rows:
        try:
            if reconcile_stale_flight_status(r, db):
                modified = True
        except Exception as e:
            logger.error(f"[FlightCache] Error during on-the-fly reconciliation for {r.flight_number}: {e}")

    if modified:
        try:
            db.commit()
            logger.info(f"[FlightCache] Successfully committed on-the-fly reconciled stale flights for {query_date}")
        except Exception as e:
            logger.error(f"[FlightCache] Failed to commit reconciled flights: {e}")
            db.rollback()

    return [_snapshot_to_api_dict(r) for r in rows]


async def get_flights_smart(
    airport_iata: str,
    direction: str,
    db: Session,
    force_refresh: bool = False,
    target_date: Optional[str] = None,
) -> tuple[list[dict], bool, Optional[float]]:
    """
    Cache-aware flight fetcher. Returns (flights, was_api_called, cache_age_minutes).

    Logic:
      0. target_date provided -> just query DB for that date (no API call)
      1. force_refresh=True  → skip cache, call API, store, return
      2. cache is fresh       → return DB data immediately (NO API call)
      3. cache is stale       → call API, store, return fresh
    """
    if target_date:
        # Cannot fetch historical/future flights from live AE API, rely purely on DB cache
        flights = get_cached_flights(airport_iata, db, target_date)
        return flights, False, None

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
