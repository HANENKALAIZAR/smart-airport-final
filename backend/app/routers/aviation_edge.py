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
    refresh: bool = Query(False, description="Force an API refresh, bypassing cache"),
    db: Session = Depends(get_db),
):
    """
    Get flights for a Tunisian airport — served from DB cache.

    - Normally returns cached DB data (no API call if data is < 10 min old).
    - Set ?refresh=true to force an immediate Aviation Edge API call.
    - direction: 'departure', 'arrival', or 'both' (default).
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
        flights, from_api, age = await get_flights_smart(iata, d, db, force_refresh=refresh)
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
