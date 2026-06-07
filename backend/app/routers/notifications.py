"""
In-app notifications for admin UI (bell).
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from datetime import datetime, timezone

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import User, InAppNotification, AIAlert
from app.schemas.schemas import AiAlertGeneratedBody, AiAlertActionBody
from app.services.in_app_notify import notify_all_super_admins
from app.services.email_service import AIRPORT_DISPLAY

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _pending_id_review_count(db: Session) -> int:
    return (
        db.query(func.count(User.id))
        .filter(
            User.role == "admin",
            User.profile_complete == 1,
            User.id_document_status == "pending",
        )
        .scalar()
        or 0
    )


@router.get("/summary")
def notifications_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unread = (
        db.query(func.count(InAppNotification.id))
        .filter(
            InAppNotification.recipient_user_id == current_user.id,
            InAppNotification.is_read == 0,
        )
        .scalar()
        or 0
    )

    pending_review = 0
    if current_user.role == "super_admin":
        pending_review = _pending_id_review_count(db)

    items = (
        db.query(InAppNotification)
        .filter(InAppNotification.recipient_user_id == current_user.id)
        .order_by(InAppNotification.created_at.desc())
        .limit(30)
        .all()
    )

    return {
        "pending_review_count": pending_review,
        "unread_count": unread,
        "items": [
            {
                "id": n.id,
                "kind": n.kind,
                "body": n.body,
                "context": n.context,
                "is_read": bool(n.is_read),
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
    }


@router.patch("/{notification_id}/read", status_code=200)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = (
        db.query(InAppNotification)
        .filter(
            InAppNotification.id == notification_id,
            InAppNotification.recipient_user_id == current_user.id,
        )
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found.")
    n.is_read = 1
    db.commit()
    return {"ok": True}


@router.post("/mark-all-read", status_code=200)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(InAppNotification).filter(
        InAppNotification.recipient_user_id == current_user.id,
        InAppNotification.is_read == 0,
    ).update({InAppNotification.is_read: 1})
    db.commit()
    return {"ok": True}


@router.post("/ai-alert-generated", status_code=200)
def ai_alert_generated(
    body: AiAlertGeneratedBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Airport admin or super admin: persist an AI alert for an airport."""
    if current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can send this notification.")

    # Super admin may pass airport_iata in body; airport admin always uses their own airport.
    if current_user.role == "super_admin":
        iata = (getattr(body, "airport_iata", None) or "").strip()
        if not iata:
            raise HTTPException(status_code=422, detail="airport_iata is required in body for super_admin.")
    else:
        iata = (current_user.airport_iata or "").strip()
        if not iata:
            raise HTTPException(status_code=422, detail="Admin airport is missing.")

    airport_name = AIRPORT_DISPLAY.get(iata, iata)

    fn = (body.flight_number or "").strip() or "Flight"
    brief = (body.brief_cause or "").strip()
    rec = (body.recommendation or "").strip()
    risk = max(0, min(100, int(body.risk_pct or 0)))

    # Upsert by (airport_iata, flight_number): keep the latest generated content.
    db.query(AIAlert).filter(AIAlert.airport_iata == iata, AIAlert.flight_number == fn).delete()
    db.add(
        AIAlert(
            id=str(uuid.uuid4()),
            flight_number=fn,
            airport_iata=iata,
            airport_name=airport_name,
            risk_pct=risk,
            cause=brief,
            recommendation=rec,
            decision="pending",
            acted_by_admin_id=None,
            decided_at=None,
            created_at=datetime.now(timezone.utc),
            route=(body.route or "").strip() or None,
            delay_formatted=(body.delay_formatted or "").strip() or None,
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/ai-alert-action", status_code=200)
def ai_alert_action(
    body: AiAlertActionBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Airport admin or super admin: persist decision.
    Super admins are notified ONLY when action == 'approved'.
    """
    if current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can send this notification.")

    # Resolve airport IATA
    if current_user.role == "super_admin":
        iata = (getattr(body, "airport_iata", None) or "").strip()
        if not iata:
            iata = ""
    else:
        iata = (current_user.airport_iata or "").strip()

    airport_name = AIRPORT_DISPLAY.get(iata, iata or "Unknown airport")
    fn = (body.flight_number or "").strip() or "Flight"

    # Look up the persisted alert
    alert = (
        db.query(AIAlert)
        .filter(AIAlert.airport_iata == iata, AIAlert.flight_number == fn)
        .order_by(AIAlert.created_at.desc())
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="AI alert not found.")

    alert.decision = body.action
    alert.acted_by_admin_id = current_user.id
    alert.decided_at = datetime.now(timezone.utc)
    if getattr(body, "route", None):
        alert.route = body.route
    if getattr(body, "delay_formatted", None):
        alert.delay_formatted = body.delay_formatted
    db.commit()

    # ── Notify super admins ONLY on approval ──────────────────
    if body.action == "approved":
        admin_name  = current_user.full_name
        route_str   = (body.route or "").strip() or (alert.route or "").strip() or "—"
        delay_str   = (body.delay_formatted or "").strip() or (alert.delay_formatted or "").strip() or "—"
        rec_text    = (alert.recommendation or "").strip() or "—"

        notify_body = (
            f"Admin {admin_name} from {airport_name} approved an AI operational recommendation.\n\n"
            f"Flight: {fn}\n"
            f"Route: {route_str}\n"
            f"Delay: {delay_str}\n"
            f"Recommendation: {rec_text}"
        )
        notify_all_super_admins(
            db,
            kind="ai_alert_approved",
            body=notify_body,
            context={
                "flight_number": fn,
                "action": "approved",
                "admin_name": admin_name,
                "admin_id": current_user.id,
                "airport_iata": iata,
                "airport_name": airport_name,
                "route": route_str,
                "delay_formatted": delay_str,
                "recommendation": rec_text,
            },
        )
        db.commit()

    return {"ok": True}


@router.get("/ai-alerts", status_code=200)
def list_ai_alerts(
    airport_iata: str = "",
    decision: str = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Super Admin: list AI alerts across all airports (or filtered by airport_iata).
    Airport Admin: always filtered to their own airport.
    Returns airport_iata in each row so the UI can filter client-side.
    """
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden.")

    # Airport admin is always scoped to their own airport
    if current_user.role == "admin":
        airport_iata = current_user.airport_iata or ""

    airport_iata = (airport_iata or "").strip()

    # Super admin: if no airport specified → return all airports (no 422)
    # Airport admin: always requires a valid IATA
    if current_user.role == "admin" and not airport_iata:
        raise HTTPException(status_code=422, detail="airport_iata is required.")

    q = db.query(AIAlert).order_by(AIAlert.decided_at.desc(), AIAlert.created_at.desc())
    if airport_iata:
        q = q.filter(AIAlert.airport_iata == airport_iata)
    if decision and decision != "all":
        q = q.filter(AIAlert.decision == decision)

    rows = q.limit(500).all()

    results = []
    for a in rows:
        acted_name = None
        if a.acted_by_admin_id:
            acted_user = db.query(User).filter(User.id == a.acted_by_admin_id).first()
            acted_name = acted_user.full_name if acted_user else None
        results.append(
            {
                "flight_number": a.flight_number,
                "airport_iata": a.airport_iata,
                "airport_name": a.airport_name,
                "risk_pct": int(a.risk_pct or 0),
                "cause": a.cause,
                "recommendation": a.recommendation,
                "decision": a.decision,
                "acted_by_admin_name": acted_name,
                "decided_at": a.decided_at.isoformat() if a.decided_at else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "route": a.route,
                "delay_formatted": a.delay_formatted,
            }
        )
    return results
