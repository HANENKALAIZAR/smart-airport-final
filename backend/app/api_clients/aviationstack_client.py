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

# Global tracking metrics to prevent API combustion
API_REQUESTS_MADE = 0


def _cache_path(airport: str, direction: str, flight_date: Optional[str] = None, offset: int = 0) -> Path:
    date_str = f"_{flight_date}" if flight_date else ""
    offset_str = f"_off{offset}" if offset > 0 else ""
    return CACHE_DIR / f"{airport}_{direction}{date_str}{offset_str}.json"


def _read_cache(airport: str, direction: str, flight_date: Optional[str] = None, offset: int = 0) -> Optional[dict]:
    """Read cached flight data if still fresh."""
    path = _cache_path(airport, direction, flight_date, offset)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if time.time() - data.get("fetched_at", 0) < CACHE_TTL:
            return data
    except Exception:
        pass
    return None


def _write_cache(airport: str, direction: str, payload: dict, flight_date: Optional[str] = None, offset: int = 0):
    """Write flight data to cache."""
    payload["fetched_at"] = time.time()
    try:
        _cache_path(airport, direction, flight_date, offset).write_text(
            json.dumps(payload, ensure_ascii=False),
            encoding="utf-8"
        )
    except Exception:
        pass


async def fetch_flights(
    airport_iata: str,
    direction: str = "departure",
    limit: int = 100,
    offset: int = 0,
    flight_date: Optional[str] = None
) -> dict:
    """
    Fetch flights from AviationStack for a given airport.

    Args:
        airport_iata: IATA code (e.g. "TUN")
        direction: "departure" or "arrival"
        limit: Max number of results
        offset: Pagination offset
        flight_date: YYYY-MM-DD parameter
    """
    global API_REQUESTS_MADE
    from app.config import settings
    import logging
    logger = logging.getLogger(__name__)

    # Check cache first
    cached = _read_cache(airport_iata, direction, flight_date, offset)
    if cached:
        return cached

    if API_REQUESTS_MADE >= settings.AVIATIONSTACK_MAX_REQUESTS:
        logger.error(f"API LIMIT REACHED! Halting execution beyond {settings.AVIATIONSTACK_MAX_REQUESTS} calls.")
        return {"data": [], "pagination": {"count": 0, "total": 0}}

    params = {
        "access_key": AVIATIONSTACK_KEY,
        "limit": min(limit, 100),
        "offset": offset,
    }

    if flight_date:
        params["flight_date"] = flight_date

    if direction == "departure":
        params["dep_iata"] = airport_iata
    else:
        params["arr_iata"] = airport_iata

    API_REQUESTS_MADE += 1

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{AVIATIONSTACK_BASE}/flights", params=params)
            resp.raise_for_status()
            data = resp.json()

            if "error" in data:
                raise Exception(data["error"].get("message", str(data["error"])))

            # Cache the result
            _write_cache(airport_iata, direction, data, flight_date, offset)
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

    delay_dep = dep.get("delay")
    delay_arr = arr.get("delay")
    if delay_dep is not None and delay_arr is not None:
        delay = max(delay_dep, delay_arr)
    else:
        delay = delay_dep if delay_dep is not None else delay_arr

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


# ── DB persistence (v10) ──────────────────────────────────────────────────

def _get_or_create_airline(db, iata_code: str, name: str = ""):
    """Return airline_id, creating a minimal row if missing."""
    from app.models.models import Airline
    if not iata_code:
        return None
    al = db.query(Airline).filter(Airline.iata_code == iata_code).first()
    if not al:
        al = Airline(
            iata_code=iata_code,
            name=name or iata_code,
            reliability_score=0.80,
        )
        db.add(al)
        db.flush()
    return al.id


def _get_or_create_airport(db, iata_code: str, name: str = ""):
    """Return airport_id, creating a minimal row if missing."""
    from app.models.models import Airport
    if not iata_code:
        return None
    ap = db.query(Airport).filter(Airport.iata_code == iata_code).first()
    if not ap:
        ap = Airport(
            iata_code=iata_code,
            name=name or iata_code,
            city="Unknown",
            country="Unknown",
            region="International",
            timezone="UTC",
        )
        db.add(ap)
        db.flush()
    return ap.id


