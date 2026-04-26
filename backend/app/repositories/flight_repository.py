"""
Flight Repository – Phase 3A Data Access Layer
================================================
Centralises all reusable SQLAlchemy queries for the Flight domain.
Routers must call these functions instead of writing inline ORM queries.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.models import (
    Flight, Airport, Airline, Prediction, FlightFeature,
)


# ── Core eager-load options (single source of truth) ──────────────────────

def get_flight_list_options():
    """Standard eager-load options for list/detail responses."""
    return [
        joinedload(Flight.airline),
        joinedload(Flight.origin_airport),
        joinedload(Flight.dest_airport),
    ]


# ── Queries ───────────────────────────────────────────────────────────────

def get_flight_by_id(db: Session, flight_id: int) -> Optional[Flight]:
    """Fetch a single flight by primary key with all list relationships loaded."""
    return (
        db.query(Flight)
        .options(*get_flight_list_options())
        .filter(Flight.id == flight_id)
        .first()
    )


from typing import Optional, Any

def get_flights_by_ids(db: Session, flight_ids: Any) -> list[Flight]:
    """Fetch multiple flights by ID with standard eager-loading."""
    return (
        db.query(Flight)
        .options(*get_flight_list_options())
        .filter(Flight.id.in_(flight_ids))
        .all()
    )


def get_flight_detail(db: Session, flight_id: int) -> Optional[Flight]:
    """Fetch a flight with list relationships AND predictions loaded."""
    return (
        db.query(Flight)
        .options(
            *get_flight_list_options(),
            joinedload(Flight.predictions),
        )
        .filter(Flight.id == flight_id)
        .first()
    )


def list_flights(
    db: Session,
    *,
    status: Optional[str] = None,
    airport_iata: Optional[str] = None,
    airline_iata: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[Flight]:
    """Return a filtered, paginated list of flights."""
    query = db.query(Flight).options(*get_flight_list_options())

    if status:
        query = query.filter(Flight.status == status)

    if airport_iata:
        origin = (
            db.query(Airport)
            .filter(Airport.iata_code == airport_iata.upper())
            .first()
        )
        if origin:
            query = query.filter(
                (Flight.origin_airport_id == origin.id)
                | (Flight.dest_airport_id == origin.id)
            )

    if airline_iata:
        al = (
            db.query(Airline)
            .filter(Airline.iata_code == airline_iata.upper())
            .first()
        )
        if al:
            query = query.filter(Flight.airline_id == al.id)

    if date_from:
        query = query.filter(Flight.scheduled_departure >= date_from)

    if date_to:
        query = query.filter(
            Flight.scheduled_departure <= date_to.replace(hour=23, minute=59)
        )

    if search:
        query = query.filter(Flight.flight_number.ilike(f"%{search}%"))

    return query.order_by(Flight.scheduled_departure.desc()).offset(skip).limit(limit).all()


def get_latest_prediction(db: Session, flight_id: int) -> Optional[Prediction]:
    """Return the most recent prediction for a flight, or None."""
    return (
        db.query(Prediction)
        .filter(Prediction.flight_id == flight_id)
        .order_by(Prediction.predicted_at.desc())
        .first()
    )


def get_flight_features(db: Session, flight_id: int) -> Optional[FlightFeature]:
    """Return the computed ML feature row for a flight, or None."""
    return (
        db.query(FlightFeature)
        .filter(FlightFeature.flight_id == flight_id)
        .first()
    )


def resolve_airline(db: Session, iata_code: str) -> Optional[Airline]:
    """Look up an airline by IATA code."""
    return db.query(Airline).filter(Airline.iata_code == iata_code.upper()).first()


def resolve_airport(db: Session, iata_code: str) -> Optional[Airport]:
    """Look up an airport by IATA code."""
    return db.query(Airport).filter(Airport.iata_code == iata_code.upper()).first()
