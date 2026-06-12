"""
Passenger Router (Aviation Edge Only)
======================================
All passenger-facing flight endpoints. Strict rules:
  - Aviation Edge is the ONLY external data source.
  - DB (AEFlightSnapshot) is checked first — AE API called only when stale.
  - No AviationStack. No OpenSky. No mock data.

Endpoints:
  GET  /api/passenger/flights                         – Airport flight board
  GET  /api/passenger/flights/{flight_number}         – Single flight (DB→AE)
  GET  /api/passenger/flights/{flight_number}/prediction
  GET  /api/passenger/flights/{flight_number}/rights
  GET  /api/passenger/flights/{flight_number}/alternatives
  POST /api/passenger/alerts/subscribe
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.ae_models import AEFlightSnapshot
from app.models.models import PassengerAlertSubscription, PassengerAlertLog
from app.services.flight_cache_service import get_flights_smart, _snapshot_to_api_dict
from app.services.passenger_rights import get_applicable_rights, get_compensation_config
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/passenger", tags=["passenger"])

SUPPORTED_AIRPORTS = ["TUN", "MIR", "NBE", "DJE"]  # Supported Tunisian airports


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _snapshot_to_passenger_dict(snap: AEFlightSnapshot) -> dict:
    """Convert AEFlightSnapshot ORM row to the normalised passenger dict."""
    return _snapshot_to_api_dict(snap)


async def _lookup_flight_snapshot(
    flight_number: str,
    db: Session,
) -> Optional[AEFlightSnapshot]:
    """
    Search AEFlightSnapshot for a flight by number.
    Uses centralized alias-matching rules. Serves from cache or queries realtime Aviation Edge provider on cache misses.
    """
    from app.utils.flight_number import get_flight_alias_filter
    today = _now_utc().date()
    fn = flight_number.upper().replace(" ", "")

    # 1. Check database cache using shared alias-matching filter
    alias_filter = get_flight_alias_filter(AEFlightSnapshot, fn)
    row = (
        db.query(AEFlightSnapshot)
        .filter(
            AEFlightSnapshot.snapshot_date == today,
            alias_filter
        )
        .order_by(AEFlightSnapshot.collected_at.desc())
        .first()
    )
    if row:
        return row

    # 2. Cache miss — fetch directly from Aviation Edge by flight number!
    try:
        from app.api_clients.aviation_edge_client import fetch_flight_by_number
        from app.services.ae_ingestion_service import _build_snapshot, _build_dataset_row
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        from app.models.ae_models import AEFlightDataset

        logger.info(f"[Passenger Lookup Cache Miss] Flight {fn} not in DB cache. Querying realtime provider...")
        flights = await fetch_flight_by_number(fn)
        
        if flights:
            for flight in flights:
                snap = _build_snapshot(
                    flight=flight,
                    airport_iata=flight["dep_iata"] if flight["direction"] == "departure" else flight["arr_iata"],
                    today=today,
                    status=flight["status"],
                    departed_at=None,
                    airborne_at=None,
                    landed_at=None,
                    last_status_change=None,
                    last_position_update=None
                )
                
                # PG UPSERT snapshot
                stmt = (
                    pg_insert(AEFlightSnapshot)
                    .values(**snap)
                    .on_conflict_do_update(
                        index_elements=["flight_number", "snapshot_date", "airport_iata", "direction"],
                        set_={
                            "collected_at":     snap["collected_at"],
                            "status":           snap["status"],
                            "raw_status":       snap["raw_status"],
                            "delay_minutes":    snap["delay_minutes"],
                            "dep_actual":       snap["dep_actual"],
                            "arr_actual":       snap["arr_actual"],
                            "dep_estimated":    snap["dep_estimated"],
                            "arr_estimated":    snap["arr_estimated"],
                            "dep_gate":         snap["dep_gate"],
                            "arr_gate":         snap["arr_gate"],
                            "dep_terminal":     snap["dep_terminal"],
                            "arr_terminal":     snap["arr_terminal"],
                            "dep_delay_min":    snap["dep_delay_min"],
                            "arr_delay_min":    snap["arr_delay_min"],
                            "latitude":         snap["latitude"],
                            "longitude":        snap["longitude"],
                            "altitude_ft":      snap["altitude_ft"],
                            "speed_kmh":        snap["speed_kmh"],
                            "heading_deg":      snap["heading_deg"],
                            "is_ground":        snap["is_ground"],
                            "aircraft_type":    snap["aircraft_type"],
                            "aircraft_reg":     snap["aircraft_reg"],
                        },
                    )
                )
                db.execute(stmt)
                
                # Build and UPSERT ML dataset row
                ds_row = _build_dataset_row(snap)
                ds_stmt = (
                    pg_insert(AEFlightDataset)
                    .values(**ds_row)
                    .on_conflict_do_update(
                        index_elements=["flight_number", "flight_date", "airport_iata", "direction"],
                        set_={k: v for k, v in ds_row.items()
                              if k not in ("flight_number", "flight_date", "airport_iata", "direction")},
                    )
                )
                db.execute(ds_stmt)
            
            db.commit()
            logger.info(f"[Passenger Lookup Cache Miss] Resolved {fn} realtime: successfully stored {len(flights)} flights")
            
            # Re-query DB with alias filters
            row = (
                db.query(AEFlightSnapshot)
                .filter(
                    AEFlightSnapshot.snapshot_date == today,
                    alias_filter
                )
                .order_by(AEFlightSnapshot.collected_at.desc())
                .first()
            )
    except Exception as e:
        logger.error(f"[Passenger] Dynamic realtime refresh by flight number failed for {fn}: {e}")
        db.rollback()

    return row


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/flights")
async def list_passenger_flights(
    airport: str = Query("TUN", description="Tunisian airport IATA code"),
    direction: str = Query("both", description="departure | arrival | both"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD — past, today, or future"),
    db: Session = Depends(get_db),
):
    """
    Flight board for a Tunisian airport.
    Served from DB cache (Aviation Edge snapshots). AE API called only when stale.
    When a date is provided, filtering is applied server-side so only flights
    belonging to that date are returned.
    """
    iata = airport.upper()
    if iata not in SUPPORTED_AIRPORTS:
        raise HTTPException(404, f"Airport '{iata}' not supported. Use: {', '.join(SUPPORTED_AIRPORTS)}")
    if direction not in ("both", "departure", "arrival"):
        raise HTTPException(400, "direction must be 'both', 'departure', or 'arrival'")

    all_flights: list[dict] = []
    directions = ["departure", "arrival"] if direction == "both" else [direction]

    for d in directions:
        flights, from_api, age = await get_flights_smart(iata, d, db, target_date=date)
        seen = {(f["flight_number"], f["direction"]) for f in all_flights}
        for f in flights:
            if (f["flight_number"], f["direction"]) not in seen:
                all_flights.append(f)

    # Exclude stale_unresolved from passenger live departure boards
    all_flights = [f for f in all_flights if (f.get("status") or "").lower() != "stale_unresolved"]

    return {
        "airport": iata,
        "total": len(all_flights),
        "source": "aviation_edge",
        "flights": all_flights,
    }


@router.get("/flights/{flight_number}")
async def get_passenger_flight(
    flight_number: str,
    db: Session = Depends(get_db),
):
    """
    Lookup a specific flight by IATA number.
    Priority: DB snapshot → Aviation Edge API refresh.
    """
    snap = await _lookup_flight_snapshot(flight_number, db)
    if snap is None:
        raise HTTPException(404, f"Flight '{flight_number.upper()}' not found. It may not operate today.")

    return _snapshot_to_passenger_dict(snap)


@router.get("/flights/{flight_number}/prediction")
async def get_passenger_prediction(
    flight_number: str,
    db: Session = Depends(get_db),
):
    """
    ML delay prediction for a flight using Aviation Edge data.
    Uses AEFlightSnapshot as input to live_feature_builder + XGBoost model.
    """
    fn = flight_number.upper()
    snap = await _lookup_flight_snapshot(fn, db)

    if snap is None:
        raise HTTPException(404, f"Flight '{fn}' not found — cannot generate prediction.")

    flight_dict = _snapshot_to_passenger_dict(snap)

    try:
        from app.services.live_feature_builder import build_features
        from app.services.prediction_service import predict_from_dict
        features   = build_features(flight_dict, db=db)
        prediction = predict_from_dict(features, db=db, flight_number=fn)
    except Exception as e:
        logger.error(f"[Passenger/Prediction] {fn}: {e}")
        raise HTTPException(503, "ML prediction service temporarily unavailable.")

    return {
        "flight_number": fn,
        "prediction": {
            "risk_score":          float(prediction.risk_score),
            "predicted_delay_min": int(prediction.predicted_delay_min),
            "confidence":          float(prediction.confidence),
            "shap_explanation":    prediction.shap_explanation,
            "model_version":       prediction.model_version,
            "predicted_at":        prediction.predicted_at.isoformat() if prediction.predicted_at else None,
        },
    }


@router.get("/flights/{flight_number}/rights")
async def get_passenger_rights(
    flight_number: str,
    delay_minutes: int = Query(0, ge=0),
    dep_region: str = Query("OTHER"),
    arr_region: str = Query("OTHER"),
    distance_km: int = Query(0, ge=0),
    user_region: str = Query(None),
    db: Session = Depends(get_db),
):
    """
    Applicable passenger rights for a flight.
    If the flight exists in DB, use its actual delay. Otherwise use query params.
    Rights are fetched from the passenger_rights table (real DB data).

    The user_region parameter is validated against the departure airport.
    If a mismatch is detected, the departure-airport region is used instead.
    """
    import logging
    logger = logging.getLogger(__name__)
    from app.models.models import PassengerRight
    from app.services.passenger_rights import resolve_region_from_airport_iata

    fn = flight_number.upper()
    snap = await _lookup_flight_snapshot(fn, db)

    actual_delay = delay_minutes
    actual_distance = distance_km
    regions: set[str] = set()

    # Determine departure airport region from snapshot data
    dep_airport_region = None
    if snap:
        actual_delay = snap.delay_minutes or 0
        regions_from_snap = {dep_region, arr_region}

        EU_IATAS = {"CDG", "ORY", "FRA", "FCO", "MAD", "BCN", "AMS", "BRU", "VIE", "MUC", "GVA", "LYS", "NCE", "MRS", "MLA", "TLS", "BOD", "LIS", "OPO", "DUB", "CPH", "ARN", "OSL", "HEL", "ZRH", "WAW", "PRG", "BUD", "ATH", "IST"}
        UK_IATAS = {"LHR", "LGW", "STN", "LTN", "SEN", "LCY", "MAN", "EDI", "GLA", "BHX", "BRS", "LPL", "NCL", "EMA", "ABZ", "BFS", "CWL", "SOU", "EXT", "NQY"}
        US_IATAS = {"JFK", "EWR", "LGA", "ORD", "DFW", "LAX", "SFO", "MIA", "ATL", "BOS", "SEA", "PHX", "DEN", "IAH", "MCO", "CLT", "PHL", "DCA", "BWI", "SLC", "SAN", "TPA", "STL", "PDX"}
        CA_IATAS = {"YYZ", "YVR", "YUL", "YYC", "YOW", "YHZ", "YEG", "YWG", "YQB", "YXE", "YYJ", "YTZ"}

        if snap.dep_iata in EU_IATAS:
            regions.add("EU")
            dep_airport_region = "EU"
        elif snap.dep_iata in UK_IATAS:
            regions.add("UK")
            dep_airport_region = "UK"
        elif snap.dep_iata in US_IATAS:
            regions.add("US")
            dep_airport_region = "US"
        elif snap.dep_iata in CA_IATAS:
            regions.add("CA")
            dep_airport_region = "CA"
        else:
            dep_airport_region = "OTHER"

        # Also add rights for arrival region if applicable
        if snap.arr_iata in EU_IATAS:
            regions.add("EU")
        elif snap.arr_iata in UK_IATAS:
            regions.add("UK")
        elif snap.arr_iata in US_IATAS:
            regions.add("US")
        elif snap.arr_iata in CA_IATAS:
            regions.add("CA")

        regions.update(regions_from_snap - {"OTHER"})

        # Validate user_region against departure airport
        if user_region and dep_airport_region and user_region != dep_airport_region:
            logger.warning(
                "Region mismatch for flight %s: user selected '%s' but departure airport '%s' maps to '%s'. Overriding.",
                fn, user_region, snap.dep_iata, dep_airport_region
            )

    if not regions:
        regions.add("OTHER")

    rights = (
        db.query(PassengerRight)
        .filter(
            PassengerRight.region.in_(regions),
            PassengerRight.delay_threshold_min <= actual_delay,
        )
        .order_by(PassengerRight.delay_threshold_min)
        .all()
    )

    applicable = []
    for r in rights:
        if r.distance_min_km and actual_distance < r.distance_min_km:
            continue
        if r.distance_max_km and actual_distance > r.distance_max_km:
            continue
        applicable.append({
            "region":               r.region,
            "regulation_name":      r.regulation_name,
            "delay_threshold_min":  r.delay_threshold_min,
            "right_type":           r.right_type,
            "description":          r.description_fr or r.description_en,
            "compensation_amount":  r.compensation_amount,
        })

    return {
        "flight_number": fn,
        "delay_minutes": actual_delay,
        "dep_airport_region": dep_airport_region or "OTHER",
        "rights": applicable,
    }


@router.get("/flights/{flight_number}/alternatives")
async def get_passenger_alternatives(
    flight_number: str,
    db: Session = Depends(get_db),
):
    """
    Alternative flights on the same route using Aviation Edge timetable.
    Returns upcoming scheduled flights departing from the same airport to the same destination.
    No mock data — empty list if nothing found.
    """
    fn = flight_number.upper()
    snap = await _lookup_flight_snapshot(fn, db)

    if snap is None:
        return {"flight_number": fn, "alternatives": [], "message": "Original flight not found."}

    dep_iata = snap.dep_iata
    arr_iata = snap.arr_iata

    if not dep_iata or not arr_iata:
        return {"flight_number": fn, "alternatives": [], "message": "Route information unavailable."}

    # Search AEFlightSnapshot for same-route alternatives today
    today = _now_utc().date()
    alts = (
        db.query(AEFlightSnapshot)
        .filter(
            AEFlightSnapshot.dep_iata == dep_iata,
            AEFlightSnapshot.arr_iata == arr_iata,
            AEFlightSnapshot.snapshot_date == today,
            AEFlightSnapshot.flight_number != fn,
            AEFlightSnapshot.status.notin_(["cancelled", "landed"]),
        )
        .order_by(AEFlightSnapshot.dep_scheduled)
        .limit(5)
        .all()
    )

    # If DB has nothing, try a live AE timetable fetch
    if not alts:
        try:
            from app.api_clients.aviation_edge_client import fetch_timetable
            raw = await fetch_timetable(dep_iata, "departure")
            alternatives = [
                f for f in raw
                if f.get("arr_iata") == arr_iata
                and f.get("flight_number") != fn
                and f.get("status") not in ("cancelled", "landed")
            ][:5]
            return {
                "flight_number": fn,
                "alternatives": alternatives,
                "source": "aviation_edge_live",
            }
        except Exception as e:
            logger.error(f"[Passenger/Alternatives] AE timetable fetch failed: {e}")
            return {"flight_number": fn, "alternatives": [], "message": "Alternative flight data temporarily unavailable."}

    return {
        "flight_number": fn,
        "alternatives": [_snapshot_to_passenger_dict(a) for a in alts],
        "source": "db_cache",
    }


# ── Alert Subscription ─────────────────────────────────────────────────────────

class AlertSubscribeRequest(BaseModel):
    email: str
    flight_number: str
    dep_iata: str = ""
    arr_iata: str = ""
    airline: str = ""
    scheduled_departure: str = ""


def _send_confirmation_email(
    email: str,
    flight_number: str,
    dep_iata: str,
    arr_iata: str,
    airline: str,
    scheduled_departure: str,
) -> bool:
    """Send subscription confirmation email via SMTP."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping passenger alert confirmation")
        return False

    try:
        dt_display = scheduled_departure
        try:
            dt = datetime.fromisoformat(scheduled_departure.replace("Z", "+00:00"))
            dt_display = dt.strftime("%A, %b %d · %H:%M UTC")
        except Exception:
            pass

        year = datetime.utcnow().year
        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Flight Alert Confirmed</title></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="background:#1E293B;border-radius:20px;overflow:hidden;
             box-shadow:0 8px 40px rgba(0,0,0,0.4);max-width:600px;border:1px solid rgba(255,255,255,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#0ea5e9 100%);padding:36px 40px;text-align:center;">
          <div style="font-size:36px;margin-bottom:10px;">✈️</div>
          <h1 style="color:#fff;margin:0;font-size:1.4rem;font-weight:700;">Smart Airport · Tunisia</h1>
          <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:0.88rem;">Flight Alert Confirmed</p>
        </td></tr>
        <tr><td style="padding:36px 40px 28px;">
          <p style="color:#94A3B8;font-size:0.88rem;margin:0 0 20px;text-transform:uppercase;letter-spacing:0.12em;">You're now tracking</p>
          <div style="background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.3);border-radius:14px;padding:24px 28px;">
            <div style="font-size:2rem;font-weight:800;color:#fff;font-family:monospace;">{flight_number}</div>
            <div style="color:#94A3B8;font-size:0.88rem;margin-top:4px;">{airline or 'your airline'}</div>
            <div style="margin-top:16px;color:#CBD5E1;font-size:0.88rem;">
              <strong style="color:#fff;">{dep_iata}</strong> → <strong style="color:#fff;">{arr_iata}</strong>
            </div>
            <div style="margin-top:8px;color:#CBD5E1;font-size:0.88rem;">🕐 {dt_display}</div>
          </div>
          <p style="color:#CBD5E1;font-size:0.92rem;margin:24px 0 0;line-height:1.7;">
            You'll receive email notifications for delays, gate changes, boarding calls, and cancellations.
          </p>
        </td></tr>
        <tr><td style="background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.06);
                       padding:18px 40px;text-align:center;">
          <p style="margin:0;font-size:0.72rem;color:#475569;">
            © {year} Smart Airport Operations · Tunisia<br/>
            <span style="color:#334155;">Reply STOP to unsubscribe.</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"✈ Alert activated for {flight_number} ({dep_iata} → {arr_iata})"
        msg["From"]    = f"Smart Airport Alerts <{settings.SMTP_USER}>"
        msg["To"]      = email
        msg.attach(MIMEText(f"Alert activated for {flight_number} ({dep_iata}→{arr_iata}). Departure: {dt_display}.", "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as srv:
            srv.ehlo()
            srv.starttls()
            srv.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            srv.sendmail(settings.SMTP_USER, [email], msg.as_string())

        logger.info(f"[PassengerAlert] Confirmation sent → {email} / {flight_number}")
        return True

    except Exception as exc:
        logger.error(f"[PassengerAlert] Email failed for {email}: {exc}")
        return False


@router.post("/alerts/subscribe")
async def subscribe_passenger_alert(
    req: AlertSubscribeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Subscribe a passenger email to flight status alerts.
    - Persists subscription to DB (unique per email+flight).
    - Sends a confirmation email immediately in the background.
    - Idempotent: re-subscribing an existing active subscription returns 200.
    """
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(422, "A valid email address is required.")

    fn = req.flight_number.strip().upper()
    if not fn:
        raise HTTPException(422, "flight_number is required.")

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise HTTPException(503, "Email alerts are not configured on this server. Contact support.")

    # Upsert subscription
    existing = (
        db.query(PassengerAlertSubscription)
        .filter(
            PassengerAlertSubscription.email == email,
            PassengerAlertSubscription.flight_number == fn,
        )
        .first()
    )

    dep_ts = None
    if req.scheduled_departure:
        try:
            dep_ts = datetime.fromisoformat(req.scheduled_departure.replace("Z", "+00:00"))
        except Exception:
            pass

    if existing:
        existing.is_active = True
        existing.status    = "ACTIVE"
        existing.dep_iata  = req.dep_iata or existing.dep_iata
        existing.arr_iata  = req.arr_iata or existing.arr_iata
        existing.airline   = req.airline  or existing.airline
        if dep_ts:
            existing.scheduled_departure = dep_ts
        sub = existing
    else:
        sub = PassengerAlertSubscription(
            email               = email,
            flight_number       = fn,
            dep_iata            = req.dep_iata.upper() if req.dep_iata else None,
            arr_iata            = req.arr_iata.upper() if req.arr_iata else None,
            airline             = req.airline or None,
            scheduled_departure = dep_ts,
            is_active           = True,
            status              = "ACTIVE",
        )
        db.add(sub)

    db.commit()
    db.refresh(sub)

    # Log the subscription event
    log_entry = PassengerAlertLog(
        subscription_id = sub.id,
        flight_number   = fn,
        email           = email,
        event_type      = "confirmed",
        new_value       = "subscribed",
        email_sent      = False,
    )
    db.add(log_entry)
    db.commit()

    # Send confirmation email in background
    background_tasks.add_task(
        _send_confirmation_email,
        email=email,
        flight_number=fn,
        dep_iata=req.dep_iata.upper() if req.dep_iata else "—",
        arr_iata=req.arr_iata.upper() if req.arr_iata else "—",
        airline=req.airline or "",
        scheduled_departure=req.scheduled_departure,
    )

    return {
        "ok": True,
        "subscription_id": sub.id,
        "message": f"Alert activated. Confirmation email sent to {email}.",
        "flight": fn,
    }


class AlertUnsubscribeRequest(BaseModel):
    email: str
    flight_number: str


@router.get("/alerts/status")
async def get_alert_status(
    email: str = Query(...),
    flight_number: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get the status of a passenger alert subscription.
    """
    email_clean = email.strip().lower()
    fn_clean = flight_number.strip().upper()

    sub = (
        db.query(PassengerAlertSubscription)
        .filter(
            PassengerAlertSubscription.email == email_clean,
            PassengerAlertSubscription.flight_number == fn_clean,
        )
        .first()
    )

    if not sub:
        return {"subscribed": False}

    return {
        "subscribed": True,
        "is_active": sub.is_active,
        "status": sub.status,
        "completed_at": sub.completed_at.isoformat() if sub.completed_at else None,
        "completion_reason": sub.completion_reason,
        "last_checked_at": sub.last_checked_at.isoformat() if sub.last_checked_at else None,
        "last_notified_status": sub.last_notified_status,
    }


@router.post("/alerts/unsubscribe")
async def unsubscribe_passenger_alert_api(
    req: AlertUnsubscribeRequest,
    db: Session = Depends(get_db)
):
    """
    Manually unsubscribe/cancel a flight alert.
    """
    email_clean = req.email.strip().lower()
    fn_clean = req.flight_number.strip().upper()

    sub = (
        db.query(PassengerAlertSubscription)
        .filter(
            PassengerAlertSubscription.email == email_clean,
            PassengerAlertSubscription.flight_number == fn_clean,
        )
        .first()
    )

    if not sub:
        raise HTTPException(404, "Alert subscription not found.")

    sub.is_active = False
    sub.status = "CANCELLED"
    sub.completed_at = datetime.now(timezone.utc)
    sub.completion_reason = "cancelled_by_user"

    log_entry = PassengerAlertLog(
        subscription_id = sub.id,
        flight_number   = fn_clean,
        email           = email_clean,
        event_type      = "unsubscribed",
        new_value       = "cancelled_by_user",
        email_sent      = False,
    )
    db.add(log_entry)
    db.commit()

    return {
        "ok": True,
        "message": "Successfully unsubscribed from flight alerts."
    }


@router.get("/compensation-config")
def get_compensation_config_endpoint(
    db: Session = Depends(get_db),
):
    """
    Returns the full compensation configuration including:
    - All active per-route passenger_rights (regulations)
    - All active compensation_limits (baggage caps, denied boarding, Montreal, etc.)
    Used by the frontend and AI assistant to avoid hardcoded values.
    """
    config = get_compensation_config(db)
    return config.model_dump()

