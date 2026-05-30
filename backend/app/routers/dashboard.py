"""
Dashboard API router – Staff analytics.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case, or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_approved_admin
from app.models.models import Flight, Prediction, FlightFeature, Airline, User
from app.schemas.schemas import (
    DashboardOverview, FlightListOut, DelayCause, DelayHistoryPoint,
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/overview", response_model=DashboardOverview)
def get_overview(
    days: int = Query(30, description="Number of past days to include"),
    airport_id: Optional[int] = Query(None, description="Filter by airport ID"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Staff dashboard: overall flight statistics."""
    latest_flight = db.query(func.max(Flight.scheduled_departure)).scalar()
    if latest_flight:
        cutoff = latest_flight - timedelta(days=days)
    else:
        cutoff = datetime.utcnow() - timedelta(days=days)

    query_filter = [Flight.scheduled_departure >= cutoff]
    if airport_id:
        query_filter.append(or_(Flight.origin_airport_id == airport_id, Flight.dest_airport_id == airport_id))

    total = db.query(func.count(Flight.id)).filter(*query_filter).scalar() or 0
    on_time = db.query(func.count(Flight.id)).filter(
        *query_filter, Flight.status == "on_time"
    ).scalar() or 0
    delayed = db.query(func.count(Flight.id)).filter(
        *query_filter, Flight.status == "delayed"
    ).scalar() or 0
    cancelled = db.query(func.count(Flight.id)).filter(
        *query_filter, Flight.status == "cancelled"
    ).scalar() or 0

    avg_delay = db.query(func.avg(Flight.delay_minutes)).filter(
        *query_filter, Flight.status == "delayed"
    ).scalar() or 0

    # Flights with high risk predictions
    at_risk_q = db.query(func.count(Prediction.id)).join(Flight).filter(Prediction.risk_score >= 60)
    if airport_id:
        at_risk_q = at_risk_q.filter(or_(Flight.origin_airport_id == airport_id, Flight.dest_airport_id == airport_id))
    at_risk = at_risk_q.scalar() or 0

    delay_rate = (delayed / total * 100) if total > 0 else 0

    return DashboardOverview(
        total_flights=total,
        on_time_count=on_time,
        delayed_count=delayed,
        cancelled_count=cancelled,
        at_risk_count=at_risk,
        avg_delay_minutes=round(float(avg_delay), 1),
        delay_rate=round(delay_rate, 1),
    )


