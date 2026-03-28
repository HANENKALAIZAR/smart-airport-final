"""
Internal Messaging Router
==========================
Handles communication between airport admins and the super admin.
- Airport admins can send messages to super admin and see replies.
- Super admin can see all messages and send to any admin.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin, get_current_user
from app.models.models import Message, MessageReply, User
from app.schemas.schemas import (
    MessageOut, MessageCreate, MessageReplyCreate, MessageReplyOut
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/messages", tags=["Messaging"])


# ── Helpers ──────────────────────────────────────────────────────────────

def _serialize_message(msg: Message) -> dict:
    """Convert Message ORM object to response dict."""
    return {
        "id": msg.id,
        "direction": msg.direction,
        "from_user_id": msg.from_user_id,
        "from_user_name": msg.from_user.full_name if msg.from_user else "Unknown",
        "from_user_airport": msg.from_user.airport_iata if msg.from_user else None,
        "to_user_id": msg.to_user_id,
        "to_user_name": msg.to_user.full_name if msg.to_user else "Super Admin",
        "category": msg.category,
        "subject": msg.subject,
        "body": msg.body,
        "status": msg.status,
        "created_at": msg.created_at,
        "updated_at": msg.updated_at,
        "replies": [
            {
                "id": r.id,
                "author_id": r.author_id,
                "author_name": r.author.full_name if r.author else "Unknown",
                "author_role": r.author.role if r.author else "admin",
                "body": r.body,
                "created_at": r.created_at,
            }
            for r in (msg.replies or [])
        ],
    }


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("")
def list_messages(
    tab: str = Query("inbox", description="inbox or sent"),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    List messages visible to the current user.
    - Super admin inbox = messages sent to super admin (direction=to_super)
    - Super admin sent  = messages sent by super admin (direction=to_admin)
    - Airport admin inbox = messages from super admin to this admin
    - Airport admin sent  = messages from this admin to super admin
    """
    query = db.query(Message)

    if current_user.role == "super_admin":
        if tab == "inbox":
            query = query.filter(Message.direction == "to_super")
        else:
            query = query.filter(Message.direction == "to_admin")
    else:
        if tab == "inbox":
            query = query.filter(
                Message.direction == "to_admin",
                Message.to_user_id == current_user.id,
            )
        else:
            query = query.filter(
                Message.direction == "to_super",
                Message.from_user_id == current_user.id,
            )

    if status_filter and status_filter != "all":
        query = query.filter(Message.status == status_filter)

    messages = query.order_by(Message.created_at.desc()).all()

    # Eagerly load relationships
    for m in messages:
        _ = m.from_user
        _ = m.to_user
        _ = m.replies
        for r in m.replies:
            _ = r.author

    return [_serialize_message(m) for m in messages]


@router.post("", status_code=status.HTTP_201_CREATED)
def send_message(
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Send a new message."""
    if not payload.subject.strip() or not payload.body.strip():
        raise HTTPException(status_code=422, detail="Subject and body are required")

    if current_user.role == "super_admin":
        # Super admin → specific airport admin
        if not payload.to_user_id:
            raise HTTPException(
                status_code=422,
                detail="to_user_id is required when super admin sends a message",
            )
        recipient = db.query(User).filter(
            User.id == payload.to_user_id,
            User.role == "admin",
        ).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Admin not found")

        msg = Message(
            direction="to_admin",
            from_user_id=current_user.id,
            to_user_id=recipient.id,
            category=payload.category,
            subject=payload.subject.strip(),
            body=payload.body.strip(),
            status="open",
        )
    else:
        # Airport admin → super admin
        super_admin = db.query(User).filter(User.role == "super_admin").first()
        msg = Message(
            direction="to_super",
            from_user_id=current_user.id,
            to_user_id=super_admin.id if super_admin else None,
            category=payload.category,
            subject=payload.subject.strip(),
            body=payload.body.strip(),
            status="open",
        )

    db.add(msg)
    db.commit()
    db.refresh(msg)
    _ = msg.from_user
    _ = msg.to_user

    logger.info(f"Message sent by user {current_user.id}: '{msg.subject}'")
    return _serialize_message(msg)


@router.post("/{message_id}/reply", status_code=status.HTTP_201_CREATED)
def reply_to_message(
    message_id: int,
    payload: MessageReplyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Add a reply to an existing message thread."""
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Access control: only involved parties can reply
    is_super = current_user.role == "super_admin"
    is_sender = msg.from_user_id == current_user.id
    is_recipient = msg.to_user_id == current_user.id
    if not (is_super or is_sender or is_recipient):
        raise HTTPException(status_code=403, detail="You cannot reply to this message")

    if msg.status == "resolved":
        raise HTTPException(status_code=400, detail="Cannot reply to a resolved message")

    if not payload.body.strip():
        raise HTTPException(status_code=422, detail="Reply body cannot be empty")

    reply = MessageReply(
        message_id=message_id,
        author_id=current_user.id,
        body=payload.body.strip(),
    )
    db.add(reply)

    # Auto-advance status: open → in_progress on first reply
    if msg.status == "open":
        msg.status = "in_progress"
    msg.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(reply)
    _ = reply.author

    return {
        "id": reply.id,
        "author_id": reply.author_id,
        "author_name": reply.author.full_name,
        "author_role": reply.author.role,
        "body": reply.body,
        "created_at": reply.created_at,
    }


@router.patch("/{message_id}/resolve", status_code=200)
def resolve_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Mark a message as resolved. Only super admin or the recipient can resolve."""
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if current_user.role != "super_admin" and msg.to_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to resolve this message")

    msg.status = "resolved"
    msg.updated_at = datetime.now(timezone.utc)
    db.commit()
    logger.info(f"Message {message_id} resolved by user {current_user.id}")
    return {"status": "resolved"}
