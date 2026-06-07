"""
Internal Messaging Router
==========================
Handles communication between airport admins and the super admin.
- Airport admins can send messages to super admin and see replies.
- Super admin can see all messages and send to any admin.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Literal
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin, get_current_user
from app.models.models import Message, MessageReply, User
from app.schemas.schemas import (
    MessageOut, MessageCreate, MessageReplyCreate, MessageReplyOut,
    PublicFeedbackCreate
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
        "from_user_name": msg.from_user.full_name if msg.from_user else (msg.passenger_name or "Passenger"),
        "from_user_airport": msg.from_user.airport_iata if msg.from_user else (msg.airport_code or None),
        "to_user_id": msg.to_user_id,
        "to_user_name": msg.to_user.full_name if msg.to_user else "Super Admin",
        "category": msg.category,
        "subject": msg.subject,
        "body": msg.body,
        "status": msg.status,
        "is_read": getattr(msg, "is_read", False),
        "created_at": msg.created_at,
        "updated_at": msg.updated_at,
        "passenger_name": getattr(msg, "passenger_name", None),
        "passenger_email": getattr(msg, "passenger_email", None),
        "airport_code": getattr(msg, "airport_code", None),
        "sender_type": getattr(msg, "sender_type", "internal"),
        "assigned_admin_id": getattr(msg, "assigned_admin_id", None),
        "assigned_admin_name": getattr(msg, "assigned_admin_name", None),
        "assigned_at": getattr(msg, "assigned_at", None),
        "deleted_by_sender": getattr(msg, "deleted_by_sender", False),
        "deleted_by_recipient": getattr(msg, "deleted_by_recipient", False),
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
# Static paths before "" so they are not swallowed by the list route.

@router.get("/unread-count")
def get_unread_message_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Count inbox messages the current user has NOT yet read (is_read=False)."""
    if current_user.role == "super_admin":
        n = (
            db.query(func.count(Message.id))
            .filter(
                Message.direction == "to_super",
                Message.is_read == False,  # noqa: E712
            )
            .scalar()
        )
    else:
        n = (
            db.query(func.count(Message.id))
            .filter(
                Message.direction == "to_admin",
                Message.to_user_id == current_user.id,
                Message.is_read == False,  # noqa: E712
            )
            .scalar()
        )
    return {"count": int(n or 0)}


@router.post("/mark-inbox-read", status_code=200)
def mark_inbox_messages_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Mark inbox messages as read (is_read=True) when the user opens the Messages page.
    
    IMPORTANT: This does NOT change message status.
    Status transitions are:
      - 'open'       → first message sent, no replies yet
      - 'in_progress'→ only when a reply is actually sent
      - 'resolved'   → only when manually resolved
    """
    now = datetime.now(timezone.utc)
    if current_user.role == "super_admin":
        q = db.query(Message).filter(
            Message.direction == "to_super",
            Message.is_read == False,  # noqa: E712
        )
    else:
        q = db.query(Message).filter(
            Message.direction == "to_admin",
            Message.to_user_id == current_user.id,
            Message.is_read == False,  # noqa: E712
        )
    count = 0
    for msg in q.all():
        msg.is_read = True
        msg.updated_at = now
        count += 1
    db.commit()
    return {"marked": count}


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete a message for the current user."""
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    is_sender = (msg.from_user_id == current_user.id)
    is_recipient = (msg.to_user_id == current_user.id)
    
    if msg.sender_type == "passenger":
        # Passenger messages shared in inbox
        if current_user.role == "super_admin":
            is_recipient = True
        elif current_user.role == "airport_admin" and msg.airport_code == current_user.airport_iata:
            is_recipient = True
            
    if not is_sender and not is_recipient and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="You cannot delete this message")

    if current_user.role == "super_admin":
        msg.deleted_by_sender = True
        msg.deleted_by_recipient = True
    else:
        if is_sender:
            msg.deleted_by_sender = True
        if is_recipient:
            msg.deleted_by_recipient = True

    # If both sides deleted (or for passenger messages if recipient deletes), we could permanently delete,
    # but for simplicity, we just softly delete from both views.
    if msg.deleted_by_sender and msg.deleted_by_recipient:
        pass # Let it stay softly deleted for data integrity
        
    db.commit()
    return None


