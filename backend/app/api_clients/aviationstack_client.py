"""
AviationStack API Client
=========================
Fetches real-time flight data from the AviationStack API.
Free tier: 100 requests/month, HTTP only.
Docs: https://aviationstack.com/documentation
"""

import httpx
import json
import os
import time
from typing import Optional
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────
AVIATIONSTACK_KEY = os.getenv("AVIATIONSTACK_KEY", "")
AVIATIONSTACK_BASE = "http://api.aviationstack.com/v1"

# ── Cache directory ────────────────────────────────────────────
CACHE_DIR = Path(__file__).parent.parent / "data" / "flight_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Cache TTL in seconds (5 minutes)
CACHE_TTL = 300


def _cache_path(airport: str, direction: str) -> Path:
    return CACHE_DIR / f"{airport}_{direction}.json"


def _read_cache(airport: str, direction: str) -> Optional[dict]:
    """Read cached flight data if still fresh."""
    path = _cache_path(airport, direction)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if time.time() - data.get("fetched_at", 0) < CACHE_TTL:
            return data
    except Exception:
        pass
    return None


def _write_cache(airport: str, direction: str, payload: dict):
    """Write flight data to cache."""
    payload["fetched_at"] = time.time()
    try:
        _cache_path(airport, direction).write_text(
            json.dumps(payload, ensure_ascii=False),
            encoding="utf-8"
        )
    except Exception:
        pass


async def fetch_flights(
    airport_iata: str,
    direction: str = "departure",
    limit: int = 100,
) -> dict:
    """
    Fetch flights from AviationStack for a given airport.

    Args:
        airport_iata: IATA code (e.g. "TUN")
        direction: "departure" or "arrival"
        limit: Max number of results

    Returns:
        Dict with 'data' list and 'pagination' info.
    """
    # Check cache first
    cached = _read_cache(airport_iata, direction)
    if cached:
        return cached

    params = {
        "access_key": AVIATIONSTACK_KEY,
        "limit": min(limit, 100),
    }

    if direction == "departure":
        params["dep_iata"] = airport_iata
    else:
        params["arr_iata"] = airport_iata

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{AVIATIONSTACK_BASE}/flights", params=params)
            resp.raise_for_status()
            data = resp.json()

            if "error" in data:
                raise Exception(data["error"].get("message", str(data["error"])))

            # Cache the result
            _write_cache(airport_iata, direction, data)
            return data

    except Exception as e:
        # Fall back to cached data even if expired
        path = _cache_path(airport_iata, direction)
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                pass
        raise e


def normalize_flight(raw: dict, direction: str) -> dict:
    """
    Normalize an AviationStack flight object to a clean format
    usable by the frontend.
    """
    dep = raw.get("departure") or {}
    arr = raw.get("arrival") or {}
    airline = raw.get("airline") or {}
    flight = raw.get("flight") or {}
    aircraft = raw.get("aircraft") or {}
    live = raw.get("live") or {}

    status = raw.get("flight_status", "scheduled")
    # Map AviationStack statuses to our UI statuses
    status_map = {
        "scheduled": "scheduled",
        "active": "on_time",
        "landed": "landed",
        "cancelled": "cancelled",
        "incident": "delayed",
        "diverted": "delayed",
    }

    delay_dep = dep.get("delay") or 0
    delay_arr = arr.get("delay") or 0
    delay = max(delay_dep, delay_arr)

    mapped_status = status_map.get(status, "scheduled")
    if delay and delay > 15 and mapped_status != "cancelled":
        mapped_status = "delayed"

    return {
        "id": flight.get("iata") or flight.get("icao") or raw.get("flight_date", ""),
        "flight_number": flight.get("iata") or flight.get("icao") or "—",
        "flight_date": raw.get("flight_date"),
        "status": mapped_status,
        "direction": direction,

        # Airline
        "airline_name": airline.get("name", "—"),
        "airline_iata": airline.get("iata", ""),
        "airline_icao": airline.get("icao", ""),

        # Departure
        "dep_airport": dep.get("airport", "—"),
        "dep_iata": dep.get("iata", ""),
        "dep_icao": dep.get("icao", ""),
        "dep_terminal": dep.get("terminal"),
        "dep_gate": dep.get("gate"),
        "dep_scheduled": dep.get("scheduled"),
        "dep_estimated": dep.get("estimated"),
        "dep_actual": dep.get("actual"),
        "dep_delay": delay_dep,

        # Arrival
        "arr_airport": arr.get("airport", "—"),
        "arr_iata": arr.get("iata", ""),
        "arr_icao": arr.get("icao", ""),
        "arr_terminal": arr.get("terminal"),
        "arr_gate": arr.get("gate"),
        "arr_baggage": arr.get("baggage"),
        "arr_scheduled": arr.get("scheduled"),
        "arr_estimated": arr.get("estimated"),
        "arr_actual": arr.get("actual"),
        "arr_delay": delay_arr,

        # Aircraft
        "aircraft_type": aircraft.get("iata") or "",
        "aircraft_reg": aircraft.get("registration") or "",
        "aircraft_icao24": aircraft.get("icao24") or "",

        # Computed
        "delay_minutes": delay,

        # Live tracking
        "live": {
            "latitude": live.get("latitude"),
            "longitude": live.get("longitude"),
            "altitude": live.get("altitude"),
            "speed": live.get("speed_horizontal"),
            "direction": live.get("direction"),
            "is_ground": live.get("is_ground"),
            "updated": live.get("updated"),
        } if live else None,
    }
