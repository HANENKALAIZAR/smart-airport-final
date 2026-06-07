"""
Aviation Edge Router (Cache-Optimised)
========================================
ALL flight requests are now served from the PostgreSQL cache.
The API is only called when the cache is stale (> 10 min) or a
manual refresh is requested.

Endpoints:
  GET  /api/aviation-edge/flights/{iata}         – DB-first flights
  GET  /api/aviation-edge/cache-status           – Per-airport cache ages
  POST /api/aviation-edge/refresh/{iata}         – Force an API refresh
  GET  /api/aviation-edge/airports               – Supported airports list
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.flight_cache_service import (
    get_flights_smart,
    get_cache_age_minutes,
    CACHE_TTL_MINUTES,
    MONITORED_AIRPORTS,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/aviation-edge", tags=["aviation-edge"])

AIRPORTS = {
    "TUN": "Tunis–Carthage International Airport",
    "DJE": "Djerba–Zarzis International Airport",
    "NBE": "Enfidha–Hammamet International Airport",
    "MIR": "Monastir Habib Bourguiba International Airport",
}


@router.get("/flights/{iata}")
async def get_airport_flights(
    iata: str,
    direction: str = "both",
    date: Optional[str] = Query(None, description="YYYY-MM-DD for historical/future flights"),
    refresh: bool = Query(False, description="Force an API refresh, bypassing cache"),
    db: Session = Depends(get_db),
):
    """
    Get flights for a Tunisian airport — served from DB cache.

    - Normally returns cached DB data (no API call if data is < 10 min old).
    - Set ?refresh=true to force an immediate Aviation Edge API call.
    - direction: 'departure', 'arrival', or 'both' (default).
    - date: Fetch flights for a specific date (bypasses live AE fetch completely).
    """
    iata = iata.upper()
    if iata not in AIRPORTS:
        raise HTTPException(
            status_code=404,
            detail=f"Airport '{iata}' not supported. Use: {', '.join(AIRPORTS)}",
        )
    if direction not in ("both", "departure", "arrival"):
        raise HTTPException(status_code=400, detail="direction must be 'both', 'departure', or 'arrival'")

    all_flights: list[dict] = []
    api_calls_made = 0
    final_age: Optional[float] = None

    # Fetch each direction through the cache
    directions = ["departure", "arrival"] if direction == "both" else [direction]
    for d in directions:
        flights, from_api, age = await get_flights_smart(iata, d, db, force_refresh=refresh, target_date=date)
        # Merge – deduplicate by flight_number+direction
        seen = {(f["flight_number"], f["direction"]) for f in all_flights}
        for f in flights:
            key = (f["flight_number"], f["direction"])
            if key not in seen:
                all_flights.append(f)
                seen.add(key)
        if from_api:
            api_calls_made += 1
        if age is not None:
            final_age = age

    from app.models.ae_models import AESyncLog
    from datetime import timezone
    from sqlalchemy import func

    last_sync = (
        db.query(func.max(AESyncLog.finished_at))
        .filter(
            AESyncLog.airport_iata == iata,
            AESyncLog.status.in_(["ok", "partial"]),
        )
        .scalar()
    )
    last_sync_iso = last_sync.replace(tzinfo=timezone.utc).isoformat() if last_sync else None

    return {
        "airport":        iata,
        "airport_name":   AIRPORTS[iata],
        "total":          len(all_flights),
        "departures":     sum(1 for f in all_flights if f["direction"] == "departure"),
        "arrivals":       sum(1 for f in all_flights if f["direction"] == "arrival"),
        "cache_age_min":  final_age,
        "cache_ttl_min":  CACHE_TTL_MINUTES,
        "api_calls_made": api_calls_made,
        "source":         "api" if api_calls_made > 0 else "db_cache",
        "flights":        all_flights,
        "last_sync_time": last_sync_iso,
    }


@router.get("/cache-status")
def get_cache_status(db: Session = Depends(get_db)):
    """Return per-airport cache freshness info for monitoring dashboards."""
    status = []
    for iata in MONITORED_AIRPORTS:
        for direction in ("departure", "arrival"):
            age = get_cache_age_minutes(iata, direction, db)
            status.append({
                "airport":     iata,
                "direction":   direction,
                "age_minutes": age,
                "is_fresh":    age is not None and age < CACHE_TTL_MINUTES,
                "ttl_minutes": CACHE_TTL_MINUTES,
            })
    return {"cache_ttl_minutes": CACHE_TTL_MINUTES, "airports": status}


@router.post("/refresh/{iata}")
async def force_refresh(
    iata: str,
    direction: str = "both",
    db: Session = Depends(get_db),
):
    """Manually trigger a cache refresh for one airport (admin / debug use)."""
    iata = iata.upper()
    if iata not in AIRPORTS:
        raise HTTPException(status_code=404, detail=f"Airport '{iata}' not supported.")

    directions = ["departure", "arrival"] if direction == "both" else [direction]
    results = {}
    for d in directions:
        flights, _, age = await get_flights_smart(iata, d, db, force_refresh=True)
        results[d] = {"flights": len(flights), "cache_age_min": age}

    return {"airport": iata, "refreshed": True, "results": results}


@router.get("/airports")
def list_airports():
    """List all supported Tunisian airports."""
    return [{"iata": code, "name": name} for code, name in AIRPORTS.items()]


@router.get("/provider-health")
async def get_provider_health(db: Session = Depends(get_db)):
    """
    Real-time health status for all external flight data providers.

    Returns circuit breaker state, success/failure counters, and last-call
    timestamps for FlightAware and Aviation Edge. Safe for monitoring —
    no secrets or PII are exposed.
    """
    from app.services.provider_health import health_registry
    from app.services.flight_cache_service import get_cache_age_minutes, MONITORED_AIRPORTS
    from app.api_clients.flightaware_client import is_enabled as fa_is_enabled
    from app.config import settings as _settings

    # FlightAware health from in-memory registry
    fa_stats = await health_registry.get_all()

    # Aviation Edge health from DB sync log
    ae_airports = []
    for iata in MONITORED_AIRPORTS:
        for direction in ("departure", "arrival"):
            age = get_cache_age_minutes(iata, direction, db)
            ae_airports.append({
                "airport":   iata,
                "direction": direction,
                "cache_age_minutes": age,
                "is_fresh":  age is not None and age < _settings.COLLECTION_INTERVAL_HOURS * 60,
            })

    return {
        "flightaware": {
            "enabled":              fa_is_enabled(),
            "configured":           bool(_settings.FLIGHTAWARE_API_KEY),
            "enrich_interval_min":  _settings.FLIGHTAWARE_ENRICH_INTERVAL_MINUTES,
            "window_past_hours":    _settings.FLIGHTAWARE_WINDOW_PAST_HOURS,
            "window_future_hours":  _settings.FLIGHTAWARE_WINDOW_FUTURE_HOURS,
            **fa_stats.get("flightaware", {}),
        },
        "aviation_edge": {
            "enabled":  True,
            "airports": ae_airports,
        },
    }
