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
import asyncio
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

# Bidirectional maps for Tunisian airports
IATA_TO_ICAO = {
    "TUN": "DTTA",
    "MIR": "DTMB",
    "DJE": "DTTJ",
    "NBE": "DTNH",
}

ICAO_TO_IATA = {
    "DTTA": "TUN",
    "DTMB": "MIR",
    "DTTJ": "DJE",
    "DTNH": "NBE",
}

async def fetch_with_retry(client: httpx.AsyncClient, url: str, params: dict, max_retries: int = 3) -> httpx.Response:
    """Fetch URL with exponential backoff on HTTP/Connection/Rate-Limit errors."""
    delay = 1.0
    for attempt in range(max_retries):
        try:
            resp = await client.get(url, params=params)
            if resp.status_code == 429 or resp.status_code >= 500:
                logger.warning(f"[AE API] Attempt {attempt + 1} got status {resp.status_code} for {url}. Retrying in {delay}s...")
                await asyncio.sleep(delay)
                delay *= 2
                continue
            resp.raise_for_status()
            return resp
        except (httpx.HTTPError, httpx.NetworkError) as e:
            if attempt == max_retries - 1:
                logger.error(f"[AE API] Final attempt {attempt + 1} failed for {url}: {e}")
                raise
            logger.warning(f"[AE API] Attempt {attempt + 1} failed for {url}: {e}. Retrying in {delay}s...")
            await asyncio.sleep(delay)
            delay *= 2
    raise httpx.HTTPError("Max retries exceeded with status anomalies")



def _get_key() -> str:
    """Always read the key fresh — fallback to hardcoded if env not loaded yet."""
    return os.getenv("AVIATION_EDGE_KEY") or "013d47-5ea66a"



