"""
AI Operational Suggestions Router
===================================
Generates real, context-aware operational suggestions for airport admins.

All suggestions are derived exclusively from real database conditions:
  - AEFlightSnapshot  (live flight statuses, delays, gates, terminals)
  - AEFlightDataset   (historical delay patterns, is_peak_hour, is_weekend)
  - AEFutureSchedule  (upcoming predicted delays from ML model)
  - AEAviationStats   (route/airline/airport reliability stats)

NO hardcoded messages. NO fake AI text. NO invented weather/ATC causes.
Every suggestion is generated from real operational conditions only.

Endpoints:
  GET /api/admin/ai-suggestions   – Airport admin: suggestions for their airport
  GET /api/admin/ai-suggestions/all – Super admin: suggestions across all airports

Priority rules:
  HIGH   – predicted delay >= 60 min | multiple simultaneous delays | repeated disruption
  MEDIUM – predicted delay >= 30 min | congestion risk | operational coordination needed
  LOW    – minor flow improvements | monitoring recommendations
"""

import logging
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.dependencies import require_admin, require_super_admin
from app.models.models import User
from app.models.ae_models import (
    AEFlightSnapshot,
    AEFlightDataset,
    AEFutureSchedule,
    AEAviationStats,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["AI Suggestions"])

TUNISIAN_AIRPORTS = {"TUN", "MIR", "DJE", "NBE"}
AIRPORT_NAMES = {
    "TUN": "Tunis-Carthage",
    "MIR": "Monastir",
    "DJE": "Djerba-Zarzis",
    "NBE": "Enfidha-Hammamet",
}

PEAK_HOURS = {7, 8, 9, 17, 18, 19, 20}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _make_suggestion(
    *,
    priority: str,
    title: str,
    message: str,
    recommended_action: str,
    flight_number: Optional[str] = None,
    airport_iata: Optional[str] = None,
    route: Optional[str] = None,
    predicted_delay: Optional[int] = None,
    category: str = "operational",
) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "priority": priority,
        "category": category,
        "title": title,
        "message": message,
        "recommendedAction": recommended_action,
        "flightNumber": flight_number,
        "airportIata": airport_iata,
        "route": route,
        "predictedDelay": predicted_delay,
        "createdAt": _now_utc().isoformat(),
        "source": "AI Operational Intelligence",
    }


