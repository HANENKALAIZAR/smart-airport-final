"""
Feature Pipeline
=================
Computes ML-ready features from real flights + weather_conditions data
and upserts into flight_features.

All hardcoded lookup tables (AIRLINE_RELIABILITY, HOURLY_CONGESTION,
ROUTE_DISTANCES, AIRLINE_DELAY_RATES) from the old live_feature_builder
are replaced by rolling DB queries. The cold-start defaults are used only
when insufficient data exists (< MIN_SAMPLE_FOR_STATS flights).

Usage:
    from app.services.feature_pipeline import run_feature_pipeline
    stats = run_feature_pipeline(db)
"""

import logging
import math
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

logger = logging.getLogger(__name__)

try:
    from hijri_converter import Hijri
except Exception:  # pragma: no cover - dependency may be installed later
    Hijri = None

# Constants

FEATURE_VERSION = "v12"      # bump whenever feature logic changes
DELAY_THRESHOLD_MIN = 15     # flights delayed > 15 min are labelled is_delayed=1
ROLLING_DAYS = 90            # window for reliability / delay-rate stats
MIN_SAMPLE_FOR_STATS = 10    # min flights before using DB stats vs defaults
DEFAULT_RELIABILITY = 0.80
DEFAULT_DELAY_RATE = 0.22
DEFAULT_VISIBILITY_KM = 10.0  # clear sky assumption

# Busy travel periods used by the ML pipeline.
# These windows intentionally target higher passenger demand rather than civic
# holidays. Static school/season periods can be extended per year, while the
# major Islamic holidays are resolved dynamically from the Hijri calendar.
_BUSY_PERIOD_BUFFER_DAYS = 1

_SCHOOL_HOLIDAYS: dict[int, list[tuple[str, str]]] = {
    2024: [
        ("2024-01-01", "2024-01-07"),
        ("2024-03-18", "2024-03-24"),
        ("2024-06-15", "2024-09-15"),
        ("2024-12-16", "2024-12-31"),
    ],
    2025: [
        ("2025-01-01", "2025-01-05"),
        ("2025-03-17", "2025-03-23"),
        ("2025-06-15", "2025-09-15"),
        ("2025-12-15", "2025-12-31"),
    ],
    2026: [
        ("2026-01-01", "2026-01-04"),
        ("2026-03-16", "2026-03-22"),
        ("2026-06-15", "2026-09-15"),
        ("2026-12-14", "2026-12-31"),
    ],
    2027: [
        ("2027-01-01", "2027-01-03"),
        ("2027-03-15", "2027-03-21"),
        ("2027-06-15", "2027-09-15"),
        ("2027-12-13", "2027-12-31"),
    ],
}

_PEAK_SEASONS: dict[int, list[tuple[str, str]]] = {
    2024: [
        ("2024-06-01", "2024-09-15"),
        ("2024-12-31", "2025-01-01"),
    ],
    2025: [
        ("2025-06-01", "2025-09-15"),
        ("2025-12-31", "2026-01-01"),
    ],
    2026: [
        ("2026-06-01", "2026-09-15"),
        ("2026-12-31", "2027-01-01"),
    ],
    2027: [
        ("2027-06-01", "2027-09-15"),
        ("2027-12-31", "2028-01-01"),
    ],
}

_EID_LENGTHS = {
    (10, 1): 4,   # Eid al-Fitr
    (12, 10): 5,  # Eid al-Adha
}


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _with_buffer(
    start: date,
    end: date,
    buffer_days: int = _BUSY_PERIOD_BUFFER_DAYS,
) -> tuple[date, date]:
    return start - timedelta(days=buffer_days), end + timedelta(days=buffer_days)


def _gregorian_from_hijri(h_year: int, h_month: int, h_day: int) -> Optional[date]:
    if Hijri is None:
        return None

    converted = Hijri(h_year, h_month, h_day).to_gregorian()
    return date(converted.year, converted.month, converted.day)


def _dynamic_islamic_periods(gregorian_year: int) -> list[tuple[date, date]]:
    periods: list[tuple[date, date]] = []

    for hijri_year in range(gregorian_year - 581, gregorian_year - 578):
        for (h_month, h_day), span_days in _EID_LENGTHS.items():
            start = _gregorian_from_hijri(hijri_year, h_month, h_day)
            if start is None:
                continue

            end = start + timedelta(days=span_days - 1)
            if start.year == gregorian_year or end.year == gregorian_year:
                periods.append(_with_buffer(start, end))

    return periods


