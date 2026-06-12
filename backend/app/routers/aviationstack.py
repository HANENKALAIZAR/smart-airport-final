"""
AviationStack Router
=====================
Serves real-time departures and arrivals for Tunisian airports.
Data comes from the AviationStack API with local caching.

Additions:
  - GET /api/aviationstack/predict/{flight_number}
    Fetches the flight from the cache, builds ML features on the fly,
    and returns a full AI prediction alongside flight info.
"""

from fastapi import APIRouter, HTTPException
from app.api_clients.aviationstack_client import fetch_flights, normalize_flight

router = APIRouter(prefix="/api/aviationstack", tags=["aviationstack"])

# ── Supported airports ────────────────────────────────────────────────────
AIRPORTS = {
    "TUN": "Tunis–Carthage",
    "DJE": "Djerba–Zarzis",
    "NBE": "Enfidha–Hammamet",
    "MIR": "Monastir",
    "SFA": "Sfax–Thyna",
    "TOE": "Tozeur–Nefta",
    "TBJ": "Tabarka–Aïn Draham",
    "GAF": "Gafsa–Ksar",
}


@router.get("/flights/{iata}")
async def get_airport_flights(iata: str, direction: str = "both"):
    """
    Get departures and/or arrivals for a Tunisian airport.

    Args:
        iata: Airport IATA code (e.g. TUN, DJE)
        direction: 'departure', 'arrival', or 'both' (default)
    """
    iata = iata.upper()
    if iata not in AIRPORTS:
        raise HTTPException(status_code=404, detail=f"Airport '{iata}' not supported")

    flights = []

    try:
        if direction in ("departure", "both"):
            dep_data = await fetch_flights(iata, "departure", limit=100)
            for raw in dep_data.get("data") or []:
                flights.append(normalize_flight(raw, "departure"))

        if direction in ("arrival", "both"):
            arr_data = await fetch_flights(iata, "arrival", limit=100)
            for raw in arr_data.get("data") or []:
                flights.append(normalize_flight(raw, "arrival"))

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve flights for {iata}: {e}",
        )

    # Sort by scheduled time
    flights.sort(key=lambda f: f.get("dep_scheduled") or f.get("arr_scheduled") or "")

    # Deduplicate by flight number (codeshares)
    seen: set[str] = set()
    unique_flights = []
    for f in flights:
        key = f["flight_number"]
        if key not in seen:
            seen.add(key)
            unique_flights.append(f)

    return {
        "airport": iata,
        "airport_name": AIRPORTS[iata],
        "total": len(unique_flights),
        "departures": sum(1 for f in unique_flights if f["direction"] == "departure"),
        "arrivals":   sum(1 for f in unique_flights if f["direction"] == "arrival"),
        "flights": unique_flights,
    }


@router.get("/predict/{flight_number}")
async def predict_live_flight(flight_number: str):
    """
    Real-time AI prediction for a specific flight number.

    Flow:
      1. Search all supported airports for the flight in AviationStack cache
      2. Build ML feature vector from the live flight data
      3. Run the XGBoost model (or rule-based fallback)
      4. Return combined: flight info + prediction + SHAP explanation

    Args:
        flight_number: IATA flight number e.g. TU302, AF1234
    """
    fn = flight_number.upper()
    matched_flight = None

    # Search cache across all airports and both directions
    for iata in AIRPORTS:
        for direction in ("departure", "arrival"):
            try:
                data = await fetch_flights(iata, direction, limit=100)
                for raw in (data.get("data") or []):
                    norm = normalize_flight(raw, direction)
                    if norm.get("flight_number", "").upper() == fn:
                        matched_flight = norm
                        break
            except Exception:
                continue
            if matched_flight:
                break
        if matched_flight:
            break

    if matched_flight is None:
        raise HTTPException(
            status_code=404,
            detail=f"Flight '{fn}' not found in current AviationStack data",
        )

    # Build features from live flight data
    from app.services.live_feature_builder import build_features
    from app.services.prediction_service import predict_from_dict

    features = build_features(matched_flight)
    prediction = predict_from_dict(features)

    return {
        "flight": matched_flight,
        "features_used": features,
        "prediction": {
            "risk_score":          prediction.risk_score,
            "predicted_delay_min": prediction.predicted_delay_min,
            "confidence":          prediction.confidence,
            "shap_explanation":    prediction.shap_explanation,
            "model_version":       prediction.model_version,
        },
    }


@router.get("/airports")
async def list_airports():
    """List all supported Tunisian airports."""
    return [{"iata": code, "name": name} for code, name in AIRPORTS.items()]
