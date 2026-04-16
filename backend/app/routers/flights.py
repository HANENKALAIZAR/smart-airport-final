"""
Flights API router.
"""

from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.models import Flight, Airport, Airline, Prediction, FlightFeature
from app.schemas.schemas import FlightListOut, FlightDetailOut, PredictionOut, FlightFeaturesOut

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
    query = db.query(Flight).options(
        joinedload(Flight.airline),
        joinedload(Flight.origin_airport),
        joinedload(Flight.dest_airport),
    )

    if status:
        query = query.filter(Flight.status == status)

    if airport:
        origin = db.query(Airport).filter(Airport.iata_code == airport.upper()).first()
        if origin:
            query = query.filter(
                (Flight.origin_airport_id == origin.id) | (Flight.dest_airport_id == origin.id)
            )

    if airline:
        al = db.query(Airline).filter(Airline.iata_code == airline.upper()).first()
        if al:
            query = query.filter(Flight.airline_id == al.id)

    if date_from:
        try:
            d = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(Flight.scheduled_departure >= d)
        except ValueError:
            pass

    if date_to:
        try:
            d = datetime.strptime(date_to, "%Y-%m-%d")
            query = query.filter(Flight.scheduled_departure <= d.replace(hour=23, minute=59))
        except ValueError:
            pass

    if search:
        query = query.filter(Flight.flight_number.ilike(f"%{search}%"))

    query = query.order_by(Flight.scheduled_departure.desc())
    flights = query.offset(skip).limit(limit).all()
    return flights


@router.get("/{flight_id}", response_model=FlightDetailOut)
def get_flight(flight_id: int, db: Session = Depends(get_db)):
    """Get detailed flight info with prediction and passenger rights."""
    flight = (
        db.query(Flight)
        .options(
            joinedload(Flight.airline),
            joinedload(Flight.origin_airport),
            joinedload(Flight.dest_airport),
            joinedload(Flight.predictions),
        )
        .filter(Flight.id == flight_id)
        .first()
    )
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    # Get latest prediction
    prediction = None
    if flight.predictions:
        prediction = sorted(flight.predictions, key=lambda p: p.predicted_at or datetime.min, reverse=True)[0]

    # Get passenger rights based on region and delay
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
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    # Check for existing prediction
    prediction = (
        db.query(Prediction)
        .filter(Prediction.flight_id == flight_id)
        .order_by(Prediction.predicted_at.desc())
        .first()
    )

    if prediction:
        return PredictionOut.model_validate(prediction)

    # Generate on-the-fly prediction
    features = db.query(FlightFeature).filter(FlightFeature.flight_id == flight_id).first()
    if not features:
        raise HTTPException(status_code=404, detail="Flight features not found for prediction")

    from app.services.prediction_service import predict_flight
    result = predict_flight(features)
    return result


@router.get("/{flight_id}/features", response_model=FlightFeaturesOut)
def get_flight_features(flight_id: int, db: Session = Depends(get_db)):
    """Get computed ML features for a flight."""
    features = db.query(FlightFeature).filter(FlightFeature.flight_id == flight_id).first()
    if not features:
        raise HTTPException(status_code=404, detail="Flight features not found")
    return FlightFeaturesOut.model_validate(features)

