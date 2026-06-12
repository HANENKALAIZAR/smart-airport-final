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
  GET  /api/admin/ai-suggestions             – Airport admin: pending suggestions for their airport
  GET  /api/admin/ai-suggestions/decisions   – Airport admin: past decisions for their airport
  POST /api/admin/ai-suggestions/decide      – Airport admin: approve / reject a suggestion
  GET  /api/admin/ai-suggestions/all         – Super admin: approved suggestions across all airports

Priority rules:
  HIGH   – predicted delay >= 60 min | multiple simultaneous delays | repeated disruption
  MEDIUM – predicted delay >= 30 min | congestion risk | operational coordination needed
  LOW    – minor flow improvements | monitoring recommendations
"""

import json
import logging
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List, Dict, Any, Set

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin, require_super_admin
from app.models.models import User, AISuggestionDecision, AIAlert as AIAlertModel
from app.schemas.schemas import DecideSuggestionBody
from app.models.ae_models import (
    AEFlightSnapshot,
    AEFlightDataset,
    AEFutureSchedule,
    AEAviationStats,
)
from app.services.in_app_notify import notify_all_super_admins
from app.services.email_service import AIRPORT_DISPLAY

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


def _today_str() -> str:
    return _now_utc().strftime("%Y-%m-%d")


def _make_suggestion_key(
    date_str: str,
    category: str,
    airport_iata: str,
    flight_number: Optional[str] = None,
    route: Optional[str] = None,
) -> str:
    """Build a stable, deterministic suggestion key.

    Format: {date}:{category}:{airport}:{flight_number}:{route}
    This ensures the same operational condition produces the same key
    so approve/reject decisions persist across page refreshes.
    """
    fn = (flight_number or "").strip()
    rt = (route or "").strip()
    return f"{date_str}:{category}:{airport_iata}:{fn}:{rt}"


def _load_decided_keys(db: Session, airport_iata: str, date_str: str) -> Set[str]:
    """Load all suggestion_keys that have been decided (approved/rejected)
    for this airport+date so they can be excluded from pending suggestions."""
    rows = (
        db.query(AISuggestionDecision.suggestion_key)
        .filter(
            AISuggestionDecision.airport_iata == airport_iata,
            AISuggestionDecision.suggestion_key.like(f"{date_str}:%"),
        )
        .all()
    )
    return {r[0] for r in rows}


def _make_suggestion(
    *,
    date_str: str,
    priority: str,
    title: str,
    message: str,
    recommended_action: str,
    flight_number: Optional[str] = None,
    airport_iata: Optional[str] = None,
    route: Optional[str] = None,
    predicted_delay: Optional[int] = None,
    category: str = "operational",
    structured: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    key = _make_suggestion_key(date_str, category, airport_iata or "", flight_number, route)
    return {
        "id": str(uuid.uuid4()),
        "key": key,
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
        "structured": structured or {},
    }


def generate_suggestions_for_airport(
    airport_iata: str,
    db: Session,
    date_str: Optional[str] = None,
    decided_keys: Optional[Set[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Generate all AI Operational Suggestions for a specific airport.
    All logic is driven exclusively from real DB data.
    Returns a sorted list (high → medium → low).
    """
    suggestions: List[Dict[str, Any]] = []

    if date_str:
        try:
            today = datetime.strptime(date_str, "%Y-%m-%d").date()
            date_str = today.strftime("%Y-%m-%d")
        except ValueError:
            today = _now_utc().date()
            date_str = _today_str()
    else:
        today = _now_utc().date()
        date_str = _today_str()

    now = _now_utc()
    if today != now.date():
        now = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    current_hour = now.hour

    iata = airport_iata.upper()
    airport_label = AIRPORT_NAMES.get(iata, iata)

    OPERATIONAL_STATUSES = ["scheduled", "delayed", "in_air"]

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

    def _is_decided(key: str) -> bool:
        if decided_keys is None:
            return False
        return key in decided_keys

    # ── 1. LIVE DELAYED FLIGHTS ─────────────────────────────────
    # Detect delayed flights by actual delay_minutes (>= 15 = standard aviation threshold),
    # not by status field. A flight can show delay_minutes > 0 while status is still
    # "scheduled" (hasn't departed yet) or "in_air" (accumulated delay during flight).
    DELAY_THRESHOLD_MIN = 15
    delayed_today = [
        f for f in live_flights
        if (f.delay_minutes or f.dep_delay_min or f.arr_delay_min or 0) >= DELAY_THRESHOLD_MIN
    ]
    delayed_today.sort(key=lambda f: f.delay_minutes or f.dep_delay_min or f.arr_delay_min or 0, reverse=True)

    # ── 1a. Severely delayed individual flights ─────────────────
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

            # Historical route performance for richer context
            route_stat = (
                db.query(AEAviationStats)
                .filter(
                    AEAviationStats.stat_type == "route",
                    AEAviationStats.entity_key == route.replace(" → ", "→"),
                )
                .first()
            )
            hist_note = ""
            if route_stat and route_stat.delay_rate and route_stat.delay_rate >= 0.30:
                hist_note = f" This route historically delays {round(route_stat.delay_rate * 100)}% of the time."

            # Count of concurrent delayed flights for congestion context
            other_delays = len([f for f in delayed_today if f.flight_number != snap.flight_number])

            key = _make_suggestion_key(date_str, "delay", iata, snap.flight_number, route)
            if _is_decided(key):
                continue

            suggestions.append(_make_suggestion(
                date_str=date_str,
                priority="high",
                category="delay",
                title=f"Significant Delay — {snap.flight_number}",
                message=(
                    f"Flight {snap.flight_number} ({route}) is showing a "
                    f"{delay_str} {direction_label} delay{gate_ctx}. "
                    f"{other_delays} other flight(s) are also delayed.{hist_note}"
                    f" Monitor gate occupancy." if not gate else (
                    f" Consider gate reassignment if Gate {gate} will be occupied "
                    f"past the next scheduled turn."
                    )
                ),
                recommended_action=(
                    f"If Gate {gate} is available, reassign to free the stand for the next turnaround. "
                    f"Notify ground handling teams and communicate updated boarding time to passengers via the information system."
                ) if gate else (
                    "Notify ground handling teams of the updated schedule. "
                    "Communicate updated boarding time to passengers via the information system."
                ),
                flight_number=snap.flight_number,
                airport_iata=iata,
                route=route,
                predicted_delay=delay,
                structured={
                    "delay_minutes": delay,
                    "direction": snap.direction,
                    "gate": gate or None,
                    "terminal": terminal or None,
                    "other_delays_count": other_delays,
                    "has_hist_note": bool(hist_note),
                    "hist_delay_rate": round(route_stat.delay_rate, 2) if route_stat and route_stat.delay_rate else None,
                },
            ))

    # ── 1b. Multiple simultaneous delays ────────────────────────
    if len(delayed_today) >= 3:
        dep_delays = [s for s in delayed_today if s.direction == "departure"]
        arr_delays = [s for s in delayed_today if s.direction == "arrival"]

        delayed_flight_list = []
        for s in delayed_today[:5]:
            d = s.delay_minutes or s.dep_delay_min or s.arr_delay_min or 0
            delayed_flight_list.append(f"{s.flight_number} (+{d}min)")

        key = _make_suggestion_key(date_str, "coordination", iata, "", "")
        if not _is_decided(key):
            suggestions.append(_make_suggestion(
                date_str=date_str,
                priority="high",
                category="coordination",
                title="Multiple Concurrent Delays — Coordination Recommended",
                message=(
                    f"{len(delayed_today)} flights are currently delayed at {airport_label} "
                    f"({len(dep_delays)} departures, {len(arr_delays)} arrivals). "
                    f"Affected flights: {', '.join(delayed_flight_list)}. "
                    f"Cascading delays across multiple gates may increase passenger congestion in waiting areas."
                ),
                recommended_action=(
                    "Activate cross-team coordination between boarding, baggage handling, and ground operations. "
                    "Consider proactive passenger communication across all delayed flights simultaneously. "
                    "Monitor gate allocation to minimize stand conflicts."
                ),
                airport_iata=iata,
                structured={
                    "delayed_count": len(delayed_today),
                    "dep_count": len(dep_delays),
                    "arr_count": len(arr_delays),
                },
            ))

    elif len(delayed_today) == 2:
        key = _make_suggestion_key(date_str, "coordination", iata, "", "")
        if not _is_decided(key):
            suggestions.append(_make_suggestion(
                date_str=date_str,
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
                structured={
                    "delayed_count": 2,
                },
            ))

    # ── 2. PEAK HOUR CONGESTION ─────────────────────────────────
    is_peak = current_hour in PEAK_HOURS
    if is_peak:
        window_start = now.replace(tzinfo=None)
        window_end = (now + timedelta(hours=2)).replace(tzinfo=None)

        departing_in_window = [
            f for f in live_flights
            if f.direction == "departure"
            and f.dep_scheduled is not None
            and window_start <= f.dep_scheduled <= window_end
        ]
        arriving_in_window = [
            f for f in live_flights
            if f.direction == "arrival"
            and f.arr_scheduled is not None
            and window_start <= f.arr_scheduled <= window_end
        ]
        active_in_window = len(departing_in_window) + len(arriving_in_window)

        if active_in_window >= 8:
            # Count unique gates in use
            active_gates = len({f.dep_gate or f.arr_gate for f in departing_in_window + arriving_in_window if f.dep_gate or f.arr_gate})

            key = _make_suggestion_key(date_str, "congestion", iata, "", "")
            if not _is_decided(key):
                suggestions.append(_make_suggestion(
                    date_str=date_str,
                    priority="high",
                    category="congestion",
                    title=f"Peak Hour — High Passenger Volume Expected ({current_hour:02d}:00)",
                    message=(
                        f"{active_in_window} flights scheduled within the next 2 hours at {airport_label} "
                        f"({len(departing_in_window)} departures, {len(arriving_in_window)} arrivals). "
                        f"{f'{active_gates} gates active. ' if active_gates else ''}"
                        f"Expect elevated passenger density near security and boarding areas during "
                        f"{current_hour:02d}:00–{(current_hour + 2) % 24:02d}:00."
                    ),
                    recommended_action=(
                        f"Consider opening an additional boarding gate and assigning extra passenger assistance staff. "
                        f"Deploy queue monitors to security checkpoints. "
                        f"Pre-announce boarding groups to reduce gate-area congestion."
                    ),
                    airport_iata=iata,
                    structured={
                        "current_hour": current_hour,
                        "active_in_window": active_in_window,
                        "dep_count": len(departing_in_window),
                        "arr_count": len(arriving_in_window),
                        "active_gates": active_gates,
                    },
                ))
        elif active_in_window >= 5:
            key = _make_suggestion_key(date_str, "congestion", iata, "", "")
            if not _is_decided(key):
                suggestions.append(_make_suggestion(
                    date_str=date_str,
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
                        "may improve passenger flow during this period. "
                        "Consider pre-boarding announcements to distribute passenger load."
                    ),
                    airport_iata=iata,
                    structured={
                        "current_hour": current_hour,
                        "active_in_window": active_in_window,
                        "dep_count": len(departing_in_window),
                        "arr_count": len(arriving_in_window),
                    },
                ))
        elif active_in_window >= 3:
            key = _make_suggestion_key(date_str, "congestion", iata, "", "")
            if not _is_decided(key):
                suggestions.append(_make_suggestion(
                    date_str=date_str,
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
                    structured={
                        "current_hour": current_hour,
                        "active_in_window": active_in_window,
                        "dep_count": len(departing_in_window),
                        "arr_count": len(arriving_in_window),
                    },
                ))

    # ── 3. PREDICTED FUTURE DELAYS (from ae_future_schedules) ────
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

    for sched in predicted_high:
        delay = sched.predicted_delay_min or 0
        conf = round((sched.confidence or 0.5) * 100)
        route = f"{sched.dep_iata or iata} → {sched.arr_iata or '?'}"
        dep_time = sched.scheduled_departure.strftime("%H:%M") if sched.scheduled_departure else "?"
        h = delay // 60
        m = delay % 60
        delay_str = f"{h}h {m}m" if h > 0 else f"{m}m"
        priority = "high" if delay >= 60 else "medium"

        # Look up live snapshot for gate/terminal enrichment if available
        live_match = None
        if sched.flight_number:
            live_match = (
                db.query(AEFlightSnapshot)
                .filter(
                    AEFlightSnapshot.airport_iata == iata,
                    AEFlightSnapshot.flight_number == sched.flight_number,
                    AEFlightSnapshot.snapshot_date == today,
                    AEFlightSnapshot.status.in_(OPERATIONAL_STATUSES),
                )
                .first()
            )

        gate_ctx = ""
        gate = None
        terminal = None
        if live_match:
            gate = live_match.dep_gate or live_match.arr_gate
            terminal = live_match.dep_terminal or live_match.arr_terminal
            if gate:
                gate_ctx = f" Currently assigned to Gate {gate}."
            elif terminal:
                gate_ctx = f" Currently in Terminal {terminal}."

        # Historical route context
        route_stat = (
            db.query(AEAviationStats)
            .filter(
                AEAviationStats.stat_type == "route",
                AEAviationStats.entity_key == route.replace(" → ", "→"),
            )
            .first()
        )
        hist_note = ""
        if route_stat and route_stat.delay_rate and route_stat.delay_rate >= 0.30:
            hist_note = f" This route has a {round(route_stat.delay_rate * 100)}% historical delay rate."

        key = _make_suggestion_key(date_str, "prediction", iata, sched.flight_number, route)
        if _is_decided(key):
            continue

        suggestions.append(_make_suggestion(
            date_str=date_str,
            priority=priority,
            category="prediction",
            title=f"ML Delay Prediction — {sched.flight_number}",
            message=(
                f"The ML model estimates a {delay_str} delay for flight "
                f"{sched.flight_number} ({route}) departing at {dep_time} "
                f"(confidence: {conf}%).{gate_ctx}{hist_note}"
            ),
            recommended_action=(
                f"Flight {sched.flight_number} predicted delay {delay_str}. "
                f"Consider reassigning gate and notifying ground handling teams proactively."
                if gate_ctx else
                "Early passenger communication is recommended. "
                "Consider coordinating ground operations proactively if the delay materialises."
            ),
            flight_number=sched.flight_number,
            airport_iata=iata,
            route=route,
            predicted_delay=delay,
            structured={
                "predicted_delay_min": delay,
                "confidence": conf,
                "scheduled_departure": dep_time,
                "gate": gate or None,
                "terminal": terminal or None,
                "has_hist_note": bool(hist_note),
                "hist_delay_rate": round(route_stat.delay_rate, 2) if route_stat and route_stat.delay_rate else None,
            },
        ))

    # ── 4. ROUTE RELIABILITY ────────────────────────────────────
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
        if len(parts) != 2:
            continue
        dep_iata, arr_iata = parts[0], parts[1]
        matching_live = [f for f in live_flights if f.dep_iata == dep_iata and f.arr_iata == arr_iata]

        delay_rate_pct = round((stat.delay_rate or 0) * 100)
        avg_delay = round(stat.avg_delay_min or 0)
        h = avg_delay // 60
        m = avg_delay % 60
        avg_str = f"{h}h {m}m avg" if h > 0 else f"{m}m avg"

        today_count = len(matching_live)
        if today_count == 0:
            continue

        key = _make_suggestion_key(date_str, "route_reliability", iata, "", stat.entity_key)
        if _is_decided(key):
            continue

        suggestions.append(_make_suggestion(
            date_str=date_str,
            priority="medium" if delay_rate_pct >= 55 else "low",
            category="route_reliability",
            title=f"Route Alert — {stat.entity_key}",
            message=(
                f"Route {stat.entity_key} has a {delay_rate_pct}% historical delay rate "
                f"({avg_str} across {stat.total_flights} recorded flights). "
                f"{today_count} flight(s) on this route are operating today at {airport_label}. "
                f"These flights may carry elevated delay risk."
            ),
            recommended_action=(
                f"Increase monitoring of turnaround operations for {stat.entity_key} flights. "
                f"Flag upcoming departures for priority gate assignment to expedite boarding."
            ),
            airport_iata=iata,
            route=stat.entity_key,
            structured={
                "delay_rate_pct": delay_rate_pct,
                "avg_delay_min": avg_delay,
                "total_flights": stat.total_flights or 0,
                "today_count": today_count,
            },
        ))

    # ── 5. AIRLINE RELIABILITY ──────────────────────────────────
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
        has_today = sum(1 for f in live_flights if f.airline_iata == stat.entity_key)

        if has_today > 0:
            key = _make_suggestion_key(date_str, "airline_reliability", iata, stat.entity_key, "")
            if _is_decided(key):
                continue

            suggestions.append(_make_suggestion(
                date_str=date_str,
                priority="medium" if delay_rate_pct >= 60 else "low",
                category="airline_reliability",
                title=f"Airline Reliability — {stat.entity_key}",
                message=(
                    f"Airline {stat.entity_key} has a {delay_rate_pct}% delay rate "
                    f"across {stat.total_flights} historical flights and "
                    f"{has_today} active flight(s) at {airport_label} today. "
                    f"Increase monitoring of turnaround operations to preempt compounding delays."
                ),
                recommended_action=(
                    f"Assign a ground coordinator to monitor {stat.entity_key} turnaround operations. "
                    f"Prioritise quick-turn procedures for their departures."
                ),
                airport_iata=iata,
                structured={
                    "delay_rate_pct": delay_rate_pct,
                    "total_flights": stat.total_flights or 0,
                    "today_count": has_today,
                },
            ))

    # ── 6. UNRECONCILED / STALLED DEPARTURES ────────────────────
    stalled_flights = [f for f in live_flights if f.direction == "departure" and not f.departed_at]

    for snap in stalled_flights:
        if snap.dep_scheduled:
            dep_sched = snap.dep_scheduled
            age_min = (now.replace(tzinfo=None) - dep_sched).total_seconds() / 60
            if age_min > 90:
                route = f"{snap.dep_iata or iata} → {snap.arr_iata or '?'}"
                key = _make_suggestion_key(date_str, "operational", iata, snap.flight_number, route)
                if _is_decided(key):
                    continue

                suggestions.append(_make_suggestion(
                    date_str=date_str,
                    priority="medium",
                    category="operational",
                    title=f"Delayed Departure — {snap.flight_number}",
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
                    route=route,
                    structured={
                        "age_minutes": int(age_min),
                        "status": snap.status,
                    },
                ))

    # ── Sort: high → medium → low ───────────────────────────────
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
    Airport admins see their airport only.
    Only pending suggestions (not yet approved/rejected) are returned.
    """
    if current_user.role == "admin":
        iata = (current_user.airport_iata or "").strip().upper()
        if not iata:
            return _empty_response("TUN")
    else:
        iata = "TUN"

    date_str = date or _today_str()

    # Load already-decided keys so they are excluded from pending
    decided_keys = _load_decided_keys(db, iata, date_str)

    suggestions = generate_suggestions_for_airport(iata, db, date_str, decided_keys=decided_keys)

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


@router.get("/ai-suggestions/decisions")
def list_suggestion_decisions(
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Return all approved/rejected Suggestion decisions for this admin's airport.
    The frontend uses these to restore decision state after page refresh.
    """
    if current_user.role == "admin":
        iata = (current_user.airport_iata or "").strip().upper()
        if not iata:
            return []
    else:
        iata = "TUN"

    q = db.query(AISuggestionDecision).filter(AISuggestionDecision.airport_iata == iata)
    if date:
        q = q.filter(AISuggestionDecision.suggestion_key.like(f"{date}:%"))

    rows = q.order_by(AISuggestionDecision.timestamp.desc()).limit(200).all()

    results = []
    for r in rows:
        admin_name = None
        if r.admin_user_id:
            admin_user = db.query(User).filter(User.id == r.admin_user_id).first()
            admin_name = admin_user.full_name if admin_user else None
        results.append({
            "id": r.id,
            "suggestionKey": r.suggestion_key,
            "airportIata": r.airport_iata,
            "suggestionType": r.suggestion_type,
            "status": r.status,
            "adminUserId": r.admin_user_id,
            "adminName": admin_name,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "suggestionPayload": r.suggestion_payload,
        })

    return results


