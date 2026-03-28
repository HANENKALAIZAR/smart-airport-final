"""
OpenSky Network API Client
===========================
Fetches real-time aircraft state vectors from the OpenSky REST API.
Free tier: no authentication required, ~10 sec polling interval.
Docs: https://openskynetwork.github.io/opensky-api/rest.html
"""

import httpx
from typing import Optional

OPENSKY_BASE = "https://opensky-network.org/api"


async def get_latest_states(
    bbox: Optional[tuple[float, float, float, float]] = None,
):
    """
    Fetch current aircraft state vectors.

    Args:
        bbox: Optional (lat_min, lat_max, lon_min, lon_max) bounding box.
              Default covers all of Tunisia roughly.

    Returns:
        List of dicts with keys: icao24, callsign, origin_country,
        lat, lon, alt, velocity, heading, on_ground, last_contact.
    """
    if bbox is None:
        # Wider bounding box: Mediterranean + North Africa + S. Europe
        # Catches far more aircraft, especially at night
        bbox = (25.0, 45.0, -5.0, 35.0)

    lat_min, lat_max, lon_min, lon_max = bbox

    params = {
        "lamin": lat_min,
        "lamax": lat_max,
        "lomin": lon_min,
        "lomax": lon_max,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{OPENSKY_BASE}/states/all", params=params)
        resp.raise_for_status()
        data = resp.json()

    states = data.get("states") or []

    result = []
    for s in states:
        result.append({
            "icao24":         s[0],
            "callsign":       (s[1] or "").strip(),
            "origin_country": s[2],
            "lon":            s[5],
            "lat":            s[6],
            "alt":            s[7],       # barometric altitude (m)
            "on_ground":      s[8],
            "velocity":       s[9],       # m/s
            "heading":        s[10],
            "vertical_rate":  s[11],
            "last_contact":   s[4],
        })

    return result
