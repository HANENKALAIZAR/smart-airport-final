"""
Live Feature Builder (v10)
===========================
Computes ML feature vectors from raw AviationStack flight dicts for
real-time predictions via GET /api/aviationstack/predict/{flight_number}.

v10 changes:
  - _weather_from_delay() REMOVED — was circular (estimated weather from delay).
  - Weather is now fetched from the weather_conditions DB table for the
    origin airport. Falls back to a zero-severity estimate if no DB record
    exists within the past 2 hours.
  - Hardcoded AIRLINE_RELIABILITY, AIRLINE_DELAY_RATES, ROUTE_DISTANCES,
    HOURLY_CONGESTION dicts removed. DB-computed values are used instead
    (same functions as feature_pipeline.py). Cold-start defaults apply
    when insufficient data exists.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


# ── Cold-start defaults (used only when DB has insufficient history) ───────

_DEFAULT_RELIABILITY  = 0.80
_DEFAULT_DELAY_RATE   = 0.22


def _parse_scheduled(ts: Optional[str]) -> Optional[datetime]:
    """Parse ISO datetime string from AviationStack."""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def _db_weather_severity(dep_iata: str, ref_time: datetime, db=None) -> float:
    """
    Look up the most recent weather_conditions record for the given airport
    within the past 2 hours and compute severity from real measurements.
    Returns 0.0 if no DB session or no recent record.
    """
    if db is None or not dep_iata:
        return 0.0
    try:
        from app.models.models import Airport, WeatherCondition
        from app.services.feature_pipeline import compute_weather_severity

        airport = db.query(Airport).filter(Airport.iata_code == dep_iata.upper()).first()
        if not airport:
            return 0.0

        threshold = ref_time - timedelta(hours=2)
        wx = (
            db.query(WeatherCondition)
            .filter(
                WeatherCondition.airport_id == airport.id,
                WeatherCondition.recorded_at >= threshold,
                WeatherCondition.recorded_at <= ref_time,
            )
            .order_by(WeatherCondition.recorded_at.desc())
            .first()
        )
        if not wx:
            return 0.0

        return compute_weather_severity(
            float(wx.wind_speed_kmh)   if wx.wind_speed_kmh   is not None else None,
            float(wx.visibility_km)    if wx.visibility_km    is not None else None,
            float(wx.precipitation_mm) if wx.precipitation_mm is not None else None,
        )
    except Exception as e:
        logger.warning(f"DB weather lookup failed for {dep_iata}: {e}")
        return 0.0


def _db_airline_reliability(airline_iata: str, ref_time: datetime, db=None) -> float:
    if db is None or not airline_iata:
        return _DEFAULT_RELIABILITY
    try:
        from app.models.models import Airline
        from app.services.feature_pipeline import _airline_reliability
        airline = db.query(Airline).filter(Airline.iata_code == airline_iata.upper()).first()
        if not airline:
            return _DEFAULT_RELIABILITY
        return _airline_reliability(db, airline.id, ref_time)
    except Exception as e:
        logger.warning(f"DB reliability lookup failed for {airline_iata}: {e}")
        return _DEFAULT_RELIABILITY


def _db_congestion(airport_iata: str, ref_time: datetime, db=None) -> float:
    if db is None or not airport_iata:
        return 0.5
    try:
        from app.models.models import Airport
        from app.services.feature_pipeline import _congestion
        airport = db.query(Airport).filter(Airport.iata_code == airport_iata.upper()).first()
        if not airport:
            return 0.5
        return _congestion(db, airport.id, ref_time)
    except Exception as e:
        logger.warning(f"DB congestion lookup failed for {airport_iata}: {e}")
        return 0.5


def _db_route_delay_rate(dep_iata: str, arr_iata: str, ref_time: datetime, db=None) -> float:
    if db is None or not dep_iata or not arr_iata:
        return _DEFAULT_DELAY_RATE
    try:
        from app.models.models import Airport
        from app.services.feature_pipeline import _route_delay_rate
        orig = db.query(Airport).filter(Airport.iata_code == dep_iata.upper()).first()
        dest = db.query(Airport).filter(Airport.iata_code == arr_iata.upper()).first()
        if not orig or not dest:
            return _DEFAULT_DELAY_RATE
        return _route_delay_rate(db, orig.id, dest.id, ref_time)
    except Exception as e:
        logger.warning(f"DB route delay rate lookup failed {dep_iata}-{arr_iata}: {e}")
        return _DEFAULT_DELAY_RATE


def _db_distance_km(dep_iata: str, arr_iata: str, db=None) -> int:
    if db is None or not dep_iata or not arr_iata:
        return 1500
    try:
        from app.models.models import Airport
        from app.services.feature_pipeline import _haversine_km
        orig = db.query(Airport).filter(Airport.iata_code == dep_iata.upper()).first()
        dest = db.query(Airport).filter(Airport.iata_code == arr_iata.upper()).first()
        if not orig or not dest:
            return 1500
        if (orig.latitude is None or orig.longitude is None
                or dest.latitude is None or dest.longitude is None):
            return 1500
        return _haversine_km(
            float(orig.latitude), float(orig.longitude),
            float(dest.latitude), float(dest.longitude),
        )
    except Exception:
        return 1500


# ── Public API ────────────────────────────────────────────────────────────

def build_features(flight: dict, db=None) -> dict:
    """
    Build a feature dict from a normalized AviationStack flight dict.

    Args:
        flight: Normalized dict from aviationstack_client.normalize_flight()
        db:     Optional SQLAlchemy session. If provided, real DB values are
                used for weather/reliability/congestion/distance. If None,
                cold-start defaults are used.

    Returns:
        Feature dict matching FEATURE_COLUMNS in prediction_service.py
    """
    dep_ts = _parse_scheduled(flight.get("dep_scheduled") or flight.get("dep_estimated"))
    ref    = dep_ts or datetime.utcnow()

    dep_iata     = (flight.get("dep_iata") or "").upper()
    arr_iata     = (flight.get("arr_iata") or "").upper()
    airline_iata = (flight.get("airline_iata") or "")[:2].upper()

    # Time features
    hour       = ref.hour
    dow        = ref.weekday()
    month      = ref.month
    is_weekend = int(dow >= 5)

    # Holiday check
    from app.services.feature_pipeline import _is_holiday
    is_holiday = _is_holiday(ref)

    # Weather — from DB (real) or zero (cold start)
    origin_sev = _db_weather_severity(dep_iata, ref, db)
    dest_sev   = _db_weather_severity(arr_iata,  ref, db)
    weather_avg = round((origin_sev + dest_sev) / 2.0, 4)

    # Congestion — from DB or 0.5 default
    origin_cong = _db_congestion(dep_iata, ref, db)
    dest_cong   = _db_congestion(arr_iata,  ref, db)
    cong_avg    = round((origin_cong + dest_cong) / 2.0, 4)

    # Airline reliability — from DB or 0.80
    reliability = _db_airline_reliability(airline_iata, ref, db)

    # Distance — haversine from DB or hardcoded default
    distance_km = _db_distance_km(dep_iata, arr_iata, db)

    # Historical delay rate — from DB or 0.22
    hist_rate = _db_route_delay_rate(dep_iata, arr_iata, ref, db)

    return {
        "weather_severity":           round(weather_avg, 3),
        "origin_weather_severity":    round(origin_sev, 3),
        "dest_weather_severity":      round(dest_sev, 3),
        "temperature_c":              None,   # not available in live flight dict
        "wind_speed_kmh":             None,
        "visibility_km":              None,
        "precipitation_mm":           None,
        "hour_of_day":                hour,
        "day_of_week":                dow,
        "month":                      month,
        "is_weekend":                 is_weekend,
        "is_holiday":                 is_holiday,
        "congestion_level":           round(cong_avg, 3),
        "origin_congestion":          round(origin_cong, 3),
        "dest_congestion":            round(dest_cong, 3),
        "airline_reliability":        round(reliability, 2),
        "distance_km":                distance_km,
        "historical_delay_rate":      round(hist_rate, 3),
    }