def generate_suggestions_for_airport(airport_iata: str, db: Session, date_str: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Generate all AI Operational Suggestions for a specific airport.
    All logic is driven exclusively from real DB data.
    Returns a sorted list (high → medium → low).
    """
    suggestions: List[Dict[str, Any]] = []
    
    if date_str:
        try:
            today = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            today = _now_utc().date()
    else:
        today = _now_utc().date()

    now = _now_utc()
    if today != now.date():
        # Set to the start of the selected date in UTC
        now = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    current_hour = now.hour

    iata = airport_iata.upper()
    airport_label = AIRPORT_NAMES.get(iata, iata)

    # Filter all snapshot-based suggestions strictly to flights having one of the operational statuses
    OPERATIONAL_STATUSES = ["scheduled", "delayed", "in_air"]

    # Retrieve all live flights for the selected date having operational statuses
    live_flights = (
        db.query(AEFlightSnapshot)
        .filter(
            AEFlightSnapshot.airport_iata == iata,
            AEFlightSnapshot.snapshot_date == today,
            AEFlightSnapshot.status.in_(OPERATIONAL_STATUSES),
        )
        .all()
    )

    if not live_flights:
        return []

    # ── 1. LIVE DELAYED FLIGHTS (from ae_flight_snapshots) ──────────────────
    delayed_today = [f for f in live_flights if f.status == "delayed"]
    # Sort by delay_minutes descending
    delayed_today.sort(key=lambda f: f.delay_minutes or f.dep_delay_min or f.arr_delay_min or 0, reverse=True)

    # ── 1a. Severely delayed individual flights (delay >= 60 min) ───────────
    for snap in delayed_today:
        delay = snap.delay_minutes or snap.dep_delay_min or snap.arr_delay_min or 0
        if delay >= 60:
            is_dep = snap.direction == "departure"
            route = f"{snap.dep_iata or iata} → {snap.arr_iata or '?'}"
            gate = snap.dep_gate or snap.arr_gate
            terminal = snap.dep_terminal or snap.arr_terminal
            gate_ctx = f" at Gate {gate}" if gate else (f" in Terminal {terminal}" if terminal else "")
            h = delay // 60
            m = delay % 60
            delay_str = f"{h}h {m}m" if h > 0 else f"{m}m"
            direction_label = "departure" if is_dep else "arrival"

            suggestions.append(_make_suggestion(
                priority="high",
                category="delay",
                title=f"Significant Delay — {snap.flight_number}",
                message=(
                    f"Flight {snap.flight_number} ({route}) is currently showing a "
                    f"{delay_str} {direction_label} delay{gate_ctx}. "
                    f"This may affect connecting passengers and adjacent gate scheduling at {airport_label}."
                ),
                recommended_action=(
                    f"Consider notifying passengers early via the information system. "
                    f"If operationally feasible, assess gate{' ' + gate if gate else ''} availability "
                    f"for smoother boarding flow once the delay is resolved."
                ),
                flight_number=snap.flight_number,
                airport_iata=iata,
                route=route,
                predicted_delay=delay,
            ))

    # ── 1b. Multiple simultaneous delays (coordination suggestion) ──────────
    if len(delayed_today) >= 3:
        dep_delays = [s for s in delayed_today if s.direction == "departure"]
        arr_delays = [s for s in delayed_today if s.direction == "arrival"]
        suggestions.append(_make_suggestion(
            priority="high",
            category="coordination",
            title="Multiple Concurrent Delays — Coordination Recommended",
            message=(
                f"{len(delayed_today)} flights are currently delayed at {airport_label} "
                f"({len(dep_delays)} departures, {len(arr_delays)} arrivals). "
                f"Cascading delays across multiple gates may increase passenger congestion."
            ),
            recommended_action=(
                "Additional coordination between boarding, baggage handling, and ground operations "
                "may help reduce compounding delays. Consider proactive passenger communication "
                "across all delayed flights simultaneously."
            ),
            airport_iata=iata,
        ))

    elif len(delayed_today) == 2:
        suggestions.append(_make_suggestion(
            priority="medium",
            category="coordination",
            title="Two Concurrent Delays — Early Coordination Advised",
            message=(
                f"Two flights are currently delayed at {airport_label}. "
                f"Combined passenger load at delay areas may increase pressure on ground staff."
            ),
            recommended_action=(
                "Early coordination between ground operations and boarding staff "
                "may prevent further delays from cascading."
            ),
            airport_iata=iata,
        ))

    # ── 2. PEAK HOUR CONGESTION ──────────────────────────────────────────────
    is_peak = current_hour in PEAK_HOURS
    if is_peak:
        # Count scheduled/delayed/in_air flights in the next 2 hours
        window_start = now.replace(tzinfo=None)
        window_end = (now + timedelta(hours=2)).replace(tzinfo=None)
        
        active_in_window = sum(
            1 for f in live_flights
            if f.dep_scheduled is not None
            and window_start <= f.dep_scheduled <= window_end
        )

        if active_in_window >= 5:
            suggestions.append(_make_suggestion(
                priority="medium",
                category="congestion",
                title=f"Peak Hour — High Passenger Volume Expected ({current_hour:02d}:00)",
                message=(
                    f"{active_in_window} flights are scheduled to board or depart within "
                    f"the next 2 hours at {airport_label} during peak hour "
                    f"({current_hour:02d}:00–{(current_hour + 2) % 24:02d}:00). "
                    f"Passenger density may be elevated near security and boarding areas."
                ),
                recommended_action=(
                    "Additional queue monitoring near security checkpoints and boarding gates "
                    "may improve passenger flow during this period."
                ),
                airport_iata=iata,
            ))
        elif active_in_window >= 3:
            suggestions.append(_make_suggestion(
                priority="low",
                category="congestion",
                title=f"Peak Hour — Moderate Activity ({current_hour:02d}:00)",
                message=(
                    f"{active_in_window} flights are scheduled within the next 2 hours during "
                    f"peak period at {airport_label}. Standard monitoring is recommended."
                ),
                recommended_action=(
                    "Ensure staffing at security and boarding areas is aligned with "
                    "current traffic volume."
                ),
                airport_iata=iata,
            ))

    # ── 3. PREDICTED FUTURE DELAYS (from ae_future_schedules) ───────────────
    upcoming_window = now.replace(tzinfo=None) + timedelta(hours=6)
    predicted_high = (
        db.query(AEFutureSchedule)
        .filter(
            AEFutureSchedule.airport_iata == iata,
            AEFutureSchedule.predicted_at.isnot(None),
            AEFutureSchedule.predicted_delay_min >= 30,
            AEFutureSchedule.scheduled_departure >= now.replace(tzinfo=None),
            AEFutureSchedule.scheduled_departure <= upcoming_window,
        )
        .order_by(AEFutureSchedule.predicted_delay_min.desc())
        .limit(5)
        .all()
    )

    live_flight_numbers = {f.flight_number for f in live_flights}

    for sched in predicted_high:
        if sched.flight_number not in live_flight_numbers:
            continue
        delay = sched.predicted_delay_min or 0
        conf = round((sched.confidence or 0.5) * 100)
        route = f"{sched.dep_iata or iata} → {sched.arr_iata or '?'}"
        dep_time = sched.scheduled_departure.strftime("%H:%M") if sched.scheduled_departure else "?"
        h = delay // 60
        m = delay % 60
        delay_str = f"{h}h {m}m" if h > 0 else f"{m}m"
        priority = "high" if delay >= 60 else "medium"

        suggestions.append(_make_suggestion(
            priority=priority,
            category="prediction",
            title=f"ML Delay Prediction — {sched.flight_number}",
            message=(
                f"The prediction model estimates a {delay_str} delay for flight "
                f"{sched.flight_number} ({route}) departing at {dep_time} "
                f"(confidence: {conf}%). Early awareness may help operational readiness."
            ),
            recommended_action=(
                "Early passenger communication is recommended to reduce terminal congestion. "
                "Consider coordinating ground operations proactively if the delay materialises."
            ),
            flight_number=sched.flight_number,
            airport_iata=iata,
            route=route,
            predicted_delay=delay,
        ))

    # ── 4. ROUTE RELIABILITY (from ae_aviation_stats) ───────────────────────
    # Find routes serving this airport with low reliability scores
    route_stats = (
        db.query(AEAviationStats)
        .filter(
            AEAviationStats.stat_type == "route",
            AEAviationStats.entity_key.like(f"{iata}→%"),
            AEAviationStats.delay_rate >= 0.40,
            AEAviationStats.total_flights >= 5,
        )
        .order_by(AEAviationStats.delay_rate.desc())
        .limit(3)
        .all()
    )

    for stat in route_stats:
        parts = stat.entity_key.split("→")
        if len(parts) == 2:
            dep_iata, arr_iata = parts[0], parts[1]
            matching_live = [f for f in live_flights if f.dep_iata == dep_iata and f.arr_iata == arr_iata]
            if not matching_live:
                continue

        delay_rate_pct = round((stat.delay_rate or 0) * 100)
        avg_delay = round(stat.avg_delay_min or 0)
        h = avg_delay // 60
        m = avg_delay % 60
        avg_str = f"{h}h {m}m avg" if h > 0 else f"{m}m avg"

        suggestions.append(_make_suggestion(
            priority="medium" if delay_rate_pct >= 55 else "low",
            category="route_reliability",
            title=f"Route Alert — {stat.entity_key}",
            message=(
                f"Route {stat.entity_key} has a historical delay rate of {delay_rate_pct}% "
                f"({avg_str} delay across {stat.total_flights} recorded flights). "
                f"Flights on this route may carry elevated delay risk."
            ),
            recommended_action=(
                f"Consider flagging upcoming {stat.entity_key} departures for early monitoring. "
                f"Proactive gate assignment and pre-boarding communication may help."
            ),
            airport_iata=iata,
            route=stat.entity_key,
        ))

    # ── 5. AIRLINE RELIABILITY (from ae_aviation_stats) ─────────────────────
    airline_stats = (
        db.query(AEAviationStats)
        .filter(
            AEAviationStats.stat_type == "airline",
            AEAviationStats.delay_rate >= 0.45,
            AEAviationStats.total_flights >= 5,
        )
        .order_by(AEAviationStats.delay_rate.desc())
        .limit(2)
        .all()
    )

    for stat in airline_stats:
        delay_rate_pct = round((stat.delay_rate or 0) * 100)
        # Check if this airline has a flight today at this airport
        has_today = sum(1 for f in live_flights if f.airline_iata == stat.entity_key)
        
        if has_today > 0:
            suggestions.append(_make_suggestion(
                priority="low",
                category="airline_reliability",
                title=f"Airline Reliability Note — {stat.entity_key}",
                message=(
                    f"Airline {stat.entity_key} has a historical on-time performance concern "
                    f"({delay_rate_pct}% delay rate across {stat.total_flights} flights). "
                    f"They currently have {has_today} flight(s) operating at {airport_label} today."
                ),
                recommended_action=(
                    "Standard monitoring is recommended for today's operations. "
                    "Early ground handling coordination may help if delays emerge."
                ),
                airport_iata=iata,
            ))

    # ── 6. UNRECONCILED FLIGHTS (scheduled/delayed departure but no actual departure recorded) ─
    stalled_flights = [f for f in live_flights if f.direction == "departure" and not f.departed_at]

    for snap in stalled_flights:
        # Only flag if scheduled more than 90 minutes ago with no departure recorded
        if snap.dep_scheduled:
            dep_sched = snap.dep_scheduled
            age_min = (now.replace(tzinfo=None) - dep_sched).total_seconds() / 60
            if age_min > 90:
                suggestions.append(_make_suggestion(
                    priority="medium",
                    category="operational",
                    title=f"Delayed Departure Progression — {snap.flight_number}",
                    message=(
                        f"Flight {snap.flight_number} has been in '{snap.status}' status "
                        f"for over {int(age_min // 60)}h {int(age_min % 60)}m past its "
                        f"scheduled departure time, with no confirmed departure recorded. "
                        f"Ground coordination may be needed."
                    ),
                    recommended_action=(
                        "Verify flight progression status with ground operations. "
                        "Early passenger communication is advised if further delay is expected."
                    ),
                    flight_number=snap.flight_number,
                    airport_iata=iata,
                    route=f"{snap.dep_iata or iata} → {snap.arr_iata or '?'}",
                ))

    # ── Sort: high → medium → low ────────────────────────────────────────────
    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda s: priority_order.get(s["priority"], 3))

    return suggestions


@router.get("/ai-suggestions")
def get_ai_suggestions(
    date: Optional[str] = Query(None, description="Selected date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    AI Operational Suggestions for the authenticated admin's airport.
    Airport admins see their airport only. Super admins must use /ai-suggestions/all.
    All suggestions are generated from real DB conditions only — no hardcoded text.
    """
    # Determine target airport
    if current_user.role == "admin":
        iata = (current_user.airport_iata or "").strip().upper()
        if not iata:
            return _empty_response("TUN")
    else:
        # super_admin hitting this endpoint gets TUN by default
        iata = "TUN"

    suggestions = generate_suggestions_for_airport(iata, db, date)

    high = sum(1 for s in suggestions if s["priority"] == "high")
    medium = sum(1 for s in suggestions if s["priority"] == "medium")
    low = sum(1 for s in suggestions if s["priority"] == "low")

    return {
        "summary": {
            "totalSuggestions": len(suggestions),
            "highPriority": high,
            "mediumPriority": medium,
            "lowPriority": low,
            "airportIata": iata,
            "airportName": AIRPORT_NAMES.get(iata, iata),
            "generatedAt": _now_utc().isoformat(),
        },
        "suggestions": suggestions,
    }


@router.get("/ai-suggestions/all")
def get_all_airport_suggestions(
    airport_iata: Optional[str] = Query(None, description="Filter by airport IATA (TUN/MIR/DJE/NBE)"),
    priority: Optional[str] = Query(None, description="Filter by priority: high|medium|low"),
    date: Optional[str] = Query(None, description="Selected date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_super_admin),
):
    """
    Super admin: AI Operational Suggestions across all Tunisian airports.
    Optionally filtered by airport_iata or priority.
    All suggestions generated from real DB conditions only.
    """
    target_airports = (
        [airport_iata.upper()]
        if airport_iata and airport_iata.upper() in TUNISIAN_AIRPORTS
        else list(TUNISIAN_AIRPORTS)
    )

    all_suggestions: List[Dict[str, Any]] = []
    for iata in target_airports:
        airport_suggestions = generate_suggestions_for_airport(iata, db, date)
        all_suggestions.extend(airport_suggestions)

    if priority and priority in ("high", "medium", "low"):
        all_suggestions = [s for s in all_suggestions if s["priority"] == priority]

    priority_order = {"high": 0, "medium": 1, "low": 2}
    all_suggestions.sort(key=lambda s: priority_order.get(s["priority"], 3))

    high = sum(1 for s in all_suggestions if s["priority"] == "high")
    medium = sum(1 for s in all_suggestions if s["priority"] == "medium")
    low = sum(1 for s in all_suggestions if s["priority"] == "low")

    return {
        "summary": {
            "totalSuggestions": len(all_suggestions),
            "highPriority": high,
            "mediumPriority": medium,
            "lowPriority": low,
            "airportsScanned": target_airports,
            "generatedAt": _now_utc().isoformat(),
        },
        "suggestions": all_suggestions,
    }


def _empty_response(iata: str) -> dict:
    return {
        "summary": {
            "totalSuggestions": 0,
            "highPriority": 0,
            "mediumPriority": 0,
            "lowPriority": 0,
            "airportIata": iata,
            "airportName": AIRPORT_NAMES.get(iata, iata),
            "generatedAt": _now_utc().isoformat(),
        },
        "suggestions": [],
    }
