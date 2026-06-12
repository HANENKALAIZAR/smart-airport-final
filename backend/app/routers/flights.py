"""
Flights API router.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_approved_admin, get_current_user_optional
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
from app.models.ae_models import AEFlightSnapshot
from app.services.flight_cache_service import _snapshot_to_api_dict

router = APIRouter(prefix="/api/flights", tags=["Flights"])


def _enrich_flights_with_snapshots(flights: list, db: Session):
    if not flights:
        return
        
    from datetime import date, timedelta
    from app.models.ae_models import AEFlightSnapshot
    
    flight_nums = {f.flight_number for f in flights}
    today = date.today()
    
    # Query snapshots for these flight numbers for yesterday and today
    snapshots = (
        db.query(AEFlightSnapshot)
        .filter(
            AEFlightSnapshot.flight_number.in_(list(flight_nums)),
            AEFlightSnapshot.snapshot_date >= today - timedelta(days=1)
        )
        .order_by(AEFlightSnapshot.collected_at.desc())
        .all()
    )
    
    # Group snapshots by (flight_number, direction)
    snap_map = {}
    for s in snapshots:
        key = (s.flight_number, s.direction)
        if key not in snap_map:
            snap_map[key] = s
            
    # Tunisian airports list to resolve direction
    TUNISIAN_AIRPORTS = {"TUN", "MIR", "NBE", "DJE", "TOE"}
    
    for f in flights:
        origin_iata = f.origin_airport.iata_code if f.origin_airport else None
        direction = "departure" if origin_iata in TUNISIAN_AIRPORTS else "arrival"
        
        # Try specific direction first, then fallback to any snapshot matching flight number
        snap = snap_map.get((f.flight_number, direction))
        if not snap:
            for k, s in snap_map.items():
                if k[0] == f.flight_number:
                    snap = s
                    break
                    
        if snap:
            # Get best available gate/terminal (Aviation Edge first, FlightAware fallback)
            gate = (snap.arr_gate if direction == "arrival" else snap.dep_gate)
            fa_gate = (snap.fa_arr_gate if direction == "arrival" else snap.fa_dep_gate)
            
            terminal = (snap.arr_terminal if direction == "arrival" else snap.dep_terminal)
            fa_terminal = (snap.fa_arr_terminal if direction == "arrival" else snap.fa_dep_terminal)
            
            f.gate = gate or fa_gate
            f.terminal = terminal or fa_terminal
            
            if gate:
                f.gate_source = "aviation_edge"
            elif fa_gate:
                f.gate_source = "flightaware"
            else:
                f.gate_source = None
                
            f.displayed_dep_source = snap.displayed_dep_source
            f.displayed_arr_source = snap.displayed_arr_source
        else:
            f.gate = None
            f.terminal = None
            f.gate_source = None
            f.displayed_dep_source = None
            f.displayed_arr_source = None


@router.get("", response_model=list[dict])
def list_flights(
    status: Optional[str] = Query(None, description="Filter by status: on_time, delayed, scheduled, cancelled"),
    airport: Optional[str] = Query(None, description="Filter by airport IATA code (airport_iata)"),
    airline: Optional[str] = Query(None, description="Filter by airline IATA code"),
    direction: Optional[str] = Query(None, description="departure or arrival"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD — past, today, or future"),
    search: Optional[str] = Query(None, description="Search by flight number"),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """List flights for admin dashboard directly from AEFlightSnapshot (Phase 3).
    
    Date-based query classification:
    - Past date:     query by snapshot_date (historical snapshots already collected)
    - Today:         query by snapshot_date (live snapshot data)
    - Future date:   query by flight_date (scheduled flights whose date is in the future)
    
    Airport admin restriction:
    - Airport admin (role='admin'):  forced to their assigned airport
    - Super admin:                   respects the ?airport= filter (default: all)
    - Unauthenticated:               no airport restriction (public data)
    """
    today = datetime.now(timezone.utc).date()
    query_date = today
    if date:
        try:
            query_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            pass

    # Classify date and use the appropriate date column
    if query_date > today:
        date_filter = AEFlightSnapshot.flight_date == query_date
    else:
        date_filter = AEFlightSnapshot.snapshot_date == query_date

    query = db.query(AEFlightSnapshot).filter(date_filter)

    # ── Airport admin restriction ───────────────────────────────────────────
    # Airport admins are forced to their assigned airport; super_admins
    # respect the ?airport= query param (default all)
    if current_user and current_user.role == "admin" and current_user.airport_iata:
        query = query.filter(AEFlightSnapshot.airport_iata == current_user.airport_iata.upper())
    elif airport:
        query = query.filter(AEFlightSnapshot.airport_iata == airport.upper())
    
    if direction:
        query = query.filter(AEFlightSnapshot.direction == direction.lower())
        
    if airline:
        query = query.filter(
            (AEFlightSnapshot.airline_iata == airline.upper()) | 
            (AEFlightSnapshot.airline_icao == airline.upper())
        )
        
    if search:
        query = query.filter(AEFlightSnapshot.flight_number.ilike(f"%{search}%"))

    # Mapping frontend status to AE statuses
    if status:
        status_map = {
            "on_time": ["active", "scheduled"],
            "delayed": ["delayed"],
            "cancelled": ["cancelled", "canceled"],
            "scheduled": ["scheduled"]
        }
        mapped = status_map.get(status.lower(), [status.lower()])
        query = query.filter(AEFlightSnapshot.status.in_(mapped))

    rows = query.order_by(AEFlightSnapshot.dep_scheduled.desc(), AEFlightSnapshot.arr_scheduled.desc()).offset(skip).limit(limit).all()
    
    return [_snapshot_to_api_dict(r) for r in rows]


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
    flight_id: str,
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
    flight_id: str,
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
def get_flight(flight_id: str, db: Session = Depends(get_db)):
    """Get detailed flight info with prediction and passenger rights."""
    try:
        fid = int(flight_id)
    except ValueError:
        # Not a DB integer ID. Likely an external ID (OpenSky)
        # For now, return 404 since we don't store external flights in DB
        raise HTTPException(status_code=404, detail=f"External flight {flight_id} not in database")

    flight = get_flight_detail(db, fid)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    _enrich_flights_with_snapshots([flight], db)

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
def get_flight_prediction(flight_id: str, db: Session = Depends(get_db)):
    """Get AI prediction for a specific flight."""
    try:
        fid = int(flight_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="External flight prediction not available")

    from app.models.models import Flight as FlightModel

    flight = db.query(FlightModel).filter(FlightModel.id == fid).first()
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
def get_flight_features_endpoint(flight_id: str, db: Session = Depends(get_db)):
    """Get computed ML features for a flight."""
    try:
        fid = int(flight_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="External flight features not available")

    features = get_flight_features(db, fid)
    if not features:
        raise HTTPException(status_code=404, detail="Flight features not found")
    return FlightFeaturesOut.model_validate(features)
