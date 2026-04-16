import logging
logger = logging.getLogger(__name__)
"""
OpenSky Router
==============
Exposes real-time aircraft data from the OpenSky Network.
Falls back to realistic mock data if the API is unreachable.
"""

import random, math, time
from fastapi import APIRouter, HTTPException
from app.api_clients.opensky_client import get_latest_states

router = APIRouter(prefix="/api/opensky", tags=["opensky"])

# ── Airport coordinates for Tunisian airports ──────────────────
AIRPORT_COORDS = {
    "TUN": (36.851, 10.227),   # Tunis–Carthage
    "DJE": (33.875, 10.775),   # Djerba–Zarzis
    "NBE": (36.076, 10.439),   # Enfidha–Hammamet
    "MIR": (35.758, 10.755),   # Monastir
}

# ── Fallback mock aircraft generator ──────────────────────────
MOCK_AIRLINES = [
    ("TU", "Tunisair"),
    ("AF", "Air France"),
    ("QR", "Qatar Airways"),
    ("TK", "Turkish Airlines"),
    ("LH", "Lufthansa"),
    ("MS", "EgyptAir"),
    ("AT", "Royal Air Maroc"),
    ("UG", "Tunisair Express"),
    ("TO", "Transavia"),
    ("FR", "Ryanair"),
    ("PC", "Pegasus"),
    ("A3", "Aegean Airlines"),
]

MOCK_COUNTRIES = [
    "Tunisia", "France", "Germany", "Turkey", "Qatar",
    "Egypt", "Morocco", "Italy", "Spain", "United Kingdom",
    "Netherlands", "Greece", "Switzerland", "Belgium",
]


def _generate_mock_aircraft(lat: float, lon: float, radius: float, count: int = 18):
    """Generate realistic-looking mock aircraft near an airport."""
    rng = random.Random(int(time.time()) // 60)  # changes every minute
    aircraft = []
    for i in range(count):
        code, country = rng.choice(MOCK_AIRLINES)
        flight_num = rng.randint(100, 9999)
        callsign = f"{code}{flight_num}"

        # Random position near airport
        dlat = rng.uniform(-radius, radius)
        dlon = rng.uniform(-radius, radius)

        on_ground = rng.random() < 0.15
        alt = 0 if on_ground else rng.randint(300, 12000)
        velocity = 0 if on_ground else rng.uniform(60, 280)
        heading = rng.uniform(0, 360)
        vr = 0 if on_ground else rng.uniform(-8, 8)

        aircraft.append({
            "icao24": f"{rng.randint(0x400000, 0xFFFFFF):06x}",
            "callsign": callsign,
            "origin_country": rng.choice(MOCK_COUNTRIES),
            "lat": round(lat + dlat, 4),
            "lon": round(lon + dlon, 4),
            "alt": alt,
            "on_ground": on_ground,
            "velocity": round(velocity, 1),
            "heading": round(heading, 1),
            "vertical_rate": round(vr, 1),
            "last_contact": int(time.time()) - rng.randint(0, 30),
        })
    return aircraft


def _generate_mock_states(lat_min, lat_max, lon_min, lon_max, count=25):
    """Generate mock state vectors for the Mediterranean region."""
    rng = random.Random(int(time.time()) // 60)
    aircraft = []
    for i in range(count):
        code, _ = rng.choice(MOCK_AIRLINES)
        flight_num = rng.randint(100, 9999)

        lat = rng.uniform(lat_min, lat_max)
        lon = rng.uniform(lon_min, lon_max)
        on_ground = rng.random() < 0.05
        alt = 0 if on_ground else rng.randint(2000, 12000)
        velocity = 0 if on_ground else rng.uniform(150, 280)

        aircraft.append({
            "icao24": f"{rng.randint(0x400000, 0xFFFFFF):06x}",
            "callsign": f"{code}{flight_num}",
            "origin_country": rng.choice(MOCK_COUNTRIES),
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "alt": alt,
            "on_ground": on_ground,
            "velocity": round(velocity, 1),
            "heading": round(rng.uniform(0, 360), 1),
            "vertical_rate": round(rng.uniform(-3, 3), 1),
            "last_contact": int(time.time()) - rng.randint(0, 20),
        })
    return aircraft


@router.get("/states")
async def opensky_states(
    lat_min: float = 25.0,
    lat_max: float = 45.0,
    lon_min: float = -5.0,
    lon_max: float = 35.0,
):
    """
    Return live aircraft state vectors inside a bounding box.
    Falls back to mock data if OpenSky is unreachable.
    """
    try:
        data = await get_latest_states(bbox=(lat_min, lat_max, lon_min, lon_max))
        return data
    except Exception as e:
        logger.warning(f"OpenSky API unreachable, using mock data: {e}")
        return _generate_mock_states(lat_min, lat_max, lon_min, lon_max)


@router.get("/airport-flights/{iata}")
async def airport_flights(iata: str, radius: float = 1.5):
    """
    Return aircraft near a Tunisian airport (arrivals + departures).
    Falls back to mock data if OpenSky is unreachable.
    """
    iata = iata.upper()
    coords = AIRPORT_COORDS.get(iata)
    if not coords:
        raise HTTPException(status_code=404, detail=f"Airport '{iata}' not found")

    lat, lon = coords
    bbox = (lat - radius, lat + radius, lon - radius, lon + radius)

    try:
        data = await get_latest_states(bbox=bbox)
    except Exception as e:
        logger.warning(f"OpenSky API unreachable for {iata}, using mock data: {e}")
        data = _generate_mock_aircraft(lat, lon, radius)

    # Enrich each aircraft with direction relative to airport
    for ac in data:
        if ac.get("on_ground"):
            ac["direction"] = "ground"
        elif ac.get("vertical_rate") is not None:
            if ac["vertical_rate"] < -1:
                ac["direction"] = "arriving"
            elif ac["vertical_rate"] > 1:
                ac["direction"] = "departing"
            else:
                ac["direction"] = "overflying"
        else:
            ac["direction"] = "overflying"

    return {"airport": iata, "aircraft": data, "count": len(data)}
