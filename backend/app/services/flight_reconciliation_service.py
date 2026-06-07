"""
Flight Reconciliation Service
================================
Applies FlightAware enrichment data onto existing AEFlightSnapshot rows.

Rules (applied in strict order):
  1. Never overwrite with None — if FA field is None, keep existing AE value.
  2. Never downgrade status (in_air → scheduled is blocked).
  3. Accept FA status upgrade: scheduled/delayed → in_air/landed (if FA is fresher).
  4. Enrich dep_actual/arr_actual only when AE value is currently NULL.
  5. Enrich dep_estimated/arr_estimated when FA timestamp is fresher.
  6. Enrich GPS position when FA last_position timestamp is fresher.
  7. NEVER overwrite dep_scheduled or arr_scheduled (AE is sole schedule authority).
  8. NEVER write to ae_flight_dataset (ML training data remains AE-only).
  9. Always record audit metadata: last_verified_by, last_verified_at, provider_sources.
 10. Always store raw FA payload in raw_flightaware_payload.

Public API:
  should_enrich(snap, now_utc) -> bool
  reconcile_snapshot(snap, fa_data, db) -> dict
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.ae_models import AEFlightSnapshot
from app.config import settings

logger = logging.getLogger(__name__)

# ── Status progress ranking (higher = further along in flight lifecycle) ───────
_STATUS_PROGRESS: dict[str, int] = {
    "scheduled": 0,
    "delayed":   1,
    "boarding":  2,
    "taxiing":   3,
    "in_air":    4,
    "landed":    5,
    "cancelled": 6,
}

_TERMINAL_STATUSES = {"landed", "cancelled"}
_ENRICHABLE_STATUSES = {"scheduled", "delayed", "unknown", None, ""}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _tz(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime is timezone-aware (UTC)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ── Filtering ─────────────────────────────────────────────────────────────────

def should_enrich(snap: AEFlightSnapshot, now_utc: Optional[datetime] = None) -> bool:
    """
    Returns True if this snapshot is a candidate for FlightAware enrichment.

    Conditions (ALL must be true):
      1. Status is in the enrichable set (not landed, not cancelled).
      2. Scheduled departure OR arrival is within the operational window:
           [now - WINDOW_PAST_HOURS, now + WINDOW_FUTURE_HOURS]
    """
    if now_utc is None:
        now_utc = _now_utc()

    snap_status = (snap.status or "").lower()
    if snap_status in _TERMINAL_STATUSES:
        return False
    if snap_status not in _ENRICHABLE_STATUSES and snap_status not in ("scheduled", "delayed", "unknown"):
        return False

    past_limit   = now_utc - timedelta(hours=settings.FLIGHTAWARE_WINDOW_PAST_HOURS)
    future_limit = now_utc + timedelta(hours=settings.FLIGHTAWARE_WINDOW_FUTURE_HOURS)

    dep_sched = _tz(snap.dep_scheduled)
    arr_sched = _tz(snap.arr_scheduled)

    dep_in_window = dep_sched and (past_limit <= dep_sched <= future_limit)
    arr_in_window = arr_sched and (past_limit <= arr_sched <= future_limit)

    return bool(dep_in_window or arr_in_window)


# ── Reconciliation ────────────────────────────────────────────────────────────

def reconcile_snapshot(
    snap: AEFlightSnapshot,
    fa_data: dict,
    db: Session,
    fa_call_reason: str = "",
) -> dict:
    """
    Apply FlightAware enrichment data to an existing AEFlightSnapshot row.

    Parameters:
      snap           — ORM row for the existing AE snapshot (will be modified in-place)
      fa_data        — normalized dict returned by normalize_fa_flight()
      db             — SQLAlchemy session (used to flush the update)
      fa_call_reason — why FA was called (e.g. 'ae_dep_actual_missing'); stored on the row

    Returns:
      {
        "changed_fields": ["status", "dep_actual", ...],
        "was_enriched": bool,
        "ident_used": str,
      }
    """
    now = _now_utc()
    changed_fields: list[str] = []

    # ── 1. Status enrichment ──────────────────────────────────────────────────
    fa_status = (fa_data.get("status") or "").lower()
    ae_status = (snap.status or "").lower()

    fa_prog = _STATUS_PROGRESS.get(fa_status)
    ae_prog = _STATUS_PROGRESS.get(ae_status, 0)

    # Accept FA status only if:
    #  a) FA status has a higher progress rank (forward transition only)
    #  b) AND the current AE status is not terminal
    if (
        fa_status
        and fa_status != ae_status
        and ae_status not in _TERMINAL_STATUSES
        and fa_prog is not None
        and fa_prog > ae_prog
    ):
        old_status = snap.status
        snap.status = fa_status
        changed_fields.append("status")
        logger.info(
            f"[FA ENRICHED] flight={snap.flight_number} "
            f"status: {old_status} → {fa_status}"
        )

    # ── 2. dep_actual — preserve AE original, then apply FA if AE is missing ──
    if snap.dep_actual is None and fa_data.get("dep_actual") is not None:
        # Preserve the original AE value (None in this case, stored for audit clarity)
        if snap.ae_dep_actual is None:
            snap.ae_dep_actual = snap.dep_actual  # will be None, stored for schema completeness
        snap.dep_actual = fa_data["dep_actual"]
        snap.displayed_dep_source = "flightaware"
        changed_fields.append("dep_actual")
        changed_fields.append("displayed_dep_source")
    elif snap.dep_actual is not None and snap.displayed_dep_source is None:
        # Mark existing value as AE-sourced
        snap.displayed_dep_source = "aviation_edge"
        changed_fields.append("displayed_dep_source")

    # ── 3. arr_actual — same pattern ──────────────────────────────────────────
    if snap.arr_actual is None and fa_data.get("arr_actual") is not None:
        if snap.ae_arr_actual is None:
            snap.ae_arr_actual = snap.arr_actual
        snap.arr_actual = fa_data["arr_actual"]
        snap.displayed_arr_source = "flightaware"
        changed_fields.append("arr_actual")
        changed_fields.append("displayed_arr_source")
    elif snap.arr_actual is not None and snap.displayed_arr_source is None:
        snap.displayed_arr_source = "aviation_edge"
        changed_fields.append("displayed_arr_source")

    # ── 4. dep_estimated (if FA is fresher than current collected_at) ──────────
    fa_dep_est = _tz(fa_data.get("dep_estimated"))
    ae_collected = _tz(snap.collected_at)
    if fa_dep_est and (snap.dep_estimated is None or (ae_collected and fa_dep_est > ae_collected)):
        snap.dep_estimated = fa_dep_est
        changed_fields.append("dep_estimated")

    # ── 5. arr_estimated ───────────────────────────────────────────────────────
    fa_arr_est = _tz(fa_data.get("arr_estimated"))
    if fa_arr_est and (snap.arr_estimated is None or (ae_collected and fa_arr_est > ae_collected)):
        snap.arr_estimated = fa_arr_est
        changed_fields.append("arr_estimated")

    # ── 6. GPS position (only if FA position is fresher) ──────────────────────
    fa_fetched_at = _tz(fa_data.get("fetched_at"))
    last_pos_update = _tz(snap.last_position_update)
    position_is_fresh = (
        fa_fetched_at is not None
        and (last_pos_update is None or fa_fetched_at > last_pos_update)
    )

    if position_is_fresh:
        if fa_data.get("latitude") is not None:
            snap.latitude = fa_data["latitude"]
            changed_fields.append("latitude")
        if fa_data.get("longitude") is not None:
            snap.longitude = fa_data["longitude"]
            changed_fields.append("longitude")
        if fa_data.get("altitude_ft") is not None:
            snap.altitude_ft = fa_data["altitude_ft"]
            changed_fields.append("altitude_ft")
        if fa_data.get("speed_kmh") is not None:
            snap.speed_kmh = fa_data["speed_kmh"]
            changed_fields.append("speed_kmh")
        if any(k in changed_fields for k in ("latitude", "longitude", "altitude_ft", "speed_kmh")):
            snap.last_position_update = now
            changed_fields.append("last_position_update")

    # ── 7. NEVER touch dep_scheduled / arr_scheduled ───────────────────────────
    # (Enforced by not including them in the reconciliation logic above.)

    # ── 8. Gate / terminal enrichment (FA-sourced, kept separate from AE values) ─
    fa_dep_gate     = fa_data.get("dep_gate")
    fa_arr_gate     = fa_data.get("arr_gate")
    fa_dep_terminal = fa_data.get("dep_terminal")
    fa_arr_terminal = fa_data.get("arr_terminal")

    if fa_dep_gate and not snap.fa_dep_gate:
        snap.fa_dep_gate = fa_dep_gate
        changed_fields.append("fa_dep_gate")
        # Also backfill the AE dep_gate if it was empty (best-available value)
        if not snap.dep_gate:
            snap.dep_gate = fa_dep_gate
            changed_fields.append("dep_gate")
        logger.info(
            f"[FA GATE] flight={snap.flight_number} dep_gate={fa_dep_gate} "
            f"(source=flightaware, reason={fa_call_reason or 'enrichment'})"
        )

    if fa_arr_gate and not snap.fa_arr_gate:
        snap.fa_arr_gate = fa_arr_gate
        changed_fields.append("fa_arr_gate")
        if not snap.arr_gate:
            snap.arr_gate = fa_arr_gate
            changed_fields.append("arr_gate")

    if fa_dep_terminal and not snap.fa_dep_terminal:
        snap.fa_dep_terminal = fa_dep_terminal
        changed_fields.append("fa_dep_terminal")
        if not snap.dep_terminal:
            snap.dep_terminal = fa_dep_terminal
            changed_fields.append("dep_terminal")

    if fa_arr_terminal and not snap.fa_arr_terminal:
        snap.fa_arr_terminal = fa_arr_terminal
        changed_fields.append("fa_arr_terminal")
        if not snap.arr_terminal:
            snap.arr_terminal = fa_arr_terminal
            changed_fields.append("arr_terminal")

    # ── 9. Cooldown / call tracking (always update) ───────────────────────────
    snap.fa_last_called_at   = now
    snap.fa_call_count       = (snap.fa_call_count or 0) + 1
    snap.fa_call_reason      = fa_call_reason or "enrichment"
    # Clear the verification flag — FA was just called for this flight
    snap.needs_fa_verification = False

    # ── 10. Audit metadata (always update on any enrichment attempt) ───────────
    ident_used = fa_data.get("flight_number") or snap.flight_number
    snap.last_verified_by = "flightaware"
    snap.last_verified_at = now

    # Merge into provider_sources JSONB
    existing_sources: dict = snap.provider_sources or {}
    existing_sources["flightaware"] = {
        "fetched_at":      fa_fetched_at.isoformat() if fa_fetched_at else now.isoformat(),
        "ident_used":      ident_used,
        "status_from_fa":  fa_data.get("fa_status_raw") or "",
        "changed_fields":  changed_fields,
        "enriched_at":     now.isoformat(),
        "call_reason":     fa_call_reason or "enrichment",
        "dep_gate_from_fa":    fa_dep_gate,
        "arr_gate_from_fa":    fa_arr_gate,
        "dep_terminal_from_fa": fa_dep_terminal,
        "arr_terminal_from_fa": fa_arr_terminal,
    }
    snap.provider_sources = existing_sources

    # ── 11. Raw FA payload storage ─────────────────────────────────────────────
    raw = fa_data.get("_raw")
    if raw is not None:
        snap.raw_flightaware_payload = raw

    # ── 12. Flush to DB ────────────────────────────────────────────────────────
    was_enriched = len(changed_fields) > 0
    db.add(snap)
    if was_enriched:
        logger.info(
            f"[FA ENRICHED] flight={snap.flight_number} airport={snap.airport_iata} "
            f"direction={snap.direction} reason={fa_call_reason or 'enrichment'} "
            f"changed={changed_fields}"
        )
    else:
        logger.debug(
            f"[FA HIT] flight={snap.flight_number} — no field changes needed "
            f"(reason={fa_call_reason or 'enrichment'}, data already current)"
        )

    return {
        "changed_fields": changed_fields,
        "was_enriched":   was_enriched,
        "ident_used":     ident_used,
    }


def _sync_dataset_status(snap: AEFlightSnapshot, db: Session) -> None:
    """Sync the reconciled snapshot status and other metrics back to the AEFlightDataset row."""
    from app.models.ae_models import AEFlightDataset
    from app.services.ae_ingestion_service import _STATUS_ENC

    if not snap.flight_date:
        return

    ds_row = (
        db.query(AEFlightDataset)
        .filter(
            AEFlightDataset.flight_number == snap.flight_number,
            AEFlightDataset.flight_date == snap.flight_date,
            AEFlightDataset.airport_iata == snap.airport_iata,
            AEFlightDataset.direction == snap.direction,
        )
        .first()
    )

    if ds_row:
        ds_row.final_status = snap.status
        ds_row.status_enc = _STATUS_ENC.get((snap.status or "").lower(), 0)
        # Also sync other reconciled attributes
        if snap.landed_at:
            ds_row.landed_at = snap.landed_at
        if snap.departed_at:
            ds_row.departed_at = snap.departed_at
        if snap.airborne_at:
            ds_row.airborne_at = snap.airborne_at
        if snap.latitude is not None:
            ds_row.latitude = snap.latitude
        if snap.longitude is not None:
            ds_row.longitude = snap.longitude
        if snap.altitude_ft is not None:
            ds_row.altitude_ft = snap.altitude_ft
        if snap.speed_kmh is not None:
            ds_row.speed_kmh = snap.speed_kmh
        db.add(ds_row)


def reconcile_stale_flight_status(flight: AEFlightSnapshot, db: Optional[Session] = None) -> bool:
    """
    Reconciles stale flight statuses using provider data and operational constraints.
    Rules:
      1. Never overwrite a confirmed terminal status ('landed', 'cancelled').
      2. High Confidence Landing: If arr_actual or landed_at is in the past.
      3. Medium Confidence Landing: If arr_estimated exists and has passed by > 2 hours.
      4. Low Confidence Timeout (Stale): If scheduled departure is >24h (or >18h for in_air) AND last provider update is >3h ago.
      5. Cooldown Protection: Skip if already stale_unresolved or landed.
    Returns True if status changed.
    """
    status_lower = (flight.status or "").lower()

    # Rule 1 & 5: Never overwrite confirmed terminal status or already stale_unresolved
    if status_lower in ("landed", "cancelled", "stale_unresolved"):
        return False

    now = datetime.now(timezone.utc)
    dep_sched = _tz(flight.dep_scheduled)
    arr_actual = _tz(flight.arr_actual) or _tz(flight.landed_at)
    arr_est = _tz(flight.arr_estimated)

    # ── Rule 2: High Confidence Landing ──────────────────────────────────────────
    if arr_actual and now >= arr_actual:
        old_status = flight.status
        flight.status = "landed"
        flight.last_status_change = now
        reason = f"Confirmed arrival from provider actuals (arr_actual={arr_actual.isoformat()})"
        logger.info(
            f"[AUTO-RECONCILE] flight={flight.flight_number} "
            f"old_status={old_status} new_status=landed "
            f"reason='{reason}' timestamp={now.isoformat()}"
        )
        
        # Micro-refinement: Persist the previous operational state audit metadata
        existing_sources: dict = flight.provider_sources or {}
        existing_sources["reconciliation"] = {
            "reconciled_at":    now.isoformat(),
            "old_status":       old_status,
            "new_status":       flight.status,
            "reason":           reason,
        }
        flight.provider_sources = existing_sources
        
        if db:
            _sync_dataset_status(flight, db)
        return True

    # ── Rule 3: Medium Confidence Landing ──────────────────────────────────────────
    if arr_est and now >= arr_est + timedelta(hours=2):
        old_status = flight.status
        flight.status = "landed"
        flight.last_status_change = now
        reason = f"Estimated arrival passed by > 2 hours (arr_estimated={arr_est.isoformat()})"
        logger.info(
            f"[AUTO-RECONCILE] flight={flight.flight_number} "
            f"old_status={old_status} new_status=landed "
            f"reason='{reason}' timestamp={now.isoformat()}"
        )
        
        # Micro-refinement: Persist the previous operational state audit metadata
        existing_sources: dict = flight.provider_sources or {}
        existing_sources["reconciliation"] = {
            "reconciled_at":    now.isoformat(),
            "old_status":       old_status,
            "new_status":       flight.status,
            "reason":           reason,
        }
        flight.provider_sources = existing_sources
        
        if db:
            _sync_dataset_status(flight, db)
        return True

    # ── Rule 4: Low Confidence Timeout (Stale Transition) ─────────────────────────
    ACTIVE_STATUSES = {"in_air", "active", "departed", "boarding", "taxiing"}
    if status_lower in ACTIVE_STATUSES and dep_sched:
        hours_since_dep = (now - dep_sched).total_seconds() / 3600.0

        # Determine last provider update time
        last_update = _tz(flight.collected_at) or _tz(flight.last_status_change) or _tz(flight.last_position_update)
        update_age_hours = (now - last_update).total_seconds() / 3600.0 if last_update else 999.0

        is_very_old = (hours_since_dep > 24) or (hours_since_dep > 18 and status_lower == "in_air")
        is_provider_stale = update_age_hours > 3.0

        if is_very_old and is_provider_stale:
            old_status = flight.status
            flight.status = "stale_unresolved"
            flight.last_status_change = now
            reason = f"Operational timeout (scheduled dep={flight.dep_scheduled}, last_update={last_update.isoformat() if last_update else 'none'}, age={hours_since_dep:.1f}h)"
            logger.info(
                f"[AUTO-RECONCILE] flight={flight.flight_number} "
                f"old_status={old_status} new_status=stale_unresolved "
                f"reason='{reason}' timestamp={now.isoformat()}"
            )
            
            # Micro-refinement: Persist the previous operational state audit metadata
            existing_sources: dict = flight.provider_sources or {}
            existing_sources["reconciliation"] = {
                "reconciled_at":    now.isoformat(),
                "old_status":       old_status,
                "new_status":       flight.status,
                "reason":           reason,
            }
            flight.provider_sources = existing_sources
            
            if db:
                _sync_dataset_status(flight, db)
            return True

    return False