def normalize_ae_flight(raw: dict, direction: str, airport_iata: str) -> dict:
    """Normalize an Aviation Edge flight object to the standard normalized format."""
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
        "boarding": "boarding",
        "taxiing":  "taxiing",
        "landed":   "landed",
        "cancelled": "cancelled",
        "incident":  "delayed",
        "diverted":  "delayed",
        "scheduled": "scheduled",
        "unknown":   "scheduled",
    }
    status = status_map.get(status_raw.lower() if status_raw else "", "scheduled")

    # Robust airborne telemetry backup detection rule
    geo = raw.get("geography") or {}
    speed_info = raw.get("speed") or {}
    alt = geo.get("altitude")
    spd = speed_info.get("horizontal")
    is_ground = speed_info.get("isGround")

    is_airborne_telemetry = False
    if alt is not None and alt > 1000:
        if spd is not None and spd > 100:
            if is_ground is False:
                is_airborne_telemetry = True

    if is_airborne_telemetry:
        status = "in_air"

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

    dep_iata = dep.get("iataCode") or ""
    dep_icao = dep.get("icaoCode") or ""
    arr_iata = arr.get("iataCode") or ""
    arr_icao = arr.get("icaoCode") or ""

    # Normalize ICAO to IATA if matching
    if dep_icao in ICAO_TO_IATA:
        dep_iata = ICAO_TO_IATA[dep_icao]
    elif dep_iata in ICAO_TO_IATA:
        dep_iata = ICAO_TO_IATA[dep_iata]

    if arr_icao in ICAO_TO_IATA:
        arr_iata = ICAO_TO_IATA[arr_icao]
    elif arr_iata in ICAO_TO_IATA:
        arr_iata = ICAO_TO_IATA[arr_iata]

    # Force to queried airport_iata if matched direction
    if direction == "departure" and dep_iata != airport_iata:
        dep_iata = airport_iata
    if direction == "arrival" and arr_iata != airport_iata:
        arr_iata = airport_iata

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
        "dep_iata":      dep_iata,
        "dep_terminal":  dep.get("terminal"),
        "dep_gate":      dep.get("gate"),
        "dep_scheduled": dep.get("scheduledTime"),
        "dep_estimated": dep.get("estimatedTime"),
        "dep_actual":    dep.get("actualTime"),
        "dep_delay":     dep_delay,

        # Arrival
        "arr_airport":   arr.get("airport", "—"),
        "arr_iata":      arr_iata,
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
    Queries both IATA and ICAO endpoints concurrently and merges them.
    """
    apiKey = _get_key()
    if not apiKey:
        logger.warning("AVIATION_EDGE_KEY not set — skipping Aviation Edge live tracker")
        return []

    icao_code = IATA_TO_ICAO.get(airport_iata)
    queries = []

    # Primary IATA query
    param_key_iata = "depIata" if direction == "departure" else "arrIata"
    queries.append((f"{AVIATION_EDGE_BASE}/flights", {
        "key": apiKey,
        param_key_iata: airport_iata,
    }, f"IATA({airport_iata})"))

    # Secondary ICAO query if mapped
    if icao_code:
        param_key_icao = "depIcao" if direction == "departure" else "arrIcao"
        queries.append((f"{AVIATION_EDGE_BASE}/flights", {
            "key": apiKey,
            param_key_icao: icao_code,
        }, f"ICAO({icao_code})"))

    async def run_query(url: str, params: dict, label: str):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await fetch_with_retry(client, url, params=params)
                data = resp.json()

                # Transient debug ingestion log
                logger.info(
                    f"[AE Tracker Ingestion Audit] Requested Airport: {airport_iata} | "
                    f"Normalized: {airport_iata} | "
                    f"Endpoint: {url} (querying {label}) | "
                    f"Response status: {resp.status_code} | "
                    f"Raw payload size: {len(data) if isinstance(data, list) else 'N/A'}"
                )

                if isinstance(data, dict) and not data.get("success", True):
                    logger.warning(f"[AE Tracker] {airport_iata} ({label}) success=False: {data}")
                    return []

                if not isinstance(data, list):
                    return []

                return data
        except Exception as e:
            logger.error(f"[AE Tracker] Query failed for {airport_iata} ({label}): {e}")
            return []

    tasks = [run_query(url, params, label) for url, params, label in queries]
    raw_results_list = await asyncio.gather(*tasks)

    # Merge and deduplicate by flight number
    merged_raw = {}
    total_raw_count = 0
    for res_list in raw_results_list:
        total_raw_count += len(res_list)
        for raw_f in res_list:
            flight = raw_f.get("flight") or {}
            fnum = (
                flight.get("iataNumber")
                or flight.get("icaoNumber")
                or raw_f.get("flightIata")
                or "—"
            )
            if fnum and fnum != "—":
                merged_raw[fnum] = raw_f

    deduped_raw_list = list(merged_raw.values())

    # Normalize flights
    normalized_flights = []
    filtered_out_count = 0
    for rf in deduped_raw_list:
        norm = normalize_ae_flight(rf, direction, airport_iata)
        if norm:
            normalized_flights.append(norm)
        else:
            filtered_out_count += 1

    live_count = sum(1 for f in normalized_flights if f.get("live") is not None)
    sched_count = len(normalized_flights) - live_count

    # Detailed Audit Log:
    logger.info(
        f"[AE Tracker Audit Result] Airport: {airport_iata} | "
        f"Direction: {direction} | "
        f"API Raw Flights Count: {total_raw_count} | "
        f"Deduplicated Count: {len(deduped_raw_list)} | "
        f"Returned Normalized Count: {len(normalized_flights)} | "
        f"Live Flights: {live_count} | "
        f"Scheduled Flights: {sched_count} | "
        f"Filtered-out: {filtered_out_count}"
    )

    return normalized_flights


async def fetch_timetable(airport_iata: str, direction: str = "departure") -> list[dict]:
    """
    Fetch scheduled timetable for an airport using the Aviation Edge timetable endpoint.
    Queries both IATA and ICAO endpoints concurrently and merges them.
    """
    apiKey = _get_key()
    if not apiKey:
        logger.warning("AVIATION_EDGE_KEY not set — skipping Aviation Edge timetable")
        return []

    icao_code = IATA_TO_ICAO.get(airport_iata)
    queries = []

    # Primary IATA query
    queries.append((f"{AVIATION_EDGE_BASE}/timetable", {
        "key": apiKey,
        "iataCode": airport_iata,
        "type": direction,
    }, f"IATA({airport_iata})"))

    # Secondary ICAO query if mapped
    if icao_code:
        queries.append((f"{AVIATION_EDGE_BASE}/timetable", {
            "key": apiKey,
            "icaoCode": icao_code,
            "type": direction,
        }, f"ICAO({icao_code})"))

    async def run_query(url: str, params: dict, label: str):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await fetch_with_retry(client, url, params=params)
                data = resp.json()

                # Transient debug ingestion log
                logger.info(
                    f"[AE Timetable Ingestion Audit] Requested Airport: {airport_iata} | "
                    f"Normalized: {airport_iata} | "
                    f"Endpoint: {url} (querying {label}) | "
                    f"Response status: {resp.status_code} | "
                    f"Raw payload size: {len(data) if isinstance(data, list) else 'N/A'}"
                )

                if isinstance(data, dict) and data.get("error"):
                    logger.warning(f"[AE Timetable] {airport_iata} ({label}) error: {data}")
                    return []

                if not isinstance(data, list):
                    return []

                return data
        except Exception as e:
            logger.error(f"[AE Timetable] Query failed for {airport_iata} ({label}): {e}")
            return []

    tasks = [run_query(url, params, label) for url, params, label in queries]
    raw_results_list = await asyncio.gather(*tasks)

    # Merge and deduplicate by flight number
    merged_raw = {}
    total_raw_count = 0
    for res_list in raw_results_list:
        total_raw_count += len(res_list)
        for raw_f in res_list:
            flight = raw_f.get("flight") or {}
            fnum = (
                flight.get("iataNumber")
                or flight.get("icaoNumber")
                or raw_f.get("flightIata")
                or "—"
            )
            if fnum and fnum != "—":
                merged_raw[fnum] = raw_f

    deduped_raw_list = list(merged_raw.values())

    # Normalize flights
    normalized_flights = []
    filtered_out_count = 0
    for rf in deduped_raw_list:
        norm = normalize_ae_flight(rf, direction, airport_iata)
        if norm:
            normalized_flights.append(norm)
        else:
            filtered_out_count += 1

    live_count = sum(1 for f in normalized_flights if f.get("live") is not None)
    sched_count = len(normalized_flights) - live_count

    # Detailed Audit Log:
    logger.info(
        f"[AE Timetable Audit Result] Airport: {airport_iata} | "
        f"Direction: {direction} | "
        f"API Raw Timetable Count: {total_raw_count} | "
        f"Deduplicated Count: {len(deduped_raw_list)} | "
        f"Returned Normalized Count: {len(normalized_flights)} | "
        f"Live Flights: {live_count} | "
        f"Scheduled Flights: {sched_count} | "
        f"Filtered-out: {filtered_out_count}"
    )

    return normalized_flights


async def fetch_flights_history(airport_iata: str, direction: str, date_from: str, date_to: str) -> list[dict]:
    """
    Fetch historical flights from Aviation Edge API.
    """
    apiKey = _get_key()
    if not apiKey:
        logger.warning("AVIATION_EDGE_KEY not set — skipping history fetch")
        return []

    icao_code = IATA_TO_ICAO.get(airport_iata)
    queries = []

    # Primary IATA query
    queries.append((f"{AVIATION_EDGE_BASE}/flightsHistory", {
        "key": apiKey,
        "code": airport_iata,
        "type": direction,
        "date_from": date_from,
        "date_to": date_to,
    }, f"IATA({airport_iata})"))

    # Secondary ICAO query if mapped
    if icao_code:
        queries.append((f"{AVIATION_EDGE_BASE}/flightsHistory", {
            "key": apiKey,
            "code": icao_code,
            "type": direction,
            "date_from": date_from,
            "date_to": date_to,
        }, f"ICAO({icao_code})"))

    async def run_query(url: str, params: dict, label: str):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await fetch_with_retry(client, url, params=params)
                data = resp.json()

                if isinstance(data, dict) and data.get("error"):
                    logger.warning(f"[AE History] {airport_iata} ({label}) error: {data}")
                    return []

                if not isinstance(data, list):
                    return []

                return data
        except Exception as e:
            logger.error(f"[AE History] Query failed for {airport_iata} ({label}): {e}")
            return []

    tasks = [run_query(url, params, label) for url, params, label in queries]
    raw_results_list = await asyncio.gather(*tasks)

    # Merge and deduplicate by flight number
    merged_raw = {}
    for res_list in raw_results_list:
        for raw_f in res_list:
            flight = raw_f.get("flight") or {}
            fnum = (
                flight.get("iataNumber")
                or flight.get("icaoNumber")
                or raw_f.get("flightIata")
                or "—"
            )
            if fnum and fnum != "—":
                merged_raw[fnum] = raw_f

    deduped_raw_list = list(merged_raw.values())
    return [normalize_ae_flight(f, direction, airport_iata) for f in deduped_raw_list]


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


async def fetch_flight_by_number(flight_number: str) -> list[dict]:
    """
    Fetch a specific flight from the Aviation Edge API by its flight number.
    Tries both timetable (scheduled) and flights (active tracking) endpoints.
    Allows dynamic cache synchronization on details search misses.
    """
    apiKey = _get_key()
    if not apiKey:
        logger.warning("AVIATION_EDGE_KEY not set — skipping realtime number lookup")
        return []

    fn = flight_number.upper().replace(" ", "")
    
    # We query both by flightIata and flightIcao to ensure coverage of both code styles
    queries = []
    
    # Timetable endpoint queries
    queries.append((f"{AVIATION_EDGE_BASE}/timetable", {"key": apiKey, "flightIata": fn}, "Timetable(IATA)"))
    queries.append((f"{AVIATION_EDGE_BASE}/timetable", {"key": apiKey, "flightIcao": fn}, "Timetable(ICAO)"))
    
    # Live tracker endpoint queries
    queries.append((f"{AVIATION_EDGE_BASE}/flights", {"key": apiKey, "flightIata": fn}, "Tracker(IATA)"))
    queries.append((f"{AVIATION_EDGE_BASE}/flights", {"key": apiKey, "flightIcao": fn}, "Tracker(ICAO)"))

    async def run_query(url: str, params: dict, label: str) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await fetch_with_retry(client, url, params=params)
                data = resp.json()
                
                logger.info(
                    f"[AE Realtime Lookup] Query {label} for {fn} status: {resp.status_code} | "
                    f"Count: {len(data) if isinstance(data, list) else 'N/A'}"
                )
                
                if not isinstance(data, list):
                    return []
                return data
        except Exception as e:
            logger.debug(f"[AE Realtime Lookup] Query {label} failed for {fn}: {e}")
            return []

    tasks = [run_query(url, params, label) for url, params, label in queries]
    raw_results_list = await asyncio.gather(*tasks)

    # Reconstruct and normalize
    results = []
    seen = set()
    
    # The first 2 results are timetables, the next 2 are trackers
    raw_timetables = raw_results_list[0] + raw_results_list[1]
    raw_trackers = raw_results_list[2] + raw_results_list[3]

    # Map raw trackers by flight number
    tracker_map = {}
    for rt in raw_trackers:
        flight = rt.get("flight") or {}
        fnum = (
            flight.get("iataNumber")
            or flight.get("icaoNumber")
            or rt.get("flightIata")
            or "—"
        )
        if fnum and fnum != "—":
            tracker_map[fnum] = rt

    # Helper to resolve direction based on airports in mapped network
    def get_direction_and_airport(item: dict) -> tuple[str, str]:
        dep_iata = item.get("departure", {}).get("iataCode")
        arr_iata = item.get("arrival", {}).get("iataCode")
        
        # If departure is one of our monitored Tunisian airports, it is a departure
        if dep_iata in IATA_TO_ICAO:
            return "departure", dep_iata
        # If arrival is one of our monitored Tunisian airports, it is an arrival
        if arr_iata in IATA_TO_ICAO:
            return "arrival", arr_iata
        
        # Fallback default
        return "departure", dep_iata or "TUN"

    # Process timetables first
    for rt in raw_timetables:
        direction, airport_iata = get_direction_and_airport(rt)
        norm = normalize_ae_flight(rt, direction, airport_iata)
        if not norm:
            continue
            
        fnum = norm["flight_number"]
        if fnum in tracker_map:
            # Merge tracker details (coordinates, speed, heading, status) into the schedule
            norm["live"] = normalize_ae_flight(tracker_map[fnum], direction, airport_iata).get("live")
            norm["status"] = "in_air"
            
        key = (norm["flight_number"], norm["direction"], norm["dep_scheduled"])
        if key not in seen:
            results.append(norm)
            seen.add(key)

    # Process remaining trackers that weren't in timetables
    for fnum, rt in tracker_map.items():
        direction, airport_iata = get_direction_and_airport(rt)
        norm = normalize_ae_flight(rt, direction, airport_iata)
        if not norm:
            continue
            
        key = (norm["flight_number"], norm["direction"], norm["dep_scheduled"])
        if key not in seen:
            results.append(norm)
            seen.add(key)

    # Sort chronologically
    results.sort(key=lambda f: f.get("dep_scheduled") or f.get("arr_scheduled") or "")
    return results

