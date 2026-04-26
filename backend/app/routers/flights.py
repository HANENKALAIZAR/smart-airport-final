"""
Flights API router.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_approved_admin
from app.models.models import User
from app.repositories.flight_repository import (
    list_flights as repo_list_flights,
    get_flight_by_id,
    get_flight_detail,
    get_latest_prediction,
    get_flight_features,
    resolve_airline,
    resolve_airport,
)
from app.schemas.schemas import (
    FlightListOut, FlightDetailOut, PredictionOut,
    FlightFeaturesOut, FlightCreate, FlightUpdate,
)

router = APIRouter(prefix="/api/flights", tags=["Flights"])


@router.get("", response_model=list[FlightListOut])
def list_flights(
    status: Optional[str] = Query(None, description="Filter by status: on_time, delayed, scheduled, cancelled"),
    airport: Optional[str] = Query(None, description="Filter by origin/destination IATA code"),
    airline: Optional[str] = Query(None, description="Filter by airline IATA code"),
    date_from: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    search: Optional[str] = Query(None, description="Search by flight number"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List flights with optional filters."""
    parsed_from: Optional[datetime] = None
    parsed_to: Optional[datetime] = None

    if date_from:
        try:
            parsed_from = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            pass

    if date_to:
        try:
            parsed_to = datetime.strptime(date_to, "%Y-%m-%d")
        except ValueError:
            pass

    return repo_list_flights(
        db,
        status=status,
        airport_iata=airport,
        airline_iata=airline,
        date_from=parsed_from,
        date_to=parsed_to,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=FlightListOut, status_code=201)
def create_flight(
    payload: FlightCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Create a new flight."""
    from app.models.models import Flight

    al = resolve_airline(db, payload.airline_iata)
    if not al:
        raise HTTPException(status_code=404, detail=f"Airline '{payload.airline_iata}' not found")

    origin = resolve_airport(db, payload.origin_iata)
    if not origin:
        raise HTTPException(status_code=404, detail=f"Origin airport '{payload.origin_iata}' not found")

    dest = resolve_airport(db, payload.destination_iata)
    if not dest:
        raise HTTPException(status_code=404, detail=f"Destination airport '{payload.destination_iata}' not found")

    flight = Flight(
        flight_number=payload.flight_number,
        airline_id=al.id,
        origin_airport_id=origin.id,
        dest_airport_id=dest.id,
        scheduled_departure=payload.scheduled_departure,
        scheduled_arrival=payload.scheduled_arrival,
        status=payload.status,
        delay_minutes=payload.delay_minutes,
        distance_km=payload.distance_km,
        aircraft_type=payload.aircraft_type,
    )
    db.add(flight)
    db.commit()
    db.refresh(flight)

    return get_flight_by_id(db, flight.id)


@router.put("/{flight_id}", response_model=FlightListOut)
def update_flight(
    flight_id: int,
    payload: FlightUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Update an existing flight's status, delay, or times."""
    from app.models.models import Flight as FlightModel

    flight = db.query(FlightModel).filter(FlightModel.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(flight, field, value)

    db.commit()
    db.refresh(flight)

    return get_flight_by_id(db, flight.id)


@router.delete("/{flight_id}", status_code=204)
def delete_flight(
    flight_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Delete a flight."""
    from app.models.models import Flight as FlightModel

    flight = db.query(FlightModel).filter(FlightModel.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    db.delete(flight)
    db.commit()
    return None


@router.get("/{flight_id}", response_model=FlightDetailOut)
def get_flight(flight_id: int, db: Session = Depends(get_db)):
    """Get detailed flight info with prediction and passenger rights."""
    flight = get_flight_detail(db, flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    prediction = None
    if flight.predictions:
        prediction = sorted(
            flight.predictions,
            key=lambda p: p.predicted_at or datetime.min,
            reverse=True,
        )[0]

    from app.services.passenger_rights import get_applicable_rights
    rights = get_applicable_rights(db, flight)

    result = FlightDetailOut.model_validate(flight)
    if prediction:
        result.prediction = PredictionOut.model_validate(prediction)
    result.passenger_rights = rights
    return result


@router.get("/{flight_id}/prediction", response_model=PredictionOut)
def get_flight_prediction(flight_id: int, db: Session = Depends(get_db)):
    """Get AI prediction for a specific flight."""
    from app.models.models import Flight as FlightModel

    flight = db.query(FlightModel).filter(FlightModel.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    prediction = get_latest_prediction(db, flight_id)
    if prediction:
        return PredictionOut.model_validate(prediction)

    features = get_flight_features(db, flight_id)
    if not features:
        raise HTTPException(status_code=404, detail="Flight features not found for prediction")

    from app.services.prediction_service import predict_flight
    return predict_flight(features)


@router.get("/{flight_id}/features", response_model=FlightFeaturesOut)
def get_flight_features_endpoint(flight_id: int, db: Session = Depends(get_db)):
    """Get computed ML features for a flight."""
    features = get_flight_features(db, flight_id)
    if not features:
        raise HTTPException(status_code=404, detail="Flight features not found")
    return FlightFeaturesOut.model_validate(features)