@router.get("/at-risk", response_model=list[FlightListOut])
def get_at_risk_flights(
    threshold: float = Query(50.0, description="Risk score threshold"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Get flights with high delay risk scores."""
    high_risk_flight_ids = (
        db.query(Prediction.flight_id)
        .filter(Prediction.risk_score >= threshold)
        .order_by(Prediction.risk_score.desc())
        .limit(limit)
        .subquery()
    )

    from app.repositories.flight_repository import get_flights_by_ids
    flights = get_flights_by_ids(db, high_risk_flight_ids.select())
    return flights


@router.get("/delay-causes", response_model=list[DelayCause])
def get_delay_causes(
    airport_id: Optional[int] = Query(None, description="Filter by airport ID"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Analyze main causes of delays from flight features."""
    q = db.query(FlightFeature).join(Flight).filter(FlightFeature.is_delayed == 1)
    if airport_id:
        q = q.filter(or_(Flight.origin_airport_id == airport_id, Flight.dest_airport_id == airport_id))
    
    delayed_features = q.all()

    if not delayed_features:
        return []

    # Calculate average contribution of each factor
    n = len(delayed_features)
    avg_weather = sum(float(f.weather_severity) for f in delayed_features) / n
    avg_congestion = sum(float(f.congestion_level) for f in delayed_features) / n
    avg_reliability = sum(1.0 - float(f.airline_reliability) for f in delayed_features) / n
    avg_hist_rate = sum(float(f.historical_delay_rate) for f in delayed_features) / n

    # Normalize to get relative impact
    total = avg_weather + avg_congestion + avg_reliability + avg_hist_rate
    if total == 0:
        total = 1

    return [
        DelayCause(
            factor="Weather Conditions",
            impact=round(avg_weather / total * 100, 1),
            description=f"Average severity: {avg_weather:.2f} – storms, fog, and snow increase delays",
        ),
        DelayCause(
            factor="Airport Congestion",
            impact=round(avg_congestion / total * 100, 1),
            description=f"Average level: {avg_congestion:.2f} – peak hours and high traffic cause bottlenecks",
        ),
        DelayCause(
            factor="Airline Performance",
            impact=round(avg_reliability / total * 100, 1),
            description=f"Average unreliability: {avg_reliability:.2f} – lower-reliability carriers have more delays",
        ),
        DelayCause(
            factor="Route History",
            impact=round(avg_hist_rate / total * 100, 1),
            description=f"Average rate: {avg_hist_rate:.2f} – some routes historically experience more delays",
        ),
    ]


@router.get("/history", response_model=list[DelayHistoryPoint])
def get_delay_history(
    days: int = Query(90, description="Number of past days"),
    group_by: str = Query("week", description="Group by: day, week, month"),
    airport_id: Optional[int] = Query(None, description="Filter by airport ID"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Historical delay statistics grouped by time period."""
    latest_flight = db.query(func.max(Flight.scheduled_departure)).scalar()
    if latest_flight:
        cutoff = latest_flight - timedelta(days=days)
    else:
        cutoff = datetime.utcnow() - timedelta(days=days)

    q = db.query(Flight).filter(Flight.scheduled_departure >= cutoff)
    if airport_id:
        q = q.filter(or_(Flight.origin_airport_id == airport_id, Flight.dest_airport_id == airport_id))
        
    flights = q.order_by(Flight.scheduled_departure).all()

    # Group flights
    from collections import defaultdict
    groups: dict[str, list] = defaultdict(list)

    for f in flights:
        dt = f.scheduled_departure
        if group_by == "day":
            key = dt.strftime("%Y-%m-%d")
        elif group_by == "month":
            key = dt.strftime("%Y-%m")
        else:  # week
            key = dt.strftime("%Y-W%W")
        groups[key].append(f)

    history = []
    for period, group_flights in sorted(groups.items()):
        total = len(group_flights)
        delayed = sum(1 for f in group_flights if f.status == "delayed")
        avg_d = (
            sum(f.delay_minutes for f in group_flights if f.status == "delayed") / delayed
            if delayed > 0
            else 0
        )
        history.append(DelayHistoryPoint(
            date=period,
            delay_rate=round(delayed / total * 100, 1) if total > 0 else 0,
            avg_delay=round(avg_d, 1),
            total_flights=total,
        ))

    return history


@router.get("/airlines-performance")
def get_airlines_performance(
    airport_id: Optional[int] = Query(None, description="Filter by airport ID"),
    db: Session = Depends(get_db)
):
    """Delay rate per airline."""
    airlines = db.query(Airline).all()
    results = []

    for al in airlines:
        q_filter = [Flight.airline_id == al.id]
        if airport_id:
            q_filter.append(or_(Flight.origin_airport_id == airport_id, Flight.dest_airport_id == airport_id))

        total = db.query(func.count(Flight.id)).filter(*q_filter).scalar() or 0
        if total == 0:
            continue

        delayed = db.query(func.count(Flight.id)).filter(*q_filter, Flight.status == "delayed").scalar() or 0
        avg_delay = db.query(func.avg(Flight.delay_minutes)).filter(*q_filter, Flight.status == "delayed").scalar() or 0

        results.append({
            "airline_iata": al.iata_code,
            "airline_name": al.name,
            "reliability_score": float(al.reliability_score),
            "total_flights": total,
            "delayed_flights": delayed,
            "delay_rate": round(delayed / total * 100, 1) if total > 0 else 0,
            "avg_delay_minutes": round(float(avg_delay), 1),
        })

    return sorted(results, key=lambda x: x["delay_rate"], reverse=True)
