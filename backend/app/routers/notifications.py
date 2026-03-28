"""
In-app notifications for admin UI (bell).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import User, InAppNotification

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
