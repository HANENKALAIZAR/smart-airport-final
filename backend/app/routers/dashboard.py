"""
Dashboard API router – Staff analytics.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
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
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Staff dashboard: overall flight statistics."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    total = db.query(func.count(Flight.id)).filter(Flight.scheduled_departure >= cutoff).scalar() or 0
    on_time = db.query(func.count(Flight.id)).filter(
        Flight.scheduled_departure >= cutoff, Flight.status == "on_time"
    ).scalar() or 0
    delayed = db.query(func.count(Flight.id)).filter(
        Flight.scheduled_departure >= cutoff, Flight.status == "delayed"
    ).scalar() or 0
    cancelled = db.query(func.count(Flight.id)).filter(
        Flight.scheduled_departure >= cutoff, Flight.status == "cancelled"
    ).scalar() or 0

    avg_delay = db.query(func.avg(Flight.delay_minutes)).filter(
        Flight.scheduled_departure >= cutoff, Flight.status == "delayed"
    ).scalar() or 0

    # Flights with high risk predictions
    at_risk = db.query(func.count(Prediction.id)).filter(
        Prediction.risk_score >= 60
    ).scalar() or 0

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
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Analyze main causes of delays from flight features."""
    delayed_features = (
        db.query(FlightFeature)
        .filter(FlightFeature.is_delayed == 1)
        .all()
    )

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
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
):
    """Historical delay statistics grouped by time period."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    flights = (
        db.query(Flight)
        .filter(Flight.scheduled_departure >= cutoff)
        .order_by(Flight.scheduled_departure)
        .all()
    )

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
def get_airlines_performance(db: Session = Depends(get_db)):
    """Delay rate per airline."""
    airlines = db.query(Airline).all()
    results = []

    for al in airlines:
        total = db.query(func.count(Flight.id)).filter(Flight.airline_id == al.id).scalar() or 0
        delayed = db.query(func.count(Flight.id)).filter(
            Flight.airline_id == al.id, Flight.status == "delayed"
        ).scalar() or 0
        avg_delay = db.query(func.avg(Flight.delay_minutes)).filter(
            Flight.airline_id == al.id, Flight.status == "delayed"
        ).scalar() or 0

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