@router.get("")
def list_messages(
    tab: str = Query("inbox", description="inbox or sent"),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    List messages visible to the current user.
    """
    query = db.query(Message)

    if current_user.role == "super_admin":
        if tab == "inbox":
            query = query.filter(
                Message.direction == "to_super",
                Message.deleted_by_recipient == False
            )
        else:
            query = query.filter(
                Message.direction == "to_admin",
                Message.deleted_by_sender == False
            )
    else:
        if tab == "inbox":
            query = query.filter(
                (
                    (Message.direction == "to_admin") & (Message.to_user_id == current_user.id)
                ) | (
                    (Message.sender_type == "passenger") & (Message.airport_code == current_user.airport_iata)
                ),
                Message.deleted_by_recipient == False
            )
        else:
            query = query.filter(
                Message.direction == "to_super",
                Message.from_user_id == current_user.id,
                Message.deleted_by_sender == False
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
    
    if msg.sender_type == "passenger":
        if current_user.role == "super_admin":
            raise HTTPException(status_code=403, detail="Passenger support tickets are managed by airport admins only.")
        elif current_user.role == "airport_admin" and msg.airport_code == current_user.airport_iata:
            is_recipient = True

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

    if msg.sender_type == "passenger":
        if not msg.passenger_email:
            raise HTTPException(status_code=400, detail="No passenger email available")
            
        from app.services.email_service import send_passenger_reply_email
        send_passenger_reply_email(
            passenger_email=msg.passenger_email,
            passenger_name=msg.passenger_name or "Passenger",
            subject=msg.subject,
            original_message=msg.body,
            reply_body=payload.body.strip(),
            admin_name=current_user.full_name
        )
        
        # Auto-assignment on first reply
        if not msg.assigned_admin_id:
            msg.assigned_admin_id = current_user.id
            msg.assigned_admin_name = current_user.full_name
            msg.assigned_at = datetime.now(timezone.utc)
            
        msg.status = "resolved"  # User rule: mark as replied/resolved
    else:
        # Auto-advance status back to "in_progress" if the other participant replies
        if msg.status == "open" and current_user.id != msg.from_user_id:
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

class MessageStatusUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved"]

@router.patch("/{message_id}/status", status_code=200)
def update_message_status(
    message_id: int,
    payload: MessageStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Manually update the status of a message. Only super admin or the recipient can update."""
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if current_user.role != "super_admin" and msg.to_user_id != current_user.id and msg.from_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to update this message")

    if msg.status == "resolved" and payload.status != "resolved":
        # Maybe we allow reopening? Yes.
        pass

    msg.status = payload.status
    msg.updated_at = datetime.now(timezone.utc)
    db.commit()
    logger.info(f"Message {message_id} status updated to {payload.status} by user {current_user.id}")
    return {"status": msg.status}


@router.post("/public-feedback", status_code=status.HTTP_201_CREATED)
def submit_public_feedback(
    payload: PublicFeedbackCreate,
    db: Session = Depends(get_db)
):
    """Submit public feedback from a passenger. No auth required."""
    if not payload.subject.strip() or not payload.message.strip():
        raise HTTPException(status_code=422, detail="Subject and message are required")

    msg = Message(
        sender_type="passenger",
        passenger_name=payload.name.strip(),
        passenger_email=payload.email.strip(),
        airport_code=payload.airport.strip().upper(),
        subject=payload.subject.strip(),
        body=payload.message.strip(),
        status="open",
        direction="to_admin", # Legacy requirement for routing logic
        category="general",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    
    return {"message": "Feedback submitted successfully", "id": msg.id}
