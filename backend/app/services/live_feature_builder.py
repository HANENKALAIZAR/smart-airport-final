"""
Live Feature Builder (v12)
===========================
Builds the base feature vector from a live AviationEdge / AEFlightSnapshot
flight dict, then adds routing metadata so prediction_service._run_prediction()
can enrich with rolling historical features (V2 pipeline).

Keys returned:
  Base (computed here):
    dep_hour, is_weekend, is_peak_hour, distance_km, duration_min,
    airline_enc, dep_airport_enc, arr_airport_enc
  Routing metadata (passed through for rolling enrichment):
    dep_iata, arr_iata, airline_iata

  Rolling features (added by prediction_service._run_prediction() if the
  loaded model expects them):
    route_avg_delay_hist, airline_avg_delay_hist, hour_avg_delay_hist,
    route_flight_count, airline_flight_count, airport_departure_count,
    dep_month, dep_day_of_week

v12 changes:
  - Added is_peak_hour (07-09 / 17-20 departure window flag).
  - Added dep_iata, arr_iata, airline_iata pass-through keys so rolling
    features can be fetched by prediction_service without re-parsing the dict.
  - No schema changes required.
"""

import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ── Supported airport coordinates (Haversine fallback) ───────────────────────
_LATLON: dict[str, tuple[float, float]] = {
    "TUN": (36.851, 10.227), "MIR": (35.758, 10.755),
    "NBE": (36.076, 10.439), "DJE": (33.875, 10.775),
    "CDG": (49.009, 2.548),  "ORY": (48.725, 2.360),
    "LHR": (51.477, -0.461), "FRA": (50.033, 8.571),
    "FCO": (41.800, 12.239), "MXP": (45.630, 8.728),
    "MAD": (40.494, -3.567), "BCN": (41.297, 2.078),
    "IST": (40.977, 28.815), "DXB": (25.253, 55.366),
    "DOH": (25.273, 51.608), "AMM": (31.723, 35.993),
    "CAI": (30.122, 31.406), "CMN": (33.368, -7.590),
    "ALG": (36.691, 3.215),  "GVA": (46.238, 6.109),
    "BRU": (50.901, 4.484),  "VIE": (48.110, 16.570),
    "MUC": (48.354, 11.786), "AMS": (52.309, 4.764),
    "LYS": (45.726, 5.091),  "NCE": (43.658, 7.217),
    "MRS": (43.436, 5.215),  "MLA": (35.857, 14.477),
}

_FALLBACK_DISTANCE_KM = 1_800  # Tunis → Paris median


def _parse_scheduled(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def _haversine_km(iata1: Optional[str], iata2: Optional[str]) -> int:
    import math
    c1 = _LATLON.get(iata1 or "")
    c2 = _LATLON.get(iata2 or "")
    if not c1 or not c2:
        return _FALLBACK_DISTANCE_KM
    R = 6371
    lat1, lon1 = map(math.radians, c1)
    lat2, lon2 = map(math.radians, c2)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _get_distance_km(dep_iata: str, arr_iata: str, db=None) -> int:
    """DB-backed distance via Airport lat/lon, falling back to Haversine table."""
    if db and dep_iata and arr_iata:
        try:
            from app.models.models import Airport
            import math
            orig = db.query(Airport).filter(Airport.iata_code == dep_iata.upper()).first()
            dest = db.query(Airport).filter(Airport.iata_code == arr_iata.upper()).first()
            if (orig and dest and orig.latitude and orig.longitude
                    and dest.latitude and dest.longitude):
                R = 6371
                lat1, lon1 = math.radians(float(orig.latitude)), math.radians(float(orig.longitude))
                lat2, lon2 = math.radians(float(dest.latitude)), math.radians(float(dest.longitude))
                dlat, dlon = lat2 - lat1, lon2 - lon1
                a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
                return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)))
        except Exception as e:
            logger.debug(f"DB distance lookup failed for {dep_iata}-{arr_iata}: {e}")
    return _haversine_km(dep_iata, arr_iata)


def _get_encodings(airline_iata: str, dep_iata: str, arr_iata: str) -> tuple[int, int, int]:
    """Encode IATA codes using the persistent label encoders from feature_engineering."""
    try:
        from app.ml.feature_engineering import _get_encoders
        enc_airline, enc_dep, enc_arr = _get_encoders()
        # Extend encoders with new values so they persist for future use
        enc_airline.fit_extend([airline_iata] if airline_iata else [])
        enc_dep.fit_extend([dep_iata] if dep_iata else [])
        enc_arr.fit_extend([arr_iata] if arr_iata else [])
        return (
            enc_airline.transform(airline_iata),
            enc_dep.transform(dep_iata),
            enc_arr.transform(arr_iata),
        )
    except Exception as e:
        logger.warning(f"Encoding failed ({airline_iata}, {dep_iata}, {arr_iata}): {e}")
        return 0, 0, 0


# ── Public API ────────────────────────────────────────────────────────────────

def build_features(flight: dict, db=None) -> dict:
    """
    Build the feature dict required by the production V2 model.

    Args:
        flight: Normalized AviationEdge / AEFlightSnapshot dict.
                Expected keys: dep_scheduled, arr_scheduled, dep_iata, arr_iata,
                               airline_iata, dep_estimated, dep_actual.
        db:     Optional SQLAlchemy session (enables DB-backed distance).

    Returns:
        Dict with base features + routing metadata:
            dep_hour, is_weekend, is_peak_hour,
            distance_km, duration_min,
            airline_enc, dep_airport_enc, arr_airport_enc,
            dep_iata, arr_iata, airline_iata   (for rolling lookup in prediction_service)
    """
    dep_ts = _parse_scheduled(
        flight.get("dep_scheduled") or flight.get("dep_estimated")
    )
    arr_ts = _parse_scheduled(
        flight.get("arr_scheduled") or flight.get("arr_estimated")
    )
    ref = dep_ts or datetime.utcnow()

    dep_iata     = (flight.get("dep_iata") or "").upper()
    arr_iata     = (flight.get("arr_iata") or "").upper()
    airline_iata = ((flight.get("airline_iata") or "")[:2]).upper()

    # Time features
    dep_hour   = ref.hour
    dow        = ref.weekday()
    is_weekend = int(dow >= 5)
    # Peak hour: morning rush (07-09) or evening rush (17-20)
    is_peak_hour = int(7 <= dep_hour <= 9 or 17 <= dep_hour <= 20)

    # Distance
    distance_km = _get_distance_km(dep_iata, arr_iata, db)

    # Duration
    duration_min: Optional[int] = None
    if dep_ts and arr_ts:
        diff = (arr_ts - dep_ts).total_seconds() / 60
        if 0 < diff < 1440:
            duration_min = round(diff)
    if duration_min is None:
        duration_min = max(30, round(distance_km / 800 * 60))

    # Categorical encodings
    airline_enc, dep_airport_enc, arr_airport_enc = _get_encodings(
        airline_iata, dep_iata, arr_iata
    )

    return {
        # Base features (match ALL_FEATURES base in train_v2.py)
        "dep_hour":        dep_hour,
        "is_weekend":      is_weekend,
        "is_peak_hour":    is_peak_hour,
        "distance_km":     distance_km,
        "duration_min":    duration_min,
        "airline_enc":     airline_enc,
        "dep_airport_enc": dep_airport_enc,
        "arr_airport_enc": arr_airport_enc,
        # Routing metadata — used by prediction_service to fetch rolling features
        "dep_iata":        dep_iata or None,
        "arr_iata":        arr_iata or None,
        "airline_iata":    airline_iata or None,
    }