async def fetch_and_store_flights(
    airport_iata: str,
    direction: str = "departure",
    db=None,
    limit: int = 100,
) -> dict:
    import logging
    from datetime import datetime, timedelta, date
    from sqlalchemy import text
    from app.config import settings
    logger = logging.getLogger(__name__)

    global API_REQUESTS_MADE

    total_stats = {"fetched": 0, "upserted": 0, "skipped": 0, "errors": 0}

    if db is None:
        logger.warning("fetch_and_store_flights called without db session — returning raw data only")
        return total_stats

    today = datetime.utcnow().date()
    
    # Loop over dates from HISTORICAL_DAYS backwards (+1 to include today inherently if intended, user explicitly said 2 days only so we loop 0 to HISTORICAL_DAYS-1)
    for day_offset in range(settings.HISTORICAL_DAYS):
        target_date = today - timedelta(days=day_offset)
        str_date = target_date.strftime("%Y-%m-%d")

        # Before calling API, check if data already exists for: (airport + date + direction)
        has_data_query = "SELECT 1 FROM flights WHERE flight_date = :fdate AND "
        has_data_query += ("dep_iata = :iata" if direction == "departure" else "arr_iata = :iata")
        has_data_query += " LIMIT 1"
        
        # We simply check if there's any record
        existing = db.execute(text(has_data_query), {"fdate": target_date, "iata": airport_iata}).fetchone()

        if existing:
            logger.info(f"Skipping {airport_iata} {direction} {str_date}: Data already exists in DB.")
            continue

        offset = 0
        while True:
            if API_REQUESTS_MADE >= settings.AVIATIONSTACK_MAX_REQUESTS:
                logger.warning("API LIMIT REACHED! Bypassing subsequent calls.")
                return total_stats

            raw_data = await fetch_flights(airport_iata, direction, limit=limit, offset=offset, flight_date=str_date)
            flights_raw = raw_data.get("data") or []
            
            total_stats["fetched"] += len(flights_raw)

            for raw in flights_raw:
                try:
                    norm = normalize_flight(raw, direction)

                    # Parse dates
                    dep_sched_str = norm.get("dep_scheduled")
                    arr_sched_str = norm.get("arr_scheduled")
                    dep_actual_str = norm.get("dep_actual")
                    arr_actual_str = norm.get("arr_actual")
                    flight_date_str = norm.get("flight_date")

                    if not dep_sched_str and not flight_date_str:
                        total_stats["skipped"] += 1
                        continue

                    def _parse_dt(s):
                        if not s: return None
                        try:
                            return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
                        except Exception:
                            return None

                    dep_sched = _parse_dt(dep_sched_str)
                    arr_sched = _parse_dt(arr_sched_str)
                    dep_actual = _parse_dt(dep_actual_str)
                    arr_actual = _parse_dt(arr_actual_str)

                    flight_date = None
                    if flight_date_str:
                        try:
                            flight_date = datetime.strptime(flight_date_str, "%Y-%m-%d").date()
                        except Exception:
                            pass
                    if flight_date is None and dep_sched:
                        flight_date = dep_sched.date()

                    flight_number = norm.get("flight_number") or ""
                    if not flight_number or not flight_date:
                        total_stats["skipped"] += 1
                        continue

                    dep_iata = (norm.get("dep_iata") or "").upper()
                    arr_iata = (norm.get("arr_iata") or "").upper()
                    airline_iata = (norm.get("airline_iata") or "").upper()
                    airline_name = norm.get("airline_name") or ""

                    # Resolve FKs
                    airline_id = _get_or_create_airline(db, airline_iata, airline_name)
                    origin_id  = _get_or_create_airport(db, dep_iata, norm.get("dep_airport") or "")
                    dest_id    = _get_or_create_airport(db, arr_iata, norm.get("arr_airport") or "")

                    if airline_id is None or origin_id is None or dest_id is None:
                        total_stats["skipped"] += 1
                        continue

                    delay_min     = int(norm.get("delay_minutes") or 0)
                    aircraft_type = norm.get("aircraft_type") or None

                    if delay_min == 0 and dep_sched and dep_actual and dep_actual > dep_sched:
                        delay_min = int((dep_actual - dep_sched).total_seconds() / 60)

                    status_raw = norm.get("status", "scheduled")
                    status_map = {
                        "scheduled": "scheduled",
                        "on_time": "on_time",
                        "delayed": "delayed",
                        "cancelled": "cancelled",
                        "landed": "on_time",
                    }
                    status = status_map.get(status_raw, "scheduled")
                    if delay_min > 15 and status not in ("cancelled",):
                        status = "delayed"

                    db.execute(text("""
                        INSERT INTO flights
                            (flight_number, airline_id, origin_airport_id, dest_airport_id,
                             scheduled_departure, scheduled_arrival, actual_departure, actual_arrival,
                             status, delay_minutes, aircraft_type,
                             flight_date, dep_iata, arr_iata, source)
                        VALUES
                            (:fn, :al, :orig, :dest,
                             :sdep, :sarr, :adep, :aarr,
                             :status, :delay, :actype,
                             :fdate, :diata, :aiata, 'aviationstack')
                        ON CONFLICT (flight_number, flight_date) WHERE flight_date IS NOT NULL AND flight_number IS NOT NULL
                        DO UPDATE SET
                            actual_departure  = EXCLUDED.actual_departure,
                            actual_arrival    = EXCLUDED.actual_arrival,
                            status            = EXCLUDED.status,
                            delay_minutes     = EXCLUDED.delay_minutes,
                            aircraft_type     = COALESCE(EXCLUDED.aircraft_type, flights.aircraft_type)
                    """), {
                        "fn":     flight_number,
                        "al":     airline_id,
                        "orig":   origin_id,
                        "dest":   dest_id,
                        "sdep":   dep_sched,
                        "sarr":   arr_sched,
                        "adep":   dep_actual,
                        "aarr":   arr_actual,
                        "status": status,
                        "delay":  delay_min,
                        "actype": aircraft_type,
                        "fdate":  flight_date,
                        "diata":  dep_iata or None,
                        "aiata":  arr_iata or None,
                    })
                    total_stats["upserted"] += 1

                except Exception as e:
                    logger.error(f"Error storing flight from {airport_iata}/{direction}: {e}")
                    total_stats["errors"] += 1
                    db.rollback()
                    continue

            # Pagination breaks
            count = raw_data.get("pagination", {}).get("count", 0)
            if count < limit:
                break
            offset += limit

    db.commit()
    logger.info(
        f"AviationStack Historical Loop Finished {airport_iata}/{direction}: "
        f"fetched={total_stats['fetched']} upserted={total_stats['upserted']} "
        f"skipped={total_stats['skipped']} errors={total_stats['errors']}"
    )
    return total_stats

