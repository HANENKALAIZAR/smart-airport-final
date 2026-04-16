"""
OpenWeatherMap API Client
==========================
Fetches current weather for Tunisian airport locations and persists to DB.

Free tier: 1,000 calls/day — 8 airports × 48 calls/day = 384 calls/day (within limit).
Docs: https://openweathermap.org/current

Usage (direct):
    asyncio.run(fetch_and_store_weather("TUN", db))
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings

logger = logging.getLogger(__name__)

OWM_BASE = "http://api.openweathermap.org/data/2.5"


# ── OWM condition ID → simple weather code string ────────────────────────

def _owm_code_to_str(owm_id: int) -> str:
    if owm_id < 300:
        return "thunderstorm"
    if owm_id < 400:
        return "drizzle"
    if owm_id < 600:
        return "rain"
    if owm_id < 700:
        return "snow"
    if owm_id < 800:
        return "fog"
    if owm_id == 800:
        return "clear"
    return "clouds"


# ── Main collection function ──────────────────────────────────────────────

async def fetch_and_store_weather(airport_iata: str, db: Session) -> Optional[dict]:
    """
    Fetch current weather from OpenWeatherMap for a given airport and upsert
    into the weather_conditions table.

    Args:
        airport_iata: IATA code (e.g. 'TUN')
        db:           SQLAlchemy session (caller owns commit/close)

    Returns:
        Dict of stored values, or None on failure.
    """
    from app.models.models import Airport
    from sqlalchemy import text

    if not settings.OPENWEATHER_KEY:
        logger.warning("OPENWEATHER_KEY not set — skipping weather collection")
        return None

    # Resolve airport coordinates from DB
    airport = db.query(Airport).filter(Airport.iata_code == airport_iata).first()
    if not airport:
        logger.warning(f"Airport {airport_iata} not found in DB — cannot collect weather")
        return None
    if airport.latitude is None or airport.longitude is None:
        logger.warning(f"Airport {airport_iata} has no coordinates — skipping")
        return None

    lat = float(airport.latitude)
    lon = float(airport.longitude)

    # Fetch from OWM
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{OWM_BASE}/weather", params={
                "lat": lat,
                "lon": lon,
                "appid": settings.OPENWEATHER_KEY,
                "units": "metric",
            })
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error(f"OpenWeatherMap fetch failed for {airport_iata}: {e}")
        return None

    # Parse response fields
    main_d  = data.get("main") or {}
    wind_d  = data.get("wind") or {}
    rain_d  = data.get("rain") or {}
    snow_d  = data.get("snow") or {}
    vis_raw = data.get("visibility")          # metres
    cond    = (data.get("weather") or [{}])[0]

    temp_c        = main_d.get("temp")
    wind_speed_ms = float(wind_d.get("speed") or 0)
    wind_kmh      = round(wind_speed_ms * 3.6, 2)   # m/s → km/h
    wind_dir      = wind_d.get("deg")
    humidity      = main_d.get("humidity")
    pressure      = main_d.get("pressure")
    vis_km        = round(float(vis_raw) / 1000.0, 2) if vis_raw is not None else None
    precip_mm     = float(rain_d.get("1h") or snow_d.get("1h") or 0)
    wx_code       = _owm_code_to_str(int(cond.get("id") or 800))

    # Truncate to the current minute so de-dup works correctly
    recorded_at = datetime.now(timezone.utc).replace(second=0, microsecond=0, tzinfo=None)

    # Upsert — conflict on (airport_id, recorded_at)
    db.execute(text("""
        INSERT INTO weather_conditions
            (airport_id, recorded_at, temperature_c, wind_speed_kmh, wind_direction,
             visibility_km, precipitation_mm, weather_code, humidity_pct, pressure_hpa)
        VALUES
            (:aid, :rat, :temp, :wind, :wdir, :vis, :precip, :code, :hum, :pres)
        ON CONFLICT (airport_id, recorded_at) DO UPDATE SET
            temperature_c    = EXCLUDED.temperature_c,
            wind_speed_kmh   = EXCLUDED.wind_speed_kmh,
            wind_direction   = EXCLUDED.wind_direction,
            visibility_km    = EXCLUDED.visibility_km,
            precipitation_mm = EXCLUDED.precipitation_mm,
            weather_code     = EXCLUDED.weather_code,
            humidity_pct     = EXCLUDED.humidity_pct,
            pressure_hpa     = EXCLUDED.pressure_hpa
    """), {
        "aid":    airport.id,
        "rat":    recorded_at,
        "temp":   temp_c,
        "wind":   wind_kmh,
        "wdir":   wind_dir,
        "vis":    vis_km,
        "precip": precip_mm,
        "code":   wx_code,
        "hum":    humidity,
        "pres":   pressure,
    })
    db.commit()

    payload = {
        "airport_iata":    airport_iata,
        "recorded_at":     recorded_at.isoformat(),
        "temperature_c":   temp_c,
        "wind_speed_kmh":  wind_kmh,
        "visibility_km":   vis_km,
        "precipitation_mm": precip_mm,
        "weather_code":    wx_code,
        "humidity_pct":    humidity,
    }
    logger.info(
        f"Weather stored: {airport_iata} | {wx_code} | {temp_c}°C | "
        f"wind {wind_kmh}km/h | vis {vis_km}km | precip {precip_mm}mm"
    )
    return payload
