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
    """Airport admin only: persist an AI alert for their airport (no super-admin ping here)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only airport admins can send this notification.")

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
    """Airport admin only: persist decision + notify super admins with a summary ping."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only airport admins can send this notification.")
    iata = (current_user.airport_iata or "").strip()
    airport_name = AIRPORT_DISPLAY.get(iata, iata or "Unknown airport")
    act = "Approved" if body.action == "approved" else "Rejected"
    fn = (body.flight_number or "").strip() or "Flight"

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
    db.commit()

    msg = f"AI Alert for {fn} has been {act} by {current_user.full_name} — {airport_name}."
    notify_all_super_admins(
        db,
        kind="ai_alert_action",
        body=msg,
        context={
            "flight_number": fn,
            "action": body.action,
            "admin_id": current_user.id,
            "airport_iata": iata,
            "airport_name": airport_name,
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
    Super Admin: list AI alerts for the selected airport.
    Airport Admin: allowed (filtered to own airport) for future UI reuse.
    """
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden.")

    if current_user.role == "admin":
        airport_iata = current_user.airport_iata or ""

    airport_iata = (airport_iata or "").strip()
    if not airport_iata:
        raise HTTPException(status_code=422, detail="airport_iata is required.")

    q = db.query(AIAlert).filter(AIAlert.airport_iata == airport_iata).order_by(AIAlert.created_at.desc())
    if decision and decision != "all":
        q = q.filter(AIAlert.decision == decision)

    rows = q.limit(200).all()

    results = []
    for a in rows:
        acted_name = None
        if a.acted_by_admin_id:
            acted_user = db.query(User).filter(User.id == a.acted_by_admin_id).first()
            acted_name = acted_user.full_name if acted_user else None
        ts = a.decided_at or a.created_at
        results.append(
            {
                "flight_number": a.flight_number,
                "airport_name": a.airport_name,
                "risk_pct": int(a.risk_pct or 0),
                "cause": a.cause,
                "recommendation": a.recommendation,
                "decision": a.decision,
                "acted_by_admin_name": acted_name,
                "timestamp": ts.isoformat() if ts else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
        )
    return results