def _static_busy_periods(gregorian_year: int) -> list[tuple[date, date]]:
    periods: list[tuple[date, date]] = []

    for start_str, end_str in _SCHOOL_HOLIDAYS.get(gregorian_year, []):
        periods.append(_with_buffer(_parse_date(start_str), _parse_date(end_str)))

    for start_str, end_str in _PEAK_SEASONS.get(gregorian_year, []):
        periods.append(_with_buffer(_parse_date(start_str), _parse_date(end_str)))

    return periods


def _is_holiday(dt: datetime) -> int:
    target = dt.date()
    candidate_years = {target.year - 1, target.year, target.year + 1}
    periods: list[tuple[date, date]] = []

    for year in candidate_years:
        periods.extend(_static_busy_periods(year))
        periods.extend(_dynamic_islamic_periods(year))

    return int(any(start <= target <= end for start, end in periods))


# Haversine distance

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return int(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


# Weather severity formula

def compute_weather_severity(
    wind_kmh: Optional[float],
    vis_km: Optional[float],
    precip_mm: Optional[float],
) -> float:
    """
    Returns weather severity in [0, 1].
    Formula: precip*0.4 + (1 - min(vis,10)/10)*0.3 + min(wind,100)/100*0.3
    """
    vis = float(vis_km) if vis_km is not None else DEFAULT_VISIBILITY_KM
    wind = float(wind_kmh) if wind_kmh is not None else 0.0
    precip = float(precip_mm) if precip_mm is not None else 0.0

    p_score = min(precip / 10.0, 1.0)
    v_score = 1.0 - min(vis, 10.0) / 10.0
    w_score = min(wind, 100.0) / 100.0

    sev = p_score * 0.4 + v_score * 0.3 + w_score * 0.3
    return round(min(max(sev, 0.0), 1.0), 4)


# DB helpers

def _latest_weather(db: Session, airport_id: int, before: datetime):
    """Get the most recent weather record at or before `before`."""
    from app.models.models import WeatherCondition

    return (
        db.query(WeatherCondition)
        .filter(
            WeatherCondition.airport_id == airport_id,
            WeatherCondition.recorded_at <= before,
        )
        .order_by(WeatherCondition.recorded_at.desc())
        .first()
    )


def _congestion(db: Session, airport_id: int, ref_time: datetime) -> float:
    """
    Count departing flights within +/-2h of ref_time at airport, normalized by 20
    (typical peak for Tunisian airports -> >=20 flights = congestion = 1.0).
    """
    from app.models.models import Flight

    w_start = ref_time - timedelta(hours=2)
    w_end = ref_time + timedelta(hours=2)
    count = (
        db.query(func.count(Flight.id))
        .filter(
            Flight.origin_airport_id == airport_id,
            Flight.scheduled_departure.between(w_start, w_end),
        )
        .scalar() or 0
    )
    return round(min(count / 20.0, 1.0), 4)


def _airline_reliability(db: Session, airline_id: int, cutoff: datetime) -> float:
    from app.models.models import Flight

    window_start = cutoff - timedelta(days=ROLLING_DAYS)
    total = (
        db.query(func.count(Flight.id))
        .filter(
            Flight.airline_id == airline_id,
            Flight.scheduled_departure.between(window_start, cutoff),
        )
        .scalar() or 0
    )
    if total < MIN_SAMPLE_FOR_STATS:
        return DEFAULT_RELIABILITY
    delayed = (
        db.query(func.count(Flight.id))
        .filter(
            Flight.airline_id == airline_id,
            Flight.scheduled_departure.between(window_start, cutoff),
            Flight.delay_minutes > DELAY_THRESHOLD_MIN,
        )
        .scalar() or 0
    )
    return round(1.0 - (delayed / total), 4)


def _route_delay_rate(db: Session, origin_id: int, dest_id: int, cutoff: datetime) -> float:
    from app.models.models import Flight

    window_start = cutoff - timedelta(days=ROLLING_DAYS)
    total = (
        db.query(func.count(Flight.id))
        .filter(
            Flight.origin_airport_id == origin_id,
            Flight.dest_airport_id == dest_id,
            Flight.scheduled_departure.between(window_start, cutoff),
        )
        .scalar() or 0
    )
    if total < MIN_SAMPLE_FOR_STATS:
        return DEFAULT_DELAY_RATE
    delayed = (
        db.query(func.count(Flight.id))
        .filter(
            Flight.origin_airport_id == origin_id,
            Flight.dest_airport_id == dest_id,
            Flight.scheduled_departure.between(window_start, cutoff),
            Flight.delay_minutes > DELAY_THRESHOLD_MIN,
        )
        .scalar() or 0
    )
    return round(delayed / total, 4)


# Core feature builder

def build_features_for_flight(db: Session, flight) -> Optional[dict]:
    """
    Build a complete feature dict for a single Flight ORM object.
    Returns None if the flight has no scheduled_departure.
    """
    dep_time = flight.scheduled_departure
    if dep_time is None:
        return None
    # Normalise timezone
    if hasattr(dep_time, "tzinfo") and dep_time.tzinfo is not None:
        dep_time = dep_time.replace(tzinfo=None)

    # Time
    hour = dep_time.hour
    dow = dep_time.weekday()   # 0=Mon
    month = dep_time.month
    is_weekend = int(dow >= 5)
    is_holiday = _is_holiday(dep_time)

    # Weather: origin
    orig_wx = _latest_weather(db, flight.origin_airport_id, dep_time)
    if orig_wx:
        o_wind = float(orig_wx.wind_speed_kmh) if orig_wx.wind_speed_kmh is not None else None
        o_vis = float(orig_wx.visibility_km) if orig_wx.visibility_km is not None else None
        o_prec = (
            float(orig_wx.precipitation_mm)
            if orig_wx.precipitation_mm is not None else None
        )
        o_temp = float(orig_wx.temperature_c) if orig_wx.temperature_c is not None else None
    else:
        o_wind = o_vis = o_prec = o_temp = None
    origin_sev = compute_weather_severity(o_wind, o_vis, o_prec)

    # Weather: destination
    dest_wx = _latest_weather(db, flight.dest_airport_id, dep_time)
    if dest_wx:
        d_wind = float(dest_wx.wind_speed_kmh) if dest_wx.wind_speed_kmh is not None else None
        d_vis = float(dest_wx.visibility_km) if dest_wx.visibility_km is not None else None
        d_prec = (
            float(dest_wx.precipitation_mm)
            if dest_wx.precipitation_mm is not None else None
        )
    else:
        d_wind = d_vis = d_prec = None
    dest_sev = compute_weather_severity(d_wind, d_vis, d_prec)
    weather_avg = round((origin_sev + dest_sev) / 2.0, 4)

    # Congestion
    origin_cong = _congestion(db, flight.origin_airport_id, dep_time)
    dest_cong = _congestion(db, flight.dest_airport_id, dep_time)
    cong_avg = round((origin_cong + dest_cong) / 2.0, 4)

    # Airline reliability
    reliability = _airline_reliability(db, flight.airline_id, dep_time)

    # Distance
    orig_ap = flight.origin_airport
    dest_ap = flight.dest_airport
    if (
        orig_ap and dest_ap
        and orig_ap.latitude is not None and orig_ap.longitude is not None
        and dest_ap.latitude is not None and dest_ap.longitude is not None
    ):
        distance_km = _haversine_km(
            float(orig_ap.latitude), float(orig_ap.longitude),
            float(dest_ap.latitude), float(dest_ap.longitude),
        )
    else:
        distance_km = int(flight.distance_km or 1500)

    # Historical delay rate
    hist_rate = _route_delay_rate(
        db, flight.origin_airport_id, flight.dest_airport_id, dep_time
    )

    # Labels
    delay_min = int(flight.delay_minutes or 0)
    is_delayed = int(delay_min > DELAY_THRESHOLD_MIN)

    # Reliability Scoring (v11)
    # Ordered after delay_min is defined but uses flight-level raw checks
    score = 1.0
    if flight.actual_departure is None:
        score -= 0.3
    if flight.actual_arrival is None:
        score -= 0.2
    if flight.status == "scheduled":
        score -= 0.2
    if flight.delay_minutes is None:
        score -= 0.2
    if flight.aircraft_type is None:
        score -= 0.1

    score = round(max(0.0, min(1.0, float(score))), 2)
    usable = score >= 0.6

    # Lightweight debug logging for every 10th flight
    if hash(str(flight.id)) % 10 == 0:
        logger.info(
            f"[SCORING] Flight {flight.flight_number} (id:{flight.id}) -> "
            f"score: {score} (usable: {usable})"
        )

    return {
        # Time
        "hour_of_day": hour,
        "day_of_week": dow,
        "month": month,
        "is_weekend": is_weekend,
        "is_holiday": is_holiday,
        # Weather aggregates
        "weather_severity": weather_avg,
        "origin_weather_severity": origin_sev,
        "dest_weather_severity": dest_sev,
        # Raw weather (origin) - stored for model retraining transparency
        "temperature_c": o_temp,
        "wind_speed_kmh": o_wind,
        "visibility_km": o_vis,
        "precipitation_mm": o_prec,
        # Congestion
        "congestion_level": cong_avg,
        "origin_congestion": origin_cong,
        "dest_congestion": dest_cong,
        # Airline
        "airline_reliability": reliability,
        # Route
        "distance_km": distance_km,
        "historical_delay_rate": hist_rate,
        # Labels
        "is_delayed": is_delayed,
        "delay_minutes": delay_min,
        # Scoring
        "confidence_score": score,
        "usable_for_ml": usable,
        # Meta
        "feature_version": FEATURE_VERSION,
    }


# Pipeline runner

def run_feature_pipeline(db: Session, batch_size: int = 500) -> dict:
    """
    Process all flights whose feature_version != FEATURE_VERSION and upsert
    their features into flight_features.

    Args:
        db:         SQLAlchemy session
        batch_size: Max flights to process per run

    Returns:
        Stats dict: {"processed", "skipped", "errors"}
    """
    from app.models.models import Flight, FlightFeature

    logger.info(f"Feature pipeline starting (batch={batch_size}, version={FEATURE_VERSION})")

    # Find flights that don't have up-to-date features
    up_to_date_ids = (
        db.query(FlightFeature.flight_id)
        .filter(FlightFeature.feature_version == FEATURE_VERSION)
        .subquery()
    )

    flights = (
        db.query(Flight)
        .options(
            joinedload(Flight.origin_airport),
            joinedload(Flight.dest_airport),
            joinedload(Flight.airline),
        )
        .filter(Flight.id.notin_(up_to_date_ids.select()))
        .filter(Flight.scheduled_departure.isnot(None))
        .limit(batch_size)
        .all()
    )

    processed = skipped = errors = 0

    for flight in flights:
        try:
            feat = build_features_for_flight(db, flight)
            if feat is None:
                skipped += 1
                continue

            existing = (
                db.query(FlightFeature)
                .filter(FlightFeature.flight_id == flight.id)
                .first()
            )

            if existing:
                # Update all feature fields
                existing.weather_severity = feat["weather_severity"]
                existing.origin_weather_severity = feat["origin_weather_severity"]
                existing.dest_weather_severity = feat["dest_weather_severity"]
                existing.hour_of_day = feat["hour_of_day"]
                existing.day_of_week = feat["day_of_week"]
                existing.month = feat["month"]
                existing.is_weekend = feat["is_weekend"]
                existing.is_holiday = feat["is_holiday"]
                existing.congestion_level = feat["congestion_level"]
                existing.origin_congestion = feat["origin_congestion"]
                existing.dest_congestion = feat["dest_congestion"]
                existing.airline_reliability = feat["airline_reliability"]
                existing.distance_km = feat["distance_km"]
                existing.historical_delay_rate = feat["historical_delay_rate"]
                existing.is_delayed = feat["is_delayed"]
                existing.delay_minutes = feat["delay_minutes"]
                existing.confidence_score = feat["confidence_score"]
                existing.usable_for_ml = feat["usable_for_ml"]
                existing.temperature_c = feat["temperature_c"]
                existing.wind_speed_kmh = feat["wind_speed_kmh"]
                existing.visibility_km = feat["visibility_km"]
                existing.precipitation_mm = feat["precipitation_mm"]
                existing.feature_version = feat["feature_version"]
            else:
                db.add(FlightFeature(
                    flight_id=flight.id,
                    weather_severity=feat["weather_severity"],
                    origin_weather_severity=feat["origin_weather_severity"],
                    dest_weather_severity=feat["dest_weather_severity"],
                    hour_of_day=feat["hour_of_day"],
                    day_of_week=feat["day_of_week"],
                    month=feat["month"],
                    is_weekend=feat["is_weekend"],
                    is_holiday=feat["is_holiday"],
                    congestion_level=feat["congestion_level"],
                    origin_congestion=feat["origin_congestion"],
                    dest_congestion=feat["dest_congestion"],
                    airline_reliability=feat["airline_reliability"],
                    distance_km=feat["distance_km"],
                    historical_delay_rate=feat["historical_delay_rate"],
                    is_delayed=feat["is_delayed"],
                    delay_minutes=feat["delay_minutes"],
                    confidence_score=feat["confidence_score"],
                    usable_for_ml=feat["usable_for_ml"],
                    temperature_c=feat["temperature_c"],
                    wind_speed_kmh=feat["wind_speed_kmh"],
                    visibility_km=feat["visibility_km"],
                    precipitation_mm=feat["precipitation_mm"],
                    feature_version=feat["feature_version"],
                ))

            processed += 1

        except Exception as e:
            logger.error(f"Feature pipeline error for flight {flight.id}: {e}")
            db.rollback()
            errors += 1
            continue

    db.commit()
    logger.info(
        f"Feature pipeline done: processed={processed} skipped={skipped} errors={errors}"
    )
    return {"processed": processed, "skipped": skipped, "errors": errors}
