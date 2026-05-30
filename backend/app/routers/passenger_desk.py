"""
Passenger Ticket Helpdesk Desk Router
======================================
Implements a production-grade, highly accountable ticket routing, claiming,
and email-threading messaging desk system.
"""

import re
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, field_validator

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, exists
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_approved_admin
from app.models.models import User, PassengerMessage, PassengerMessageThread, PassengerMessageReadState, Message
from app.services.email_service import (
    send_passenger_reply_email,
    send_passenger_confirmation_email
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Passenger Helpdesk"])

SUPPORTED_AIRPORTS = ["TUN", "MIR", "DJE", "NBE"]

HIGH_KEYWORDS = [
    "passport", "police", "sécurité", "securite", "medical", "accident",
    "cancelled", "canceled", "stranded", "visa", "emergency",
    "passeport", "médical", "medical", "urgence", "vol annulé", "vol annule", "annulation"
]
MEDIUM_KEYWORDS = [
    "baggage", "delayed", "delay", "gate", "boarding", "connection",
    "wheelchair", "check-in", "bagage", "retard", "embarquement", "fauteuil roulant", "porte", "connexion"
]

# ── Schemas ──────────────────────────────────────────────────────────────────

class ContactMessageCreate(BaseModel):
    fullName: str
    email: str
    airportIata: str
    subject: str
    message: str

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", v):
            raise ValueError("A valid email address is required")
        return v

class ReplyCreate(BaseModel):
    body: str

class DraftCreate(BaseModel):
    draft_body: str

class ReassignPayload(BaseModel):
    new_admin_id: int

# ── Helper Utilities ─────────────────────────────────────────────────────────

def sanitize_plaintext(text: str) -> str:
    """Strips all HTML tags to prevent XSS and returns clean plaintext."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]*>", "", text)
    return clean.strip()

def resolve_priority_and_category(subject: str, message: str) -> tuple[str, str]:
    """Determines priority and category based on English/French keywords."""
    content = f"{subject} {message}".lower()
    
    # 1. Resolve Priority
    priority = "LOW"
    if any(k in content for k in HIGH_KEYWORDS):
        priority = "HIGH"
    elif any(k in content for k in MEDIUM_KEYWORDS):
        priority = "MEDIUM"

    # 2. Resolve Category
    category = "general"
    if any(k in content for k in ["baggage", "bagage", "valise", "lost", "perdu"]):
        category = "lost_found" if "lost" in content or "perdu" in content else "baggage"
    elif any(k in content for k in ["delay", "delayed", "retard", "retardé", "annulé", "annule", "cancel", "cancelled", "canceled", "annulation"]):
        category = "delay"
    elif any(k in content for k in ["boarding", "embarquement", "porte", "gate"]):
        category = "boarding"
    elif any(k in content for k in ["security", "securité", "sécurité", "police"]):
        category = "security"
    elif any(k in content for k in ["passport", "passeport", "visa"]):
        category = "passport"
    elif any(k in content for k in ["medical", "médical", "accident", "emergency", "urgence"]):
        category = "medical"
    elif any(k in content for k in ["wheelchair", "fauteuil", "handicap", "accessibility"]):
        category = "accessibility"
    elif any(k in content for k in ["complaint", "reclamation", "plainte"]):
        category = "complaint"

    return priority, category

def auto_release_expired_claims(db: Session):
    """Automatically releases inactive claims older than 20 minutes if no active typing draft lock exists."""
    now = datetime.now(timezone.utc)
    expired_limit = now - timedelta(minutes=20)
    draft_lock_limit = now - timedelta(minutes=5)
    
    # Claim expires if claim_expires_at is past AND no draft saving occurred in the last 5 minutes
    expired_messages = db.query(PassengerMessage).filter(
        PassengerMessage.status == "ASSIGNED",
        PassengerMessage.claim_expires_at < now,
        (PassengerMessage.draft_last_saved_at == None) | (PassengerMessage.draft_last_saved_at < draft_lock_limit)
    ).all()

    for msg in expired_messages:
        logger.info(f"[Helpdesk Claim Expiry] Releasing claim on ticket {msg.reference_id} due to inactivity.")
        
        # Write immutable audit event in the thread
        log_thread = PassengerMessageThread(
            message_id=msg.id,
            sender_type="system",
            sender_name="System",
            body="Ticket ownership released automatically due to inactivity."
        )
        db.add(log_thread)
        
        msg.status = "NEW"
        msg.assigned_admin_id = None
        msg.claimed_at = None
        msg.claim_expires_at = None
        msg.draft_body = None
        msg.draft_last_saved_at = None
        
    db.commit()

def calculate_sla_overdue(created_at: datetime, priority: str) -> bool:
    """Checks if a ticket has exceeded its first-response SLA targets."""
    if not created_at:
        return False
    # Handle both naive and aware datetimes safely
    created = created_at.replace(tzinfo=timezone.utc) if created_at.tzinfo is None else created_at
    elapsed = datetime.now(timezone.utc) - created
    
    if priority == "HIGH":
        return elapsed > timedelta(minutes=15)
    elif priority == "MEDIUM":
        return elapsed > timedelta(minutes=60)
    else:
        return elapsed > timedelta(minutes=180)

def serialize_ticket(msg: PassengerMessage, current_user_id: int, db: Session = None) -> dict:
    """Serializes PassengerMessage ORM record to unified JSON response."""
    now = datetime.now(timezone.utc)
    claim_expires = msg.claim_expires_at.replace(tzinfo=timezone.utc) if msg.claim_expires_at and msg.claim_expires_at.tzinfo is None else msg.claim_expires_at
    draft_last_saved = msg.draft_last_saved_at.replace(tzinfo=timezone.utc) if msg.draft_last_saved_at and msg.draft_last_saved_at.tzinfo is None else msg.draft_last_saved_at
    
    is_expired = claim_expires and claim_expires < now
    has_active_draft_lock = draft_last_saved and draft_last_saved >= now - timedelta(minutes=5)
    
    is_claimed = msg.assigned_admin_id is not None and not (is_expired and not has_active_draft_lock)
    
    # Calculate virtual SLA Overdue state
    is_overdue = False
    if msg.first_response_at is None and msg.status != "RESOLVED":
        is_overdue = calculate_sla_overdue(msg.created_at, msg.priority)
        
    is_read = msg.is_read
    if db and current_user_id:
        exists_read = db.query(PassengerMessageReadState).filter_by(
            message_id=msg.id, admin_id=current_user_id
        ).first() is not None
        is_read = exists_read
        
    return {
        "id": msg.id,
        "reference_id": msg.reference_id,
        "airport_iata": msg.airport_iata,
        "sender_name": msg.sender_name,
        "sender_email": msg.sender_email,
        "subject": msg.subject,
        "message_body": msg.message_body,
        "source": msg.source,
        "priority": msg.priority,
        "category": msg.category,
        "status": msg.status if is_claimed else "NEW",
        "is_read": is_read,
        "assigned_admin_id": msg.assigned_admin_id if is_claimed else None,
        "assigned_admin_name": msg.assigned_admin.full_name if (is_claimed and msg.assigned_admin) else None,
        "claimed_at": msg.claimed_at if is_claimed else None,
        "claim_expires_at": msg.claim_expires_at if is_claimed else None,
        "draft_body": msg.draft_body if (is_claimed and msg.assigned_admin_id == current_user_id) else None,
        "draft_last_saved_at": msg.draft_last_saved_at if is_claimed else None,
        "first_response_at": msg.first_response_at,
        "response_time_minutes": msg.response_time_minutes,
        "is_overdue": is_overdue,
        "created_at": msg.created_at,
        "updated_at": msg.updated_at,
        "sender_type": "passenger",  # Mapped for frontend compatibility
        "replies": [
            {
                "id": r.id,
                "sender_type": r.sender_type,
                "author_name": r.sender_name,
                "author_role": r.admin.role if r.admin else ("admin" if r.sender_type in ("admin", "internal_note") else r.sender_type),
                "body": r.body,
                "email_status": r.email_status,
                "retry_count": r.retry_count,
                "created_at": r.created_at,
            }
            for r in msg.replies
        ]
    }

# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/public/contact-message", status_code=status.HTTP_201_CREATED)
def submit_contact_message(
    payload: ContactMessageCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Submits a contact request from a passenger. Includes rate-limiting,
    HTML XSS sanitization, duplicate spam merges, and auto-confirm emails.
    """
    now = datetime.now(timezone.utc)
    client_ip = request.client.host if request.client else "unknown"
    
    # 1. HTML tag sanitization
    clean_name = sanitize_plaintext(payload.fullName)
    clean_email = sanitize_plaintext(payload.email)
    clean_airport = sanitize_plaintext(payload.airportIata).upper()
    clean_subject = sanitize_plaintext(payload.subject)
    clean_message = sanitize_plaintext(payload.message)

    if not clean_name or not clean_email or not clean_subject or not clean_message:
        raise HTTPException(status_code=422, detail="All message fields are required.")

    # Validate Airport
    if clean_airport not in SUPPORTED_AIRPORTS:
        raise HTTPException(status_code=400, detail="Invalid airport code selected.")

    # 2. Rate Limiting: Max 5 submissions per 15 minutes per IP or Email
    fifteen_min_ago = now - timedelta(minutes=15)
    rate_count = db.query(func.count(PassengerMessage.id)).filter(
        (PassengerMessage.sender_email == clean_email) | (PassengerMessage.source == client_ip),
        PassengerMessage.created_at >= fifteen_min_ago
    ).scalar()

    if rate_count >= 5:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please wait a few minutes before submitting another request."
        )

    # 3. Duplicate Protection: Check 10 minutes matching email/airport
    ten_min_ago = now - timedelta(minutes=10)
    existing_ticket = db.query(PassengerMessage).filter(
        PassengerMessage.sender_email == clean_email,
        PassengerMessage.airport_iata == clean_airport,
        PassengerMessage.created_at >= ten_min_ago
    ).order_by(PassengerMessage.created_at.desc()).first()

    if existing_ticket:
        # Merge criteria: Match if identical or same first 200 chars prefix
        body_prefix = clean_message[:200]
        exist_prefix = existing_ticket.message_body[:200]
        
        if body_prefix == exist_prefix:
            logger.info(f"[Helpdesk Spam Guard] Merging duplicate inquiry from {clean_email} into {existing_ticket.reference_id}")
            
            # Append duplicate payload body directly into thread
            duplicate_thread = PassengerMessageThread(
                message_id=existing_ticket.id,
                sender_type="passenger",
                sender_name=clean_name,
                sender_email=clean_email,
                body=f"[Duplicate Request Appended]:\n{clean_message}"
            )
            db.add(duplicate_thread)
            existing_ticket.updated_at = now
            db.commit()
            
            return {
                "success": True,
                "reference_id": existing_ticket.reference_id,
                "message": "Your previous request is already being processed.",
                "appended": True
            }

    # 4. Resolve priority & Category
    priority, category = resolve_priority_and_category(clean_subject, clean_message)

    # 5. Generate Reference ID
    date_str = now.strftime("%Y%m%d")
    rand_digits = "".join(random.choices("0123456789", k=4))
    reference_id = f"{clean_airport}-{date_str}-{rand_digits}"

    # 6. Save new ticket
    ticket = PassengerMessage(
        reference_id=reference_id,
        airport_iata=clean_airport,
        sender_name=clean_name,
        sender_email=clean_email,
        subject=clean_subject,
        message_body=clean_message,
        source=client_ip,
        priority=priority,
        category=category,
        status="NEW",
        is_read=False
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # 7. Auto-acknowledgment passenger confirmation email
    msg_id_hdr = f"<confirm-{reference_id}-{int(now.timestamp())}@smartairport.tn>"
    
    # Save the system confirmation in thread
    system_confirm = PassengerMessageThread(
        message_id=ticket.id,
        sender_type="system",
        sender_name="System",
        body=f"Confirmation email dispatched with ticket Reference ID: {reference_id}",
        message_id_header=msg_id_hdr
    )
    db.add(system_confirm)
    db.commit()

    # Trigger SMTP delivery in background
    sent = send_passenger_confirmation_email(
        passenger_name=clean_name,
        passenger_email=clean_email,
        airport_iata=clean_airport,
        subject=clean_subject,
        message_body=clean_message,
        reference_id=reference_id,
        message_id_header=msg_id_hdr
    )
    if not sent:
        system_confirm.email_status = "failed"
        db.commit()

    return {
        "success": True,
        "reference_id": reference_id,
        "message": "Your message has been sent to the selected airport operations team."
    }


@router.get("/admin/messages")
def list_passenger_messages(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """
    Returns helpdesk passenger tickets with claim timeouts auto-release checking.
    Strictly enforces airport boundaries for standard admins.
    """
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    # 1. Automatically release expired claims dynamically
    auto_release_expired_claims(db)
    
    query = db.query(PassengerMessage)

    # 2. Enforce Airport Boundary
    if current_user.role == "admin":
        query = query.filter(PassengerMessage.airport_iata == current_user.airport_iata)
        
    if status_filter and status_filter != "all":
        # Handle custom unresolved filters
        if status_filter == "unresolved":
            query = query.filter(PassengerMessage.status != "RESOLVED")
        elif status_filter == "failed_emails":
            # Filter tickets containing failed email logs
            query = query.join(PassengerMessage.replies).filter(
                PassengerMessageThread.email_status == "failed"
            )
        else:
            query = query.filter(PassengerMessage.status == status_filter.upper())
            
    tickets = query.order_by(PassengerMessage.created_at.desc()).all()
    
    return {"data": [serialize_ticket(t, current_user.id, db) for t in tickets], "error": None}


@router.get("/admin/messages/unread-count")
def get_admin_messages_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """
    Returns unread counts for both helpdesk passenger tickets and internal admin-to-admin messages.
    - Airport Admin: count only unread tickets/messages for their airport.
    - Super Admin: count all unread passenger tickets/messages.
    """
    if current_user.role == "super_admin":
        internal_unread = db.query(func.count(Message.id)).filter(
            Message.direction == "to_super",
            Message.is_read == False
        ).scalar()
        return {
            "totalUnread": int(internal_unread or 0),
            "passengerUnread": 0,
            "internalUnread": int(internal_unread or 0),
            "count": int(internal_unread or 0)
        }

    # Optimize using indexed EXISTS query to avoid N+1 scans
    if current_user.role == "super_admin":
        pass_unread_query = db.query(func.count(PassengerMessage.id)).filter(
            ~exists().where(
                (PassengerMessageReadState.message_id == PassengerMessage.id) &
                (PassengerMessageReadState.admin_id == current_user.id)
            )
        )
    else:
        pass_unread_query = db.query(func.count(PassengerMessage.id)).filter(
            PassengerMessage.airport_iata == current_user.airport_iata,
            ~exists().where(
                (PassengerMessageReadState.message_id == PassengerMessage.id) &
                (PassengerMessageReadState.admin_id == current_user.id)
            )
        )
    passenger_unread = pass_unread_query.scalar()

    # Internal Messages Unread count (is_read == False)
    if current_user.role == "super_admin":
        internal_unread = db.query(func.count(Message.id)).filter(
            Message.direction == "to_super",
            Message.is_read == False
        ).scalar()
    else:
        internal_unread = db.query(func.count(Message.id)).filter(
            Message.direction == "to_admin",
            Message.to_user_id == current_user.id,
            Message.is_read == False
        ).scalar()

    total_unread = int(passenger_unread or 0) + int(internal_unread or 0)

    return {
        "totalUnread": total_unread,
        "passengerUnread": int(passenger_unread or 0),
        "internalUnread": int(internal_unread or 0),
        "count": total_unread
    }


@router.post("/admin/messages/{messageId}/read")
def mark_passenger_ticket_read(
    messageId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """Marks a passenger ticket as read on a per-admin basis."""
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == messageId).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
        
    if current_user.role == "admin" and ticket.airport_iata != current_user.airport_iata:
        raise HTTPException(status_code=403, detail="Standard admins can only view tickets within their assigned airport.")

    # Safe ON CONFLICT DO NOTHING (Enforce uniqueness to avoid duplicates)
    exists_read = db.query(PassengerMessageReadState).filter_by(
        message_id=messageId, admin_id=current_user.id
    ).first()
    
    if not exists_read:
        read_state = PassengerMessageReadState(message_id=messageId, admin_id=current_user.id)
        db.add(read_state)
        try:
            db.commit()
        except Exception:
            db.rollback()

    return {"success": True}


@router.post("/admin/messages/{messageId}/claim")
def claim_passenger_ticket(
    messageId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """
    Atomically claims a passenger ticket for 20 minutes if unclaimed.
    Enforces airport boundary.
    """
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    now = datetime.now(timezone.utc)
    expiry = now + timedelta(minutes=20)
    
    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == messageId).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    # 1. Enforce Boundary
    if current_user.role == "admin" and ticket.airport_iata != current_user.airport_iata:
        raise HTTPException(status_code=403, detail="Standard admins can only claim tickets for their assigned airport.")

    # 2. Check Expiration & Draft Lock before rejecting claim
    draft_lock_limit = now - timedelta(minutes=5)
    ticket_claim_expires = ticket.claim_expires_at.replace(tzinfo=timezone.utc) if ticket.claim_expires_at and ticket.claim_expires_at.tzinfo is None else ticket.claim_expires_at
    ticket_draft_last_saved = ticket.draft_last_saved_at.replace(tzinfo=timezone.utc) if ticket.draft_last_saved_at and ticket.draft_last_saved_at.tzinfo is None else ticket.draft_last_saved_at
    
    is_expired = ticket_claim_expires and ticket_claim_expires < now
    has_active_draft_lock = ticket_draft_last_saved and ticket_draft_last_saved >= draft_lock_limit
    
    is_currently_claimed = ticket.assigned_admin_id is not None and not (is_expired and not has_active_draft_lock)
    
    if is_currently_claimed:
        raise HTTPException(
            status_code=409,
            detail="This message is already being handled by another admin."
        )

    # 3. Atomic database update
    rows = db.query(PassengerMessage).filter(
        PassengerMessage.id == messageId,
        (PassengerMessage.assigned_admin_id == None) | 
        (PassengerMessage.claim_expires_at < now) & 
        ((PassengerMessage.draft_last_saved_at == None) | (PassengerMessage.draft_last_saved_at < draft_lock_limit))
    ).update({
        PassengerMessage.assigned_admin_id: current_user.id,
        PassengerMessage.status: "ASSIGNED",
        PassengerMessage.claimed_at: now,
        PassengerMessage.claim_expires_at: expiry,
        PassengerMessage.is_read: True,
        PassengerMessage.updated_at: now
    }, synchronize_session=False)

    if rows == 0:
        raise HTTPException(
            status_code=409,
            detail="This message is already being handled by another admin."
        )

    # Log claim
    log_thread = PassengerMessageThread(
        message_id=messageId,
        sender_type="system",
        sender_name="System",
        admin_id=current_user.id,
        body=f"Ticket claimed by admin {current_user.full_name}."
    )
    db.add(log_thread)
    db.commit()

    # Re-fetch ticket after update
    db.expire_all()
    updated_ticket = db.query(PassengerMessage).filter(PassengerMessage.id == messageId).first()
    return {"data": serialize_ticket(updated_ticket, current_user.id, db), "error": None}


@router.post("/admin/messages/{messageId}/heartbeat")
def claim_heartbeat_refresh(
    messageId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """Refreshes and extends active claim expiry by another 20 minutes while admin is typing/active."""
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    now = datetime.now(timezone.utc)
    ticket = db.query(PassengerMessage).filter(
        PassengerMessage.id == messageId,
        PassengerMessage.assigned_admin_id == current_user.id
    ).first()
    
    if not ticket:
        raise HTTPException(status_code=403, detail="Only the assigned admin can refresh the claim heartbeat.")

    ticket.claim_expires_at = now + timedelta(minutes=20)
    ticket.updated_at = now
    db.commit()
    
    return {"success": True, "claim_expires_at": ticket.claim_expires_at}


@router.patch("/admin/messages/{messageId}/draft")
def autosave_draft_reply(
    messageId: int,
    payload: DraftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """Autosaves response drafts and keeps draft lock active."""
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    now = datetime.now(timezone.utc)
    ticket = db.query(PassengerMessage).filter(
        PassengerMessage.id == messageId,
        PassengerMessage.assigned_admin_id == current_user.id
    ).first()
    
    if not ticket:
        raise HTTPException(status_code=403, detail="Only the assigned admin can edit and save drafts.")

    ticket.draft_body = payload.draft_body
    ticket.draft_last_saved_at = now
    ticket.claim_expires_at = now + timedelta(minutes=20) # Extends claim automatically
    ticket.updated_at = now
    db.commit()
    
    return {"success": True, "draft_last_saved_at": ticket.draft_last_saved_at}


@router.post("/admin/messages/{messageId}/reply")
def reply_to_passenger(
    messageId: int,
    payload: ReplyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """
    Sends email reply to the passenger. Strictly checks assigned ownership.
    Ensures Message-ID/In-Reply-To tracking headers and footer disclaimers.
    """
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    now = datetime.now(timezone.utc)
    clean_body = sanitize_plaintext(payload.body)
    
    if not clean_body:
        raise HTTPException(status_code=422, detail="Reply body cannot be empty.")

    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == messageId).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    # Strict Safety Block
    if ticket.assigned_admin_id is None:
        raise HTTPException(status_code=400, detail="Please claim this message before replying.")
    if ticket.assigned_admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned admin can reply to this message.")
    if ticket.status == "RESOLVED":
        raise HTTPException(status_code=400, detail="Cannot reply to a resolved ticket.")

    # 1. Update SLA Timers
    if ticket.first_response_at is None:
        ticket.first_response_at = now
        # Naive calculation safely
        created_time = ticket.created_at.replace(tzinfo=timezone.utc) if ticket.created_at.tzinfo is None else ticket.created_at
        elapsed = now - created_time
        ticket.response_time_minutes = int(elapsed.total_seconds() / 60)

    # 2. Formulate Email ID Threading Headers
    msg_id_header = f"<reply-{messageId}-{int(now.timestamp())}@smartairport.tn>"
    
    # Retrieve confirmation message ID header for threading In-Reply-To link
    first_thread = db.query(PassengerMessageThread).filter(
        PassengerMessageThread.message_id == messageId,
        PassengerMessageThread.sender_type == "system",
        PassengerMessageThread.message_id_header != None
    ).order_by(PassengerMessageThread.created_at.asc()).first()
    
    in_reply_to_header = first_thread.message_id_header if first_thread else None
    references_header = first_thread.message_id_header if first_thread else None

    # 3. Create Reply record in database
    reply_thread = PassengerMessageThread(
        message_id=messageId,
        sender_type="admin",
        sender_name=current_user.full_name,
        admin_id=current_user.id,
        body=clean_body,
        email_status="failed", # Set failed by default until SMTP finishes
        message_id_header=msg_id_header,
        retry_count=0
    )
    db.add(reply_thread)
    
    # Clear draft and transition status
    ticket.draft_body = None
    ticket.draft_last_saved_at = None
    ticket.status = "REPLIED"
    ticket.replied_at = now
    ticket.replied_by_admin_id = current_user.id
    ticket.updated_at = now
    
    db.commit()

    # 4. Dispatch Reply Email via SMTP
    sent = send_passenger_reply_email(
        passenger_name=ticket.sender_name,
        passenger_email=ticket.sender_email,
        original_subject=ticket.subject,
        original_body=ticket.message_body,
        reply_body=clean_body,
        admin_name=current_user.full_name,
        airport_iata=ticket.airport_iata,
        reference_id=ticket.reference_id,
        message_id_header=msg_id_header,
        in_reply_to_header=in_reply_to_header,
        references_header=references_header
    )

    if sent:
        reply_thread.email_status = "sent"
        db.commit()
        return {
            "success": True,
            "email_delivery_status": "sent",
            "message": "Reply saved and email dispatched successfully.",
            "data": serialize_ticket(ticket, current_user.id, db)
        }
    else:
        logger.warning(f"[Helpdesk SMTP Fail] Reply saved in thread, but email failed to dispatch to {ticket.sender_email}")
        return {
            "success": True,
            "email_delivery_status": "failed",
            "message": "Reply saved, but email delivery failed.",
            "data": serialize_ticket(ticket, current_user.id, db)
        }


@router.post("/admin/messages/{messageId}/internal-note")
def add_internal_note(
    messageId: int,
    payload: ReplyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """Adds an internal coordination note visible only to admins inside the thread."""
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    clean_body = sanitize_plaintext(payload.body)
    if not clean_body:
        raise HTTPException(status_code=422, detail="Note body cannot be empty.")

    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == messageId).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    # Boundary check
    if current_user.role == "admin" and ticket.airport_iata != current_user.airport_iata:
        raise HTTPException(status_code=403, detail="Standard admins can only add notes to tickets within their assigned airport.")

    note_thread = PassengerMessageThread(
        message_id=messageId,
        sender_type="internal_note",
        sender_name=current_user.full_name,
        admin_id=current_user.id,
        body=clean_body,
        email_status=None
    )
    db.add(note_thread)
    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"success": True, "data": serialize_ticket(ticket, current_user.id, db)}


@router.post("/admin/messages/replies/{replyId}/retry-email")
def retry_failed_email_reply(
    replyId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """Re-attempts dispatching failed emails inside replies up to 3 times."""
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    reply = db.query(PassengerMessageThread).filter(PassengerMessageThread.id == replyId).first()
    if not reply or reply.sender_type != "admin":
        raise HTTPException(status_code=404, detail="Reply log not found.")

    ticket = reply.message
    
    # 1. Safety ownership checks
    if ticket.assigned_admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned admin can trigger email retries on this ticket.")

    if reply.email_status == "sent":
        return {"success": True, "email_status": "sent", "message": "Email is already delivered."}

    if reply.retry_count >= 3:
        reply.email_status = "PERMANENT_FAILURE"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Max retry limits reached (3). Ticket marked as PERMANENT_FAILURE."
        )

    reply.retry_count += 1
    db.commit()

    # Formulate headers
    first_thread = db.query(PassengerMessageThread).filter(
        PassengerMessageThread.message_id == ticket.id,
        PassengerMessageThread.sender_type == "system",
        PassengerMessageThread.message_id_header != None
    ).order_by(PassengerMessageThread.created_at.asc()).first()
    
    in_reply_to_header = first_thread.message_id_header if first_thread else None

    # Retry SMTP
    sent = send_passenger_reply_email(
        passenger_name=ticket.sender_name,
        passenger_email=ticket.sender_email,
        original_subject=ticket.subject,
        original_body=ticket.message_body,
        reply_body=reply.body,
        admin_name=current_user.full_name,
        airport_iata=ticket.airport_iata,
        reference_id=ticket.reference_id,
        message_id_header=reply.message_id_header,
        in_reply_to_header=in_reply_to_header,
        references_header=in_reply_to_header
    )

    if sent:
        reply.email_status = "sent"
        db.commit()
        return {"success": True, "email_status": "sent", "message": "Email sent successfully on retry."}
    else:
        if reply.retry_count >= 3:
            reply.email_status = "PERMANENT_FAILURE"
            db.commit()
            return {"success": False, "email_status": "PERMANENT_FAILURE", "message": "Retry failed. Marked as permanent failure."}
        return {"success": False, "email_status": "failed", "message": f"Retry failed ({reply.retry_count}/3)."}


@router.post("/admin/messages/{messageId}/resolve")
def resolve_passenger_ticket(
    messageId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """Resolves a ticket. Restricts resolution safety to prevent accidental empty closures."""
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    now = datetime.now(timezone.utc)
    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == messageId).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    # 1. Enforce Airport Boundary
    if current_user.role == "admin" and ticket.airport_iata != current_user.airport_iata:
        raise HTTPException(status_code=403, detail="Standard admins can only resolve tickets within their assigned airport.")

    # 2. Resolution Safety: Block if status = NEW / no responses are made yet, unless super admin
    is_new_unreplied = (ticket.status == "NEW" or ticket.replied_at is None)
    if is_new_unreplied and current_user.role != "super_admin":
        raise HTTPException(
            status_code=400,
            detail="Resolution blocked. An operational response must be sent to the passenger before resolving this ticket."
        )

    # Strict ownership check if claimed
    if ticket.assigned_admin_id and ticket.assigned_admin_id != current_user.id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only the assigned admin or a Super Admin can resolve this ticket.")

    ticket.status = "RESOLVED"
    ticket.resolved_at = now
    ticket.resolved_by_admin_id = current_user.id
    ticket.updated_at = now

    # Write immutable log
    log_thread = PassengerMessageThread(
        message_id=messageId,
        sender_type="system",
        sender_name="System",
        admin_id=current_user.id,
        body=f"Ticket closed and resolved by admin {current_user.full_name}."
    )
    db.add(log_thread)
    db.commit()

    return {"success": True, "data": serialize_ticket(ticket, current_user.id, db)}


# ── Super Admin Controls ──────────────────────────────────────────────────────

@router.post("/admin/messages/{messageId}/release-claim")
def force_release_ticket_claim(
    messageId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """Super Admin force-releases stuck ticket claims and wipes active locks."""
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin privileges are required to force-release locks.")

    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == messageId).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    ticket.status = "NEW"
    ticket.assigned_admin_id = None
    ticket.claimed_at = None
    ticket.claim_expires_at = None
    ticket.draft_body = None
    ticket.draft_last_saved_at = None
    ticket.updated_at = datetime.now(timezone.utc)

    # Immutable log
    log_thread = PassengerMessageThread(
        message_id=messageId,
        sender_type="system",
        sender_name="System",
        admin_id=current_user.id,
        body=f"Claim lock force-released by Super Admin {current_user.full_name}."
    )
    db.add(log_thread)
    db.commit()

    return {"success": True, "data": serialize_ticket(ticket, current_user.id, db)}


@router.post("/admin/messages/{messageId}/reassign")
def reassign_ticket_claim(
    messageId: int,
    payload: ReassignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """Super Admin reassigns a ticket atomically to another airport admin, resetting locks."""
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin privileges are required to reassign tickets.")

    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == messageId).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    new_admin = db.query(User).filter(User.id == payload.new_admin_id, User.role == "admin").first()
    if not new_admin:
        raise HTTPException(status_code=404, detail="Selected target airport admin not found.")

    # Reassign atomically
    now = datetime.now(timezone.utc)
    ticket.assigned_admin_id = new_admin.id
    ticket.status = "ASSIGNED"
    ticket.claimed_at = now
    ticket.claim_expires_at = now + timedelta(minutes=20)
    ticket.draft_body = None
    ticket.draft_last_saved_at = None
    ticket.updated_at = now

    # Clean read state for new admin to ensure it's marked as unread
    db.query(PassengerMessageReadState).filter_by(
        message_id=messageId, admin_id=new_admin.id
    ).delete()

    # Immutable log
    log_thread = PassengerMessageThread(
        message_id=messageId,
        sender_type="system",
        sender_name="System",
        admin_id=current_user.id,
        body=f"Ticket reassigned by Super Admin to {new_admin.full_name}."
    )
    db.add(log_thread)
    db.commit()

    return {"success": True, "data": serialize_ticket(ticket, current_user.id, db)}


@router.post("/admin/messages/{messageId}/reopen")
def reopen_resolved_ticket(
    messageId: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_admin)
):
    """Super Admin reopens a resolved ticket."""
    if current_user.role == "super_admin":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Passenger support tickets are managed by airport admins only."
            }
        )

    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin privileges are required to reopen tickets.")

    ticket = db.query(PassengerMessage).filter(PassengerMessage.id == messageId).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    if ticket.status != "RESOLVED":
        raise HTTPException(status_code=400, detail="Ticket is already active.")

    ticket.status = "ASSIGNED" if ticket.assigned_admin_id else "NEW"
    ticket.resolved_at = None
    ticket.resolved_by_admin_id = None
    ticket.updated_at = datetime.now(timezone.utc)

    # Immutable log
    log_thread = PassengerMessageThread(
        message_id=messageId,
        sender_type="system",
        sender_name="System",
        admin_id=current_user.id,
        body=f"Ticket reopened by Super Admin {current_user.full_name}."
    )
    db.add(log_thread)
    db.commit()

    return {"success": True, "data": serialize_ticket(ticket, current_user.id, db)}
