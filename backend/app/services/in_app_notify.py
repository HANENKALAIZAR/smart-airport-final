"""
Create in-app notifications for super admins and airport admins.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.models import User, InAppNotification


def _now():
    return datetime.now(timezone.utc)


def create_notification(
    db: Session,
    *,
    recipient_user_id: int,
    kind: str,
    body: str,
    context: Optional[dict[str, Any]] = None,
) -> InAppNotification:
    n = InAppNotification(
        id=str(uuid.uuid4()),
        recipient_user_id=recipient_user_id,
        kind=kind,
        body=body,
        context=context,
        is_read=0,
        created_at=_now(),
    )
    db.add(n)
    return n


def notify_all_super_admins(
    db: Session,
    *,
    kind: str,
    body: str,
    context: Optional[dict[str, Any]] = None,
) -> int:
    """Notify every active super admin. Returns count created."""
    supers = (
        db.query(User)
        .filter(User.role == "super_admin", User.is_active == 1)
        .all()
    )
    c = 0
    for su in supers:
        create_notification(db, recipient_user_id=su.id, kind=kind, body=body, context=context)
        c += 1
    return c


def notify_airport_admin(
    db: Session,
    *,
    admin_id: int,
    kind: str,
    body: str,
    context: Optional[dict[str, Any]] = None,
) -> None:
    create_notification(db, recipient_user_id=admin_id, kind=kind, body=body, context=context)
