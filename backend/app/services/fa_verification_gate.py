"""
FA Verification Gate
====================
Decides whether FlightAware should be called for a given AEFlightSnapshot,
based on targeted conditions and per-flight cooldown rules.

This module replaces the generic `should_enrich()` function for scheduler-driven
calls and adds explicit reason logging so every FA call is traceable.

Public API
----------
  should_call_flightaware(snap, settings, now_utc) -> tuple[bool, str]
    Returns (True, reason_str) if FA must be called, or (False, "") otherwise.

Trigger conditions (ANY one is enough)
---------------------------------------
  1. needs_fa_verification == True           (flagged by AE ingestion)
  2. dep_actual is None + dep_scheduled > 20 min ago
  3. arr_actual is None + arr_scheduled > 30 min ago
  4. status == 'in_air' + arr_scheduled > 2 h ago
  5. status == 'scheduled' + dep_scheduled > 45 min ago (plane should have pushed back)
  6. gate AND terminal both empty + dep_scheduled within GATE_HORIZON_HOURS
  7. AE status conflicts with timestamps (e.g. status='scheduled' but arr_actual is set)

Cooldown rules (ALL must pass)
--------------------------------
  A. fa_last_called_at is None  OR  (now - fa_last_called_at) >= COOLDOWN_MINUTES
  B. status NOT in terminal set {'landed', 'cancelled', 'stale_unresolved'}
     UNLESS fa_call_count == 0  (allow one final call to confirm terminal status)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.ae_models import AEFlightSnapshot
    from app.config import Settings

logger = logging.getLogger(__name__)

_TERMINAL = {"landed", "cancelled", "stale_unresolved"}


def _tz(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def should_call_flightaware(
    snap: "AEFlightSnapshot",
    settings: "Settings",
    now_utc: datetime | None = None,
) -> tuple[bool, str]:
    """
    Returns (True, reason_string) if FlightAware should be called for this snapshot.
    Returns (False, "") otherwise.

    Parameters
    ----------
    snap     : AEFlightSnapshot ORM row
    settings : app.config.Settings (for cooldown/horizon values)
    now_utc  : current UTC datetime (defaults to datetime.now(UTC))
    """
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    status = (snap.status or "").lower()

    # ── Cooldown / terminal guards (must all pass before any trigger fires) ────

    # Guard A: per-flight cooldown
    fa_last = _tz(snap.fa_last_called_at)
    if fa_last is not None:
        cooldown = timedelta(minutes=settings.FLIGHTAWARE_COOLDOWN_MINUTES)
        if (now_utc - fa_last) < cooldown:
            return False, ""

    # Guard B: terminal status — only allow if this is the very first FA call
    if status in _TERMINAL:
        if (snap.fa_call_count or 0) > 0:
            return False, ""

    # ── Trigger conditions ────────────────────────────────────────────────────

    dep_sched = _tz(snap.dep_scheduled)
    arr_sched = _tz(snap.arr_scheduled)

    # Condition 1: explicitly flagged by AE ingestion
    if snap.needs_fa_verification:
        return True, "needs_fa_verification_flag"

    # Condition 2: dep_actual missing and dep was >20 min ago
    if snap.dep_actual is None and dep_sched is not None:
        if (now_utc - dep_sched).total_seconds() > 20 * 60:
            return True, "ae_dep_actual_missing"

    # Condition 3: arr_actual missing and arr was >30 min ago
    if snap.arr_actual is None and arr_sched is not None:
        if status not in ("scheduled", "delayed"):  # only relevant for in-progress flights
            if (now_utc - arr_sched).total_seconds() > 30 * 60:
                return True, "ae_arr_actual_missing"

    # Condition 4: in_air but arr_scheduled > 2 h ago (should have landed)
    if status == "in_air" and arr_sched is not None:
        if (now_utc - arr_sched).total_seconds() > 2 * 3600:
            return True, "in_air_past_arrival_2h"

    # Condition 5: still 'scheduled' but dep was >45 min ago
    if status == "scheduled" and dep_sched is not None:
        if (now_utc - dep_sched).total_seconds() > 45 * 60:
            return True, "scheduled_past_dep_45min"

    # Condition 6: gate AND terminal both missing, and dep is within gate horizon
    has_gate = bool(snap.dep_gate or snap.arr_gate or snap.fa_dep_gate or snap.fa_arr_gate)
    if not has_gate and dep_sched is not None:
        gate_horizon = timedelta(hours=settings.FLIGHTAWARE_GATE_HORIZON_HOURS)
        if abs((dep_sched - now_utc).total_seconds()) < gate_horizon.total_seconds():
            return True, "gate_terminal_missing"

    # Condition 7: AE status conflicts with timestamps (defensive sanity check)
    if status == "scheduled" and snap.arr_actual is not None:
        return True, "ae_status_conflict_arr_actual_set"

    return False, ""
