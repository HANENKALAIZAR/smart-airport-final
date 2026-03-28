"""
Smart Airport Operations – Admin User Management Router
=========================================================
Super-admin-only endpoints for creating and managing airport admins.
All endpoints require a valid super_admin JWT token.
"""

import re
import uuid
import secrets
import string
import logging
from datetime import datetime, timezone, date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.models import User, AuditLog, CorrectionRequest
from app.dependencies import require_super_admin, get_current_user
from app.services.email_service import (
    send_welcome_email,
    send_id_rejection_email,
    AIRPORT_DISPLAY,
)
from app.services.in_app_notify import notify_all_super_admins, notify_airport_admin
from app.schemas.schemas import (
    ProfileCompleteRequest,
    PatchMySettingsRequest,
    IdDocumentReuploadRequest,
    AdminReviewDetail,
    IdReviewRequest,
    CorrectionRequestOut,
    MeCorrectionRequestBody,
    CorrectionDismissBody,
    IdProfileResubmitRequest,
)
from app.validators import (
    normalize_tunisian_phone,
    validate_tunisian_phone_digits,
    validate_id_document_data_url,
    validate_profile_photo_data_url,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["User Management"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Airport slug map ────────────────────────────────────────────────────
AIRPORT_SLUGS = {
    "TUN": "tun",
    "SFA": "sfa",
    "MIR": "mir",
    "DJE": "dje",
    "TOE": "toe",
    "NBE": "nbe",
    "TBJ": "tbj",
    "GAF": "gaf",
}


# ── Helpers ─────────────────────────────────────────────────────────────

def _generate_temp_password(length: int = 12) -> str:
    """Generate a cryptographically secure temporary password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.isupper() for c in pwd)
            and any(c.isdigit() for c in pwd)
            and any(c in "!@#$%" for c in pwd)
        ):
            return pwd


def _normalise_name(full_name: str) -> tuple[str, str]:
    """Return (first, rest_dotted) normalised for email use."""
    name_part = full_name.strip().lower()
    for pattern, repl in [
        (r"[àáâãäå]", "a"), (r"[èéêë]", "e"),
        (r"[ìíîï]", "i"), (r"[òóôõö]", "o"), (r"[ùúûü]", "u"),
    ]:
        name_part = re.sub(pattern, repl, name_part)
    name_part = re.sub(r"[^a-z ]", "", name_part).strip()
    parts = name_part.split()
    first = parts[0] if parts else "admin"
    rest = ".".join(parts[1:]) if len(parts) > 1 else "user"
    return first, rest


def _email_domain(airport_iata: str) -> str:
    code = AIRPORT_SLUGS.get(airport_iata, airport_iata.lower())
    return f"{code}-airport.tn"


def _suggest_emails(full_name: str, airport_iata: str) -> list[str]:
    """Return ordered list of email candidates (see product spec fallbacks)."""
    domain = _email_domain(airport_iata)
    code = airport_iata.lower()
    name_part = full_name.strip().lower()
    for pattern, repl in [
        (r"[àáâãäå]", "a"), (r"[èéêë]", "e"),
        (r"[ìíîï]", "i"), (r"[òóôõö]", "o"), (r"[ùúûü]", "u"),
    ]:
        name_part = re.sub(pattern, repl, name_part)
    name_part = re.sub(r"[^a-z ]", "", name_part).strip()
    parts = name_part.split()
    if not parts:
        parts = ["admin", "user"]
    first = parts[0]
    rest = ".".join(parts[1:]) if len(parts) > 1 else "user"
    last = parts[-1]
    # 3. firstname.m.lastname — middle initial + family name
    if len(parts) >= 2:
        middle_initial = parts[1][0]
        third = f"{first}.{middle_initial}.{last}@{domain}"
    else:
        third = f"{first}.{first[0]}.{rest}@{domain}"
    # 4. f.lastname — first initial + last name only
    fourth = f"{first[0]}.{last}@{domain}"
    return [
        f"{first}.{rest}@{domain}",
        f"{first}.{rest}2@{domain}",
        third,
        fourth,
        f"{first}.{rest}.{code}@{domain}",
    ]


# ── Schemas ──────────────────────────────────────────────────────────────

class AdminCreateRequest(BaseModel):
    full_name: str
    airport_iata: str
    # Stored as users.email (UNIQUE) — auth/login. Not a separate DB column named work_email.
    work_email: str
    # Stored as users.personal_email — not unique; welcome email delivery only.
    personal_email: str
    bypass_duplicate: bool = False


class AdminOut(BaseModel):
    id: int
    full_name: str
    email: str
    airport_iata: Optional[str] = None
    role: str
    is_active: int
    must_change_password: int
    profile_complete: int = 0

    class Config:
        from_attributes = True


class AdminListItem(BaseModel):
    id: int
    full_name: str
    email: str
    personal_email: Optional[str] = None
    airport_iata: Optional[str] = None
    role: str
    is_active: int
    profile_complete: int = 0
    id_document_status: Optional[str] = None
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class DuplicateCheckRequest(BaseModel):
    full_name: str
    airport_code: str


# ── Endpoints ────────────────────────────────────────────────────────────

@router.get("/admins/check-email")
def check_email_availability(
    email: str,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """Check if a work (login) email is available — must be unique on users.email."""
    existing = db.query(User).filter(User.email == email.lower().strip()).first()
    return {"available": existing is None}


@router.get("/admins/suggest-email")
def suggest_email(
    full_name: str,
    airport_iata: str,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """Return the first available email suggestion for a name+airport combo."""
    airport_iata = airport_iata.upper()
    if airport_iata not in AIRPORT_SLUGS:
        raise HTTPException(status_code=422, detail=f"Unknown airport IATA: {airport_iata}")

    suggestions = _suggest_emails(full_name, airport_iata)
    for i, suggestion in enumerate(suggestions):
        low = suggestion.lower()
        existing = db.query(User).filter(User.email == low).first()
        if not existing:
            return {"email": low, "is_fallback": i > 0, "all_suggestions": suggestions}

    return {"email": suggestions[-1].lower(), "is_fallback": True, "all_suggestions": suggestions}


@router.post("/admins/check-duplicate")
def check_duplicate(
    payload: DuplicateCheckRequest,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """Check if an admin with same full name exists at same airport."""
    name_lower = payload.full_name.strip().lower()
    airport = payload.airport_code.upper()

    existing = db.query(User).filter(
        User.role == "admin",
        User.airport_iata == airport,
    ).all()

    for u in existing:
        if u.full_name.strip().lower() == name_lower:
            return {
                "duplicate": True,
                "existing": {
                    "id": u.id,
                    "full_name": u.full_name,
                    "email": u.email,
                    "airport_iata": u.airport_iata,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                },
            }
    return {"duplicate": False}


@router.post("/admins", response_model=AdminOut, status_code=status.HTTP_201_CREATED)
def create_admin(
    payload: AdminCreateRequest,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """
    Super admin creates a new airport admin.
    - work_email: unique login (stored in users.email)
    - personal_email: welcome message recipient (users.personal_email, not unique)
    """
    if not payload.full_name.strip():
        raise HTTPException(status_code=422, detail="Full name cannot be empty")

    airport_iata = payload.airport_iata.upper()
    if airport_iata not in AIRPORT_SLUGS:
        raise HTTPException(status_code=422, detail=f"Unknown airport IATA: {airport_iata}")

    work_email = payload.work_email.lower().strip()
    personal_email = payload.personal_email.strip()

    if not work_email or "@" not in work_email:
        raise HTTPException(status_code=422, detail="Invalid work email address")
    if not personal_email or "@" not in personal_email:
        raise HTTPException(status_code=422, detail="Invalid personal email address")

    # Uniqueness applies only to work (login) email
    if db.query(User).filter(User.email == work_email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This work email is already in use.",
        )

    # Server-side duplicate name check (hard block if bypass not acknowledged)
    if not payload.bypass_duplicate:
        name_lower = payload.full_name.strip().lower()
        existing_admins = db.query(User).filter(
            User.role == "admin", User.airport_iata == airport_iata,
        ).all()
        for u in existing_admins:
            if u.full_name.strip().lower() == name_lower:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"An admin named '{u.full_name}' already exists at {airport_iata}. "
                        "Set bypass_duplicate=true to proceed."
                    ),
                )

    temp_password = _generate_temp_password()

    user = User(
        email=work_email,
        personal_email=personal_email,
        password_hash=pwd_context.hash(temp_password),
        full_name=payload.full_name,
        role="admin",
        airport_iata=airport_iata,
        is_active=1,
        must_change_password=1,
        profile_complete=0,
    )
    db.add(user)
    db.flush()  # get user.id

    # Audit log for bypassed duplicate warning
    if payload.bypass_duplicate:
        audit = AuditLog(
            super_admin_id=_super.id,
            action="bypassed_duplicate_warning",
            target_name=payload.full_name,
            details=f"Airport: {airport_iata}, work_email: {work_email}, personal_email: {personal_email}",
        )
        db.add(audit)

    db.commit()
    db.refresh(user)

    # Welcome email — best-effort
    try:
        send_welcome_email(
            full_name=payload.full_name,
            personal_email=personal_email,
            work_email=work_email,
            temp_password=temp_password,
            airport_iata=airport_iata,
            id_verification_required=payload.bypass_duplicate,
        )
    except Exception as exc:
        logger.error(f"Welcome email error for {personal_email}: {exc}")

    logger.info(
        f"Super admin created new admin: work={work_email} personal={personal_email} ({airport_iata})"
    )
    return user


@router.post("/me/profile", status_code=200)
def complete_my_profile(
    payload: ProfileCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin completes their onboarding profile after changing password.
    Sets profile_complete=1.
    """
    if payload.id_type not in ("CIN", "Passport"):
        raise HTTPException(status_code=422, detail="id_type must be 'CIN' or 'Passport'")

    if payload.id_type == "CIN" and not re.match(r"^\d{8}$", payload.id_number):
        raise HTTPException(status_code=422, detail="CIN must be exactly 8 digits")

    if payload.id_type == "Passport" and not re.match(
        r"^[A-Z0-9]{8,9}$", payload.id_number.upper()
    ):
        raise HTTPException(
            status_code=422, detail="Passport must be 8-9 alphanumeric characters"
        )

    try:
        dob = datetime.strptime(payload.date_of_birth, "%Y-%m-%d").date()
        age = (date.today() - dob).days // 365
        if age < 18:
            raise HTTPException(status_code=422, detail="Must be at least 18 years old")
    except ValueError:
        raise HTTPException(status_code=422, detail="date_of_birth must be YYYY-MM-DD")

    phone_norm = normalize_tunisian_phone(payload.phone_number)
    if not validate_tunisian_phone_digits(phone_norm):
        raise HTTPException(
            status_code=422,
            detail=(
                "Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)"
            ),
        )

    try:
        validate_profile_photo_data_url(payload.profile_photo_url)
        validate_id_document_data_url(payload.id_document_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    current_user.phone_number = phone_norm
    current_user.date_of_birth = dob
    current_user.id_type = payload.id_type
    current_user.id_number = payload.id_number
    current_user.id_document_url = payload.id_document_url
    current_user.profile_photo_url = payload.profile_photo_url
    current_user.profile_complete = 1
    current_user.id_document_status = "pending"
    current_user.id_document_rejection_reason = None
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()

    iata = current_user.airport_iata or ""
    airport_label = AIRPORT_DISPLAY.get(iata, iata or "Unknown")
    body = (
        f"{current_user.full_name} assigned to {airport_label} has submitted their ID document for review."
    )
    try:
        notify_all_super_admins(
            db,
            kind="id_submitted_review",
            body=body,
            context={
                "action": "open_admin_review",
                "admin_id": current_user.id,
            },
        )
        db.commit()
    except Exception as exc:
        logger.error(f"In-app ID review notification error: {exc}")
        db.rollback()

    logger.info(f"Profile completed: {current_user.email}")
    return {"message": "Profile completed successfully"}


@router.patch("/me/settings", status_code=200)
def patch_my_settings(
    payload: PatchMySettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update phone and/or profile photo (airport admins)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only airport admins can update these fields here.")
    if payload.phone_number is None and payload.profile_photo_url is None:
        raise HTTPException(status_code=422, detail="Nothing to update.")

    if payload.phone_number is not None:
        phone_norm = normalize_tunisian_phone(payload.phone_number)
        if not validate_tunisian_phone_digits(phone_norm):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)"
                ),
            )
        current_user.phone_number = phone_norm

    if payload.profile_photo_url is not None:
        try:
            validate_profile_photo_data_url(payload.profile_photo_url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        current_user.profile_photo_url = payload.profile_photo_url

    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Settings updated"}


@router.post("/me/id-document", status_code=200)
def reupload_id_document(
    payload: IdDocumentReuploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-submit ID document after super admin rejection."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed.")
    if current_user.id_document_status != "rejected":
        raise HTTPException(
            status_code=422,
            detail="Re-upload is only available after your ID was rejected.",
        )

    try:
        validate_id_document_data_url(payload.id_document_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    current_user.id_document_url = payload.id_document_url
    current_user.id_document_status = "pending"
    current_user.id_document_rejection_reason = None
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()

    iata = current_user.airport_iata or ""
    airport_label = AIRPORT_DISPLAY.get(iata, iata or "Unknown")
    body = (
        f"{current_user.full_name} assigned to {airport_label} has submitted their ID document for review."
    )
    try:
        notify_all_super_admins(
            db,
            kind="id_submitted_review",
            body=body,
            context={
                "action": "open_admin_review",
                "admin_id": current_user.id,
            },
        )
        db.commit()
    except Exception as exc:
        logger.error(f"In-app ID review notification error: {exc}")
        db.rollback()

    return {"message": "ID document submitted for review"}


@router.post("/me/id-profile-resubmit", status_code=200)
def resubmit_unlocked_id_profile(
    payload: IdProfileResubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """After super admin unlocks ID fields, admin saves corrected ID data."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed.")
    if not getattr(current_user, "id_fields_unlocked", 0):
        raise HTTPException(
            status_code=422,
            detail="ID fields are not unlocked.",
        )

    if payload.id_type not in ("CIN", "Passport"):
        raise HTTPException(status_code=422, detail="id_type must be 'CIN' or 'Passport'")

    if payload.id_type == "CIN" and not re.match(r"^\d{8}$", payload.id_number):
        raise HTTPException(status_code=422, detail="CIN must be exactly 8 digits")

    if payload.id_type == "Passport" and not re.match(
        r"^[A-Z0-9]{8,9}$", payload.id_number.upper()
    ):
        raise HTTPException(
            status_code=422, detail="Passport must be 8-9 alphanumeric characters"
        )

    try:
        validate_id_document_data_url(payload.id_document_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    current_user.id_type = payload.id_type
    current_user.id_number = payload.id_number
    current_user.id_document_url = payload.id_document_url
    current_user.id_fields_unlocked = 0
    current_user.id_document_status = "pending"
    current_user.id_document_rejection_reason = None
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()

    iata = current_user.airport_iata or ""
    airport_label = AIRPORT_DISPLAY.get(iata, iata or "Unknown")
    body = (
        f"{current_user.full_name} assigned to {airport_label} has submitted their ID document for review."
    )
    try:
        notify_all_super_admins(
            db,
            kind="id_resubmitted_review",
            body=body,
            context={
                "action": "open_admin_review",
                "admin_id": current_user.id,
            },
        )
        db.commit()
    except Exception as exc:
        logger.error(f"In-app ID resubmit notification error: {exc}")
        db.rollback()

    return {"message": "ID information saved and submitted for review."}


@router.post("/me/correction-request", status_code=200)
def submit_my_correction_request(
    payload: MeCorrectionRequestBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed.")
    if not current_user.profile_complete:
        raise HTTPException(status_code=422, detail="Complete your profile first.")
    if getattr(current_user, "id_fields_unlocked", 0):
        raise HTTPException(
            status_code=422,
            detail="Use Save & Resubmit while your ID fields are unlocked.",
        )
    if current_user.id_document_status == "pending":
        raise HTTPException(
            status_code=422,
            detail="Wait until your current ID submission is reviewed before requesting a correction.",
        )
    existing = (
        db.query(CorrectionRequest)
        .filter(
            CorrectionRequest.admin_id == current_user.id,
            CorrectionRequest.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=422, detail="A correction request is already pending.")

    reason = (payload.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=422, detail="Please describe what needs to be corrected.")

    cr = CorrectionRequest(
        id=str(uuid.uuid4()),
        admin_id=current_user.id,
        reason=reason,
        status="pending",
    )
    db.add(cr)
    db.commit()

    iata = current_user.airport_iata or ""
    airport_label = AIRPORT_DISPLAY.get(iata, iata or "Unknown")
    body = (
        f"{current_user.full_name} assigned to {airport_label} is requesting a correction to their ID information. "
        f"Reason: {reason}."
    )
    try:
        notify_all_super_admins(
            db,
            kind="id_correction_request",
            body=body,
            context={
                "action": "open_admin_review",
                "admin_id": current_user.id,
            },
        )
        db.commit()
    except Exception as exc:
        logger.error(f"In-app correction notification error: {exc}")
        db.rollback()

    return {
        "message": "Your correction request has been submitted. Please wait for the Super Admin to review it.",
    }


@router.get("/admins/{user_id}/review", response_model=AdminReviewDetail)
def get_admin_review_detail(
    user_id: int,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    base = AdminReviewDetail.model_validate(user)
    cr = (
        db.query(CorrectionRequest)
        .filter(
            CorrectionRequest.admin_id == user_id,
            CorrectionRequest.status == "pending",
        )
        .first()
    )
    cr_out = None
    if cr:
        cr_out = CorrectionRequestOut(
            id=cr.id,
            reason=cr.reason,
            status=str(cr.status),
            super_admin_note=cr.super_admin_note,
            created_at=cr.created_at,
        )
    return base.model_copy(
        update={
            "correction_request": cr_out,
            "id_fields_unlocked": int(getattr(user, "id_fields_unlocked", 0) or 0),
        }
    )


@router.post("/admins/{user_id}/correction/unlock", status_code=200)
def unlock_admin_id_correction(
    user_id: int,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    cr = (
        db.query(CorrectionRequest)
        .filter(
            CorrectionRequest.admin_id == user_id,
            CorrectionRequest.status == "pending",
        )
        .first()
    )
    if not cr:
        raise HTTPException(status_code=404, detail="No pending correction request.")
    cr.status = "unlocked"
    user.id_fields_unlocked = 1
    user.id_document_status = "pending"
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    try:
        notify_airport_admin(
            db,
            admin_id=user.id,
            kind="id_unlocked",
            body="Your ID information has been unlocked. Please log in and resubmit your correct details.",
            context={"action": "open_settings"},
        )
        db.commit()
    except Exception as exc:
        logger.error(f"In-app unlock notification error: {exc}")
        db.rollback()
    return {"message": "ID fields unlocked for this admin."}


@router.post("/admins/{user_id}/correction/dismiss", status_code=200)
def dismiss_admin_correction_request(
    user_id: int,
    payload: CorrectionDismissBody,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    cr = (
        db.query(CorrectionRequest)
        .filter(
            CorrectionRequest.admin_id == user_id,
            CorrectionRequest.status == "pending",
        )
        .first()
    )
    if not cr:
        raise HTTPException(status_code=404, detail="No pending correction request.")
    cr.status = "dismissed"
    note = (payload.note or "").strip()
    cr.super_admin_note = note if note else None
    db.commit()
    reason_text = note if note else "No reason provided."
    try:
        notify_airport_admin(
            db,
            admin_id=user_id,
            kind="id_correction_dismissed",
            body=f"Your correction request was dismissed. Reason: {reason_text}",
            context={"action": "open_settings"},
        )
        db.commit()
    except Exception as exc:
        logger.error(f"In-app dismiss notification error: {exc}")
        db.rollback()
    return {"message": "Correction request dismissed."}


@router.post("/admins/{user_id}/id-review", status_code=200)
def review_admin_id_document(
    user_id: int,
    payload: IdReviewRequest,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")

    if payload.action == "approve":
        user.id_document_status = "approved"
        user.id_document_rejection_reason = None
    else:
        reason = (payload.reason or "").strip()
        if not reason:
            raise HTTPException(
                status_code=422, detail="Rejection reason is required.",
            )
        user.id_document_status = "rejected"
        user.id_document_rejection_reason = reason
        personal = (user.personal_email or "").strip()
        if personal:
            first = user.full_name.split()[0] if user.full_name.strip() else "there"
            try:
                send_id_rejection_email(personal, first, reason)
            except Exception as exc:
                logger.error(f"ID rejection email error: {exc}")

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    label = "approved" if payload.action == "approve" else "rejected"
    return {"message": f"ID marked as {label}"}


@router.get("/admins", response_model=list[AdminListItem])
def list_admins(
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """Return all airport admin users."""
    return db.query(User).filter(User.role == "admin").all()


@router.delete("/admins/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_admin(
    user_id: int,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """Soft-deactivate an admin account (sets is_active = 0)."""
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    user.is_active = 0
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    logger.info(f"Admin deactivated: {user.email}")


@router.patch("/admins/{user_id}/activate", response_model=AdminListItem)
def toggle_admin_status(
    user_id: int,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """Toggle active/inactive status of an admin."""
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    user.is_active = 0 if user.is_active else 1
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    logger.info(f"Admin toggled: {user.email} → is_active={user.is_active}")
    return user