@router.post("/ai-suggestions/decide", status_code=200)
def decide_suggestion(
    body: DecideSuggestionBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Record an approve or reject decision for a suggestion.
    - Approved: persists in AISuggestionDecision + creates AIAlert + notifies super admins
    - Rejected: persists in AISuggestionDecision only (no notification)
    """
    # Only airport admins may approve/reject; super admins monitor only
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only airport admins can approve or reject suggestions.")

    suggestion_key = body.suggestion_key.strip()
    airport_iata = body.airport_iata.upper()
    suggestion_type = body.suggestion_type
    status = body.status
    payload = body.suggestion_payload or {}

    # Verify admin is associated with this airport
    if current_user.role == "admin":
        admin_airport = (current_user.airport_iata or "").strip().upper()
        if admin_airport != airport_iata:
            raise HTTPException(status_code=403, detail="You can only manage suggestions for your own airport.")

    # Upsert: if a decision already exists for this key, update it
    existing = (
        db.query(AISuggestionDecision)
        .filter(AISuggestionDecision.suggestion_key == suggestion_key)
        .first()
    )
    if existing:
        existing.status = status
        existing.admin_user_id = current_user.id
        existing.timestamp = _now_utc()
        if payload:
            existing.suggestion_payload = payload
        db.commit()
    else:
        decision = AISuggestionDecision(
            suggestion_key=suggestion_key,
            airport_iata=airport_iata,
            suggestion_type=suggestion_type,
            status=status,
            admin_user_id=current_user.id,
            timestamp=_now_utc(),
            suggestion_payload=payload,
        )
        db.add(decision)
        db.commit()

    # ── On approval: create AIAlert + notify super admins ──────
    if status == "approved":
        airport_name = AIRPORT_DISPLAY.get(airport_iata, airport_iata)
        fn = (payload.get("flightNumber") or "").strip() or "Flight"
        route = (payload.get("route") or "").strip() or "—"
        delay_str = ""
        pd = payload.get("predictedDelay")
        if pd and pd > 0:
            h = pd // 60
            m = pd % 60
            delay_str = f"{h}h {m}m" if h > 0 else f"{m}m"
        rec = (payload.get("recommendedAction") or payload.get("message") or "").strip() or "—"

        alert = AIAlertModel(
            id=str(uuid.uuid4()),
            flight_number=fn,
            airport_iata=airport_iata,
            airport_name=airport_name,
            risk_pct=85 if payload.get("priority") == "high" else (55 if payload.get("priority") == "medium" else 25),
            cause=(payload.get("message") or "").strip() or "—",
            recommendation=rec,
            decision="approved",
            acted_by_admin_id=current_user.id,
            decided_at=_now_utc(),
            created_at=_now_utc(),
            route=route,
            delay_formatted=delay_str or None,
        )
        db.add(alert)

        # Notify all super admins
        admin_name = current_user.full_name
        notify_body = (
            f"Admin {admin_name} from {airport_name} approved an AI operational recommendation.\n\n"
            f"Suggestion: {suggestion_type}\n"
            f"Flight: {fn}\n"
            f"Route: {route}\n"
            f"Delay: {delay_str or '—'}\n"
            f"Recommendation: {rec}"
        )
        notify_all_super_admins(
            db,
            kind="ai_alert_approved",
            body=notify_body,
            context={
                "suggestion_key": suggestion_key,
                "suggestion_type": suggestion_type,
                "flight_number": fn,
                "action": "approved",
                "admin_name": admin_name,
                "admin_id": current_user.id,
                "airport_iata": airport_iata,
                "airport_name": airport_name,
                "route": route,
                "delay_formatted": delay_str,
                "recommendation": rec,
            },
        )
        db.commit()

    return {"ok": True, "status": status}


@router.get("/ai-suggestions/all")
def get_all_airport_suggestions(
    airport_iata: Optional[str] = Query(None, description="Filter by airport IATA (TUN/MIR/DJE/NBE)"),
    priority: Optional[str] = Query(None, description="Filter by priority: high|medium|low"),
    date: Optional[str] = Query(None, description="Selected date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_super_admin),
):
    """
    Super admin: returns APPROVED suggestions only, sourced from the
    persisted decisions table. Raw pending suggestions are NEVER shown
    to super admins — only those reviewed and approved by airport admins.
    """
    target_airports = (
        [airport_iata.upper()]
        if airport_iata and airport_iata.upper() in TUNISIAN_AIRPORTS
        else list(TUNISIAN_AIRPORTS)
    )

    date_str = date or _today_str()

    q = db.query(AISuggestionDecision).filter(
        AISuggestionDecision.status == "approved",
        AISuggestionDecision.airport_iata.in_(target_airports),
        AISuggestionDecision.suggestion_key.like(f"{date_str}:%"),
    )

    rows = q.order_by(AISuggestionDecision.timestamp.desc()).limit(500).all()

    all_suggestions = []
    for r in rows:
        admin_name = None
        if r.admin_user_id:
            admin_user = db.query(User).filter(User.id == r.admin_user_id).first()
            admin_name = admin_user.full_name if admin_user else None

        item = {
            "id": str(uuid.uuid4()),
            "key": r.suggestion_key,
            "priority": (r.suggestion_payload or {}).get("priority", "medium"),
            "category": r.suggestion_type,
            "title": (r.suggestion_payload or {}).get("title", f"Approved {r.suggestion_type}"),
            "message": (r.suggestion_payload or {}).get("message", ""),
            "recommendedAction": (r.suggestion_payload or {}).get("recommendedAction", ""),
            "flightNumber": (r.suggestion_payload or {}).get("flightNumber"),
            "airportIata": r.airport_iata,
            "route": (r.suggestion_payload or {}).get("route"),
            "predictedDelay": (r.suggestion_payload or {}).get("predictedDelay"),
            "createdAt": r.timestamp.isoformat() if r.timestamp else None,
            "source": "AI Operational Intelligence (Approved)",
            "approvedBy": admin_name,
            "approvedAt": r.timestamp.isoformat() if r.timestamp else None,
        }
        all_suggestions.append(item)

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
