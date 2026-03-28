"""
Live Feature Builder
=====================
Computes ML feature vectors directly from raw AviationStack flight dicts.
This bridges real-time flight data → prediction model without needing DB records.
"""

from datetime import datetime
from typing import Optional


# ── Airline reliability scores (0 = unreliable, 1 = perfect) ──────────────
AIRLINE_RELIABILITY: dict[str, float] = {
    "TU": 0.82,   # Tunisair
    "AF": 0.91,   # Air France
    "LH": 0.93,   # Lufthansa
    "TK": 0.89,   # Turkish Airlines
    "BA": 0.90,   # British Airways
    "U2": 0.84,   # easyJet
    "FR": 0.82,   # Ryanair
    "QR": 0.94,   # Qatar Airways
    "EK": 0.93,   # Emirates
    "MS": 0.87,   # Egyptair
    "AT": 0.86,   # Royal Air Maroc
    "AH": 0.83,   # Air Algérie
    "IB": 0.88,   # Iberia
    "VY": 0.83,   # Vueling
    "UX": 0.86,   # Air Europa
}

# ── Approximate route distances (km) between major Tunisian airports ──────
ROUTE_DISTANCES: dict[tuple[str, str], int] = {
    ("TUN", "CDG"): 1755,
    ("TUN", "FCO"): 1091,
    ("TUN", "FRA"): 1857,
    ("TUN", "LHR"): 2093,
    ("TUN", "IST"): 1890,
    ("TUN", "DXB"): 4020,
    ("TUN", "DOH"): 3980,
    ("TUN", "CAI"): 1856,
    ("TUN", "CMN"): 1556,
    ("DJE", "CDG"): 1788,
    ("DJE", "LYS"): 1548,
    ("NBE", "CDG"): 1668,
    ("MIR", "CDG"): 1690,
}

# ── Airport congestion by hour (0-23) — 0=quiet, 1=max ───────────────────
HOURLY_CONGESTION: dict[int, float] = {
    0: 0.05, 1: 0.02, 2: 0.01, 3: 0.01, 4: 0.05, 5: 0.15,
    6: 0.50, 7: 0.80, 8: 0.90, 9: 0.70, 10: 0.55, 11: 0.60,
    12: 0.65, 13: 0.70, 14: 0.75, 15: 0.80, 16: 0.85, 17: 0.90,
    18: 0.95, 19: 0.85, 20: 0.70, 21: 0.50, 22: 0.30, 23: 0.15,
}

# ── Historical delay rates by airline IATA ────────────────────────────────
AIRLINE_DELAY_RATES: dict[str, float] = {
    "TU": 0.25, "AF": 0.18, "LH": 0.15, "TK": 0.20,
    "BA": 0.17, "U2": 0.22, "FR": 0.22, "QR": 0.10,
    "EK": 0.11, "MS": 0.28, "AT": 0.25, "AH": 0.30,
    "IB": 0.19, "VY": 0.21, "UX": 0.22,
}


def _parse_scheduled(ts: Optional[str]) -> Optional[datetime]:
    """Parse ISO datetime string from AviationStack."""
    if not ts:
        return None
    try:
        # handles "2024-03-01T08:30:00+00:00" and "2024-03-01T08:30:00.000Z"
        ts = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(ts)
    except Exception:
        return None


def _weather_from_delay(delay_minutes: int) -> float:
    """
    Estimate weather severity from delay.
    Real implementation could call a weather API here.
    """
    if delay_minutes <= 0:
        return 0.05
    if delay_minutes <= 15:
        return 0.20
    if delay_minutes <= 30:
        return 0.45
    if delay_minutes <= 60:
        return 0.65
    return 0.85


def build_features(flight: dict) -> dict:
    """
    Build a feature dict compatible with the XGBoost model from a
    raw normalized AviationStack flight dict (output of normalize_flight).

    Args:
        flight: Normalized flight dict from aviationstack_client.normalize_flight()

    Returns:
        Feature dict with keys matching FEATURE_COLUMNS in prediction_service.py
    """
    # ── Time features ──────────────────────────────────────────
    dep_ts = _parse_scheduled(flight.get("dep_scheduled") or flight.get("dep_estimated"))
    now = datetime.utcnow()
    ref = dep_ts or now

    hour = ref.hour
    dow = ref.weekday()   # 0=Monday, 6=Sunday
    month = ref.month
    is_weekend = int(dow >= 5)

    # ── Congestion ─────────────────────────────────────────────
    base_congestion = HOURLY_CONGESTION.get(hour, 0.50)
    # Adjust slightly by day of week (weekends are slightly quieter)
    congestion = base_congestion * (0.90 if is_weekend else 1.0)
    origin_congestion = congestion
    dest_congestion = base_congestion * 0.85  # destination slightly less known

    # ── Airline ────────────────────────────────────────────────
    airline_iata = flight.get("airline_iata", "")[:2].upper()
    reliability = AIRLINE_RELIABILITY.get(airline_iata, 0.85)
    hist_delay_rate = AIRLINE_DELAY_RATES.get(airline_iata, 0.22)

    # ── Weather ────────────────────────────────────────────────
    delay_min = int(flight.get("delay_minutes") or flight.get("dep_delay") or 0)
    weather_sev = _weather_from_delay(delay_min)
    origin_weather = weather_sev * 0.8
    dest_weather = weather_sev * 1.1  # destination often worse for incoming storms

    # ── Distance ───────────────────────────────────────────────
    dep_iata = (flight.get("dep_iata") or "").upper()
    arr_iata = (flight.get("arr_iata") or "").upper()
    distance = (
        ROUTE_DISTANCES.get((dep_iata, arr_iata))
        or ROUTE_DISTANCES.get((arr_iata, dep_iata))
        or 1500  # default medium-haul estimate
    )

    return {
        "weather_severity":         round(min(weather_sev, 1.0), 3),
        "origin_weather_severity":  round(min(origin_weather, 1.0), 3),
        "dest_weather_severity":    round(min(dest_weather, 1.0), 3),
        "hour_of_day":              hour,
        "day_of_week":              dow,
        "month":                    month,
        "is_weekend":               is_weekend,
        "congestion_level":         round(congestion, 3),
        "origin_congestion":        round(origin_congestion, 3),
        "dest_congestion":          round(dest_congestion, 3),
        "airline_reliability":      round(reliability, 2),
        "distance_km":              distance,
        "historical_delay_rate":    round(hist_delay_rate, 3),
    }
