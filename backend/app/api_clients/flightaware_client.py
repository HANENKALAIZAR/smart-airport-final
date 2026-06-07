"""
FlightAware AeroAPI Client
===========================
Secondary enrichment provider for live flight status.

Design:
  - Aviation Edge remains PRIMARY. This client is enrichment-only.
  - Only called for flights in the scheduled/delayed/unknown operational window.
  - Per-ident TTL cache prevents double-querying within the cache window.
  - Circuit breaker (in provider_health.py) suspends calls after failure storms.
  - All HTTP calls are async-safe with a hard timeout (configurable, default 5s).
  - Returns None on 404, timeout, disabled, missing key, or circuit open.
  - Self-disables permanently on 401/403 (invalid key) for the process lifetime.

Required .env:
  FLIGHTAWARE_API_KEY=your_personal_key
  FLIGHTAWARE_ENABLED=true              # set false to skip entirely
  FLIGHTAWARE_BASE_URL=https://aeroapi.flightaware.com/aeroapi
  FLIGHTAWARE_TIMEOUT_SECONDS=5.0
  FLIGHTAWARE_CACHE_TTL_SECONDS=180

Structured log tags emitted:
  [FA DISABLED]      - key missing / flag false / self-disabled after 401
  [FA MISS]          - ident not found (404) or no flights in response
  [FA HIT]           - successful response with >= 1 flight entry
  [FA RATE LIMITED]  - HTTP 429 received
  [FA TIMEOUT]       - httpx.TimeoutException
  [FA ERROR]         - any other exception
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from cachetools import TTLCache

from app.config import settings
from app.services.provider_health import health_registry

logger = logging.getLogger(__name__)

# ── Tunisian airline IATA ↔ ICAO maps ─────────────────────────────────────────
# FlightAware AeroAPI prefers ICAO idents (e.g. TAR640, LBT640).
TUNISIAN_IATA_TO_ICAO: dict[str, str] = {
    "TU": "TAR",   # Tunisair
    "BJ": "LBT",   # Nouvelair
    "UG": "HFY",   # Tunisair Express
    "3O": "MRO",   # Air Arabia Maroc (on some TUN routes)
}

TUNISIAN_ICAO_TO_IATA: dict[str, str] = {v: k for k, v in TUNISIAN_IATA_TO_ICAO.items()}

# ── FlightAware status vocabulary → internal status ──────────────────────────
FA_STATUS_MAP: dict[str, str] = {
    "Scheduled":     "scheduled",
    "En Route":      "in_air",
    "Active":        "in_air",
    "Arrived":       "landed",
    "Landed":        "landed",
    "Cancelled":     "cancelled",
    "Unknown":       "scheduled",
    "":              "scheduled",
}

# ── Self-disable flag (set permanently on 401/403) ────────────────────────────
_AUTH_FAILED: bool = False

# ── Per-ident TTL cache ───────────────────────────────────────────────────────
# maxsize=200 covers the maximum realistic window of enrichable flights.
_ident_cache: TTLCache = TTLCache(
    maxsize=200,
    ttl=settings.FLIGHTAWARE_CACHE_TTL_SECONDS,
)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Public helpers ─────────────────────────────────────────────────────────────

def is_enabled() -> bool:
    """
    Returns True if FlightAware enrichment is allowed to run.
    Checks: env flag, API key presence, and self-disable after auth failure.
    """
    global _AUTH_FAILED
    if _AUTH_FAILED:
        return False
    if not settings.FLIGHTAWARE_ENABLED:
        return False
    if not settings.FLIGHTAWARE_API_KEY:
        return False
    return True


def get_ident_candidates(
    flight_number: str,
    airline_iata: Optional[str],
    airline_icao: Optional[str],
) -> list[str]:
    """
    Build a prioritised list of FlightAware ident strings to try for a flight.

    Priority:
    1. Known ICAO ident built from snap.airline_icao + numeric suffix
       (e.g. airline_icao=LBT, flight=BJ640 → LBT640)
    2. snap.flight_number as-is (IATA, e.g. BJ640)
    3. IATA→ICAO map lookup (e.g. BJ→LBT → LBT640)

    Deduplication: no ident appears twice in the result.
    """
    import re
    fn = (flight_number or "").upper().strip()

    # Extract numeric suffix from the flight number (e.g. "BJ640" → "640")
    num_match = re.search(r"(\d+[A-Z]?)$", fn)
    numeric_suffix = num_match.group(1) if num_match else ""

    candidates: list[str] = []
    seen: set[str] = set()

    def _add(ident: str) -> None:
        ident = ident.upper().strip()
        if ident and ident not in seen:
            candidates.append(ident)
            seen.add(ident)

    # 1. ICAO from snap.airline_icao + numeric suffix
    if airline_icao and numeric_suffix:
        _add(f"{airline_icao.upper()}{numeric_suffix}")

    # 2. Flight number as-is (may already be IATA)
    _add(fn)

    # 3. IATA→ICAO map (Tunisian carriers)
    if airline_iata and numeric_suffix:
        mapped_icao = TUNISIAN_IATA_TO_ICAO.get(airline_iata.upper())
        if mapped_icao:
            _add(f"{mapped_icao}{numeric_suffix}")

    # 4. Extract carrier prefix from flight number and map
    prefix_match = re.match(r"^([A-Z]+)", fn)
    if prefix_match:
        prefix = prefix_match.group(1)
        mapped_icao = TUNISIAN_IATA_TO_ICAO.get(prefix)
        if mapped_icao and numeric_suffix:
            _add(f"{mapped_icao}{numeric_suffix}")

    return candidates


def normalize_fa_flight(raw_fa: dict) -> dict:
    """
    Normalize a single FlightAware flight entry to our internal field names.

    Maps:
      ident                → flight_number
      origin.code_iata     → dep_iata
      destination.code_iata→ arr_iata
      scheduled_out        → dep_scheduled
      estimated_out        → dep_estimated
      actual_out           → dep_actual
      scheduled_in         → scheduled_arrival (arr_scheduled)
      estimated_in         → arr_estimated
      actual_in            → arr_actual
      status               → status (via FA_STATUS_MAP)
      last_position.*      → latitude / longitude / altitude_ft / speed_kmh
    """
    origin = raw_fa.get("origin") or {}
    dest   = raw_fa.get("destination") or {}
    pos    = raw_fa.get("last_position") or {}

    fa_status_raw = raw_fa.get("status") or ""
    status = FA_STATUS_MAP.get(fa_status_raw, "scheduled")

    def _parse_fa_dt(val: Optional[str]) -> Optional[datetime]:
        """Parse ISO 8601 string from FA API. Returns datetime or None."""
        if not val:
            return None
        for fmt in (
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S",
        ):
            try:
                dt = datetime.strptime(val, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except (ValueError, TypeError):
                continue
        return None

    altitude_raw = pos.get("altitude")
    speed_raw    = pos.get("groundspeed")

    return {
        "flight_number":    raw_fa.get("ident") or raw_fa.get("ident_iata") or "",
        "dep_iata":         origin.get("code_iata") or origin.get("code") or "",
        "arr_iata":         dest.get("code_iata") or dest.get("code") or "",
        "dep_scheduled":    _parse_fa_dt(raw_fa.get("scheduled_out")),
        "dep_estimated":    _parse_fa_dt(raw_fa.get("estimated_out")),
        "dep_actual":       _parse_fa_dt(raw_fa.get("actual_out")),
        "arr_scheduled":    _parse_fa_dt(raw_fa.get("scheduled_in")),
        "arr_estimated":    _parse_fa_dt(raw_fa.get("estimated_in")),
        "arr_actual":       _parse_fa_dt(raw_fa.get("actual_in")),
        "status":           status,
        "fa_status_raw":    fa_status_raw,
        "latitude":         float(pos["latitude"])  if pos.get("latitude")  is not None else None,
        "longitude":        float(pos["longitude"]) if pos.get("longitude") is not None else None,
        "altitude_ft":      float(altitude_raw)     if altitude_raw is not None else None,
        "speed_kmh":        float(speed_raw) * 1.852 if speed_raw is not None else None,  # knots → km/h
        "fetched_at":       _now_utc(),
        # ── Gate / terminal (FA AeroAPI provides these in origin/destination blocks) ──
        "dep_gate":         origin.get("gate") or raw_fa.get("gate_origin") or None,
        "arr_gate":         dest.get("gate")   or raw_fa.get("gate_destination") or None,
        "dep_terminal":     origin.get("terminal") or raw_fa.get("terminal_origin") or None,
        "arr_terminal":     dest.get("terminal")   or raw_fa.get("terminal_destination") or None,
        "_raw":             raw_fa,
    }


# ── Core fetch function ────────────────────────────────────────────────────────

async def fetch_flight_by_ident(ident: str) -> Optional[dict]:
    """
    Fetch a flight from FlightAware AeroAPI Personal by its ident string.

    Returns:
      dict  — normalized flight data (first/most-recent active entry)
      None  — disabled / cache-hit (no call made) / 404 / timeout / error

    The TTL cache deduplicates calls: if `ident` was fetched within
    FLIGHTAWARE_CACHE_TTL_SECONDS, returns the cached result without HTTP call.

    Structured log tags:
      [FA DISABLED]      key/flag missing or auth failed
      [FA HIT]           successful response
      [FA MISS]          404 or no flights in response
      [FA RATE LIMITED]  HTTP 429
      [FA TIMEOUT]       httpx.TimeoutException
      [FA ERROR]         other exception
    """
    global _AUTH_FAILED

    # ── 0. Disabled check ──────────────────────────────────────────────────
    if not is_enabled():
        logger.debug(f"[FA DISABLED] ident={ident} — enrichment disabled")
        return None

    # ── 1. Circuit breaker check ───────────────────────────────────────────
    if await health_registry.is_circuit_open("flightaware"):
        logger.debug(f"[FA DISABLED] ident={ident} — circuit is OPEN")
        return None

    ident = ident.upper().strip()

    # ── 2. TTL cache dedup ─────────────────────────────────────────────────
    if ident in _ident_cache:
        cached = _ident_cache[ident]
        logger.debug(f"[FA CACHE HIT] ident={ident} — using cached result")
        return cached  # may be None (cached miss)

    # ── 3. HTTP call ───────────────────────────────────────────────────────
    url = f"{settings.FLIGHTAWARE_BASE_URL}/flights/{ident}"
    headers = {
        "x-apikey":    settings.FLIGHTAWARE_API_KEY,
        "Accept":      "application/json; charset=UTF-8",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.FLIGHTAWARE_TIMEOUT_SECONDS) as client:
            resp = await client.get(url, headers=headers)

        # ── 4a. Auth failure — self-disable permanently ────────────────────
        if resp.status_code in (401, 403):
            _AUTH_FAILED = True
            logger.error(
                f"[FA DISABLED] ident={ident} HTTP {resp.status_code} — "
                f"invalid API key. Self-disabling FlightAware for this process."
            )
            _ident_cache[ident] = None
            return None

        # ── 4b. Rate limited ───────────────────────────────────────────────
        if resp.status_code == 429:
            logger.warning(f"[FA RATE LIMITED] ident={ident} — HTTP 429")
            await health_registry.record_rate_limit("flightaware")
            _ident_cache[ident] = None
            return None

        # ── 4c. Not found ─────────────────────────────────────────────────
        if resp.status_code == 404:
            logger.debug(f"[FA MISS] ident={ident} — 404 not found")
            await health_registry.record_miss("flightaware")
            _ident_cache[ident] = None
            return None

        # ── 4d. Other HTTP error ──────────────────────────────────────────
        if resp.status_code >= 400:
            logger.warning(
                f"[FA ERROR] ident={ident} — HTTP {resp.status_code}: {resp.text[:200]}"
            )
            await health_registry.record_failure("flightaware")
            _ident_cache[ident] = None
            return None

        # ── 4e. Parse response ────────────────────────────────────────────
        data = resp.json()
        flights = data.get("flights") or []

        if not flights:
            logger.debug(f"[FA MISS] ident={ident} — empty flights array")
            await health_registry.record_miss("flightaware")
            _ident_cache[ident] = None
            return None

        # Pick the most-recent entry (FA returns newest first)
        raw_flight = flights[0]
        normalized = normalize_fa_flight(raw_flight)

        logger.info(
            f"[FA HIT] ident={ident} "
            f"status={normalized['status']} (FA raw='{normalized['fa_status_raw']}') "
            f"dep_iata={normalized['dep_iata']} arr_iata={normalized['arr_iata']}"
        )
        await health_registry.record_success("flightaware")
        _ident_cache[ident] = normalized
        return normalized

    except httpx.TimeoutException:
        logger.warning(f"[FA TIMEOUT] ident={ident} — timed out after {settings.FLIGHTAWARE_TIMEOUT_SECONDS}s")
        await health_registry.record_timeout("flightaware")
        _ident_cache[ident] = None
        return None

    except Exception as exc:
        logger.error(f"[FA ERROR] ident={ident} — unexpected error: {exc}")
        await health_registry.record_failure("flightaware")
        _ident_cache[ident] = None
        return None
