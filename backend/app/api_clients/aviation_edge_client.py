"""
Aviation Edge API Client
=========================
Real-time flight data via Aviation Edge.
Docs: https://aviation-edge.com/developers/

Endpoints used:
  - /v2/public/flights        → live tracker (in-air flights)
  - /v2/public/timetable      → scheduled departures/arrivals

Required in .env:
  AVIATION_EDGE_KEY=your_key
"""

import httpx
import os
import logging
from pathlib import Path
from typing import Optional

# Load .env so the key is available when running standalone scripts
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[3] / ".env")
except ImportError:
    pass

logger = logging.getLogger(__name__)

AVIATION_EDGE_BASE = "https://aviation-edge.com/v2/public"


def _get_key() -> str:
    """Always read the key fresh — fallback to hardcoded if env not loaded yet."""
    return os.getenv("AVIATION_EDGE_KEY") or "013d47-5ea66a"



def normalize_ae_flight(raw: dict, direction: str, airport_iata: str) -> dict:
    """Normalize an Aviation Edge flight object to the same shape as aviationstack_client."""
    dep = raw.get("departure") or {}
    arr = raw.get("arrival") or {}
    airline = raw.get("airline") or {}
    flight = raw.get("flight") or {}
    aircraft = raw.get("aircraft") or {}

    flight_number = (
        flight.get("iataNumber")
        or flight.get("icaoNumber")
        or raw.get("flightIata")
        or "—"
    )

    status_raw = raw.get("status", "scheduled")
    status_map = {
        "en-route": "in_air",
        "active":   "in_air",
        "landed":   "landed",
        "cancelled": "cancelled",
        "incident":  "delayed",
        "diverted":  "delayed",
        "scheduled": "scheduled",
        "unknown":   "scheduled",
    }
    status = status_map.get(status_raw.lower() if status_raw else "", "scheduled")

    dep_delay = dep.get("delay")
    arr_delay = arr.get("delay")
    delay = None
    if dep_delay is not None and arr_delay is not None:
        delay = max(int(dep_delay), int(arr_delay))
    elif dep_delay is not None:
        delay = int(dep_delay)
    elif arr_delay is not None:
        delay = int(arr_delay)

    if delay and delay > 15 and status == "scheduled":
        status = "delayed"

    return {
        "id":            flight_number,
        "flight_number": flight_number,
        "flight_date":   raw.get("flight_date"),
        "status":        status,
        "direction":     direction,
        "source":        "aviation_edge",

        # Airline
        "airline_name": airline.get("name", "—"),
        "airline_iata": airline.get("iataCode", ""),
        "airline_icao": airline.get("icaoCode", ""),

        # Departure
        "dep_airport":   dep.get("airport", "—"),
        "dep_iata":      dep.get("iataCode", ""),
        "dep_terminal":  dep.get("terminal"),
        "dep_gate":      dep.get("gate"),
        "dep_scheduled": dep.get("scheduledTime"),
        "dep_estimated": dep.get("estimatedTime"),
        "dep_actual":    dep.get("actualTime"),
        "dep_delay":     dep_delay,

        # Arrival
        "arr_airport":   arr.get("airport", "—"),
        "arr_iata":      arr.get("iataCode", ""),
        "arr_terminal":  arr.get("terminal"),
        "arr_gate":      arr.get("gate"),
        "arr_scheduled": arr.get("scheduledTime"),
        "arr_estimated": arr.get("estimatedTime"),
        "arr_actual":    arr.get("actualTime"),
        "arr_delay":     arr_delay,

        # Aircraft
        "aircraft_type": aircraft.get("iataCode", ""),
        "aircraft_reg":  aircraft.get("regNumber", ""),

        # Computed
        "delay_minutes": delay,

        # Live (tracker only)
        "live": {
            "latitude":  raw.get("geography", {}).get("latitude"),
            "longitude": raw.get("geography", {}).get("longitude"),
            "altitude":  raw.get("geography", {}).get("altitude"),
            "speed":     raw.get("speed", {}).get("horizontal"),
            "direction": raw.get("geography", {}).get("direction"),
            "is_ground": raw.get("speed", {}).get("isGround"),
        } if raw.get("geography") else None,
    }


