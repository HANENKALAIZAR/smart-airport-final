"""
Airports & Airlines API router.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Airport, Airline, Flight, WeatherCondition
from app.schemas.schemas import AirportOut, AirlineOut, WeatherOut

router = APIRouter(prefix="/api", tags=["Airports & Airlines"])


@router.get("/airports", response_model=list[AirportOut])
def list_airports(
    region: str | None = Query(None, description="Filter by region"),
    search: str | None = Query(None, description="Search by name or IATA code"),
    db: Session = Depends(get_db),
):
    """List all airports with optional filters."""
    query = db.query(Airport)

    if region:
        query = query.filter(Airport.region == region)

    if search:
        query = query.filter(
            (Airport.iata_code.ilike(f"%{search}%")) |
            (Airport.name.ilike(f"%{search}%")) |
            (Airport.city.ilike(f"%{search}%"))
        )

    return query.order_by(Airport.iata_code).all()


@router.get("/airlines", response_model=list[AirlineOut])
def list_airlines(
    search: str | None = Query(None, description="Search by name or IATA code"),
    db: Session = Depends(get_db),
):
    """List all airlines."""
    query = db.query(Airline)

    if search:
        query = query.filter(
            (Airline.iata_code.ilike(f"%{search}%")) |
            (Airline.name.ilike(f"%{search}%"))
        )

    return query.order_by(Airline.name).all()


@router.get("/weather", response_model=list[dict])
def list_weather(
    airport: str | None = Query(None, description="Filter by airport IATA code"),
    db: Session = Depends(get_db),
):
    """Get latest weather observations per airport."""
    query = db.query(WeatherCondition, Airport).join(
        Airport, WeatherCondition.airport_id == Airport.id
    )

    if airport:
        query = query.filter(Airport.iata_code == airport.upper())

    query = query.order_by(WeatherCondition.recorded_at.desc()).limit(50)
    results = query.all()

    return [
        {
            "airport_iata": ap.iata_code,
            "airport_name": ap.name,
            "city": ap.city,
            "temperature_c": w.temperature_c,
            "wind_speed_kmh": w.wind_speed_kmh,
            "visibility_km": w.visibility_km,
            "precipitation_mm": w.precipitation_mm,
            "weather_code": w.weather_code,
            "humidity_pct": w.humidity_pct,
            "recorded_at": w.recorded_at.isoformat() if w.recorded_at else None,
        }
        for w, ap in results
    ]