async def fetch_live_flights(airport_iata: str, direction: str = "departure") -> list[dict]:
    """
    Fetch live (in-air) flights for an airport using the Aviation Edge tracker.
    GET /v2/public/flights?key=KEY&depIata=TUN  (or arrIata=TUN)
    """
    apiKey = _get_key()
    if not apiKey:
        logger.warning("AVIATION_EDGE_KEY not set — skipping Aviation Edge live tracker")
        return []

    param_key = "depIata" if direction == "departure" else "arrIata"
    params = {
        "key": apiKey,
        param_key: airport_iata,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{AVIATION_EDGE_BASE}/flights", params=params)
            resp.raise_for_status()
            data = resp.json()

            if isinstance(data, dict) and not data.get("success", True):
                logger.warning(f"[AE Tracker] {airport_iata}: {data}")
                return []

            if not isinstance(data, list):
                return []

            logger.info(f"[AE Tracker] {airport_iata}/{direction}: {len(data)} live flights")
            return [normalize_ae_flight(f, direction, airport_iata) for f in data]

    except Exception as e:
        logger.error(f"[AE Tracker] {airport_iata}/{direction} error: {e}")
        return []


async def fetch_timetable(airport_iata: str, direction: str = "departure") -> list[dict]:
    """
    Fetch scheduled timetable for an airport using the Aviation Edge timetable endpoint.
    GET /v2/public/timetable?key=KEY&iataCode=TUN&type=departure
    """
    apiKey = _get_key()
    if not apiKey:
        logger.warning("AVIATION_EDGE_KEY not set — skipping Aviation Edge timetable")
        return []

    params = {
        "key":      apiKey,
        "iataCode": airport_iata,
        "type":     direction,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{AVIATION_EDGE_BASE}/timetable", params=params)
            resp.raise_for_status()
            data = resp.json()

            if isinstance(data, dict) and data.get("error"):
                logger.warning(f"[AE Timetable] {airport_iata}: {data}")
                return []

            if not isinstance(data, list):
                return []

            logger.info(f"[AE Timetable] {airport_iata}/{direction}: {len(data)} scheduled flights")
            return [normalize_ae_flight(f, direction, airport_iata) for f in data]

    except Exception as e:
        logger.error(f"[AE Timetable] {airport_iata}/{direction} error: {e}")
        return []


import asyncio

async def fetch_all_flights(airport_iata: str, direction: str = "both") -> list[dict]:
    """
    Combined: live tracker + timetable, deduplicated by flight number.
    Fetches concurrently to avoid timeouts.
    """
    results: list[dict] = []
    directions = ["departure", "arrival"] if direction == "both" else [direction]

    # Build tasks for concurrent execution
    tasks = []
    for d in directions:
        tasks.append(fetch_live_flights(airport_iata, d))
        tasks.append(fetch_timetable(airport_iata, d))

    # Run all API calls concurrently
    fetched_results = await asyncio.gather(*tasks)

    # Reconstruct the results
    # fetched_results is a list of lists: [live_dep, tt_dep, live_arr, tt_arr]
    
    for i in range(0, len(fetched_results), 2):
        live = fetched_results[i]
        timetable = fetched_results[i+1]

        live_map = {f["flight_number"]: f for f in live}
        tt_numbers = set()

        for tt in timetable:
            fnum = tt["flight_number"]
            tt_numbers.add(fnum)
            if fnum in live_map:
                # Merge live tracking metrics into timetable record
                tt["live"] = live_map[fnum].get("live")
                tt["status"] = "in_air"
                # Sometimes live has aircraft type/reg that TT misses
                if live_map[fnum].get("aircraft_type"):
                    tt["aircraft_type"] = live_map[fnum]["aircraft_type"]
                if live_map[fnum].get("aircraft_reg"):
                    tt["aircraft_reg"] = live_map[fnum]["aircraft_reg"]
            results.append(tt)
        
        # Add any live flights that weren't in the timetable at all
        for fnum, lf in live_map.items():
            if fnum not in tt_numbers:
                results.append(lf)

    # Sort by scheduled departure/arrival
    results.sort(key=lambda f: f.get("dep_scheduled") or f.get("arr_scheduled") or "")
    return results
