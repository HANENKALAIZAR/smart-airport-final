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

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.models import (
    User,
    AuditLog,
    AIAlert,
    InAppNotification,
    Message,
    MessageReply,
    PasswordResetToken,
)
from app.dependencies import require_super_admin, get_current_user, require_correction_or_approved_admin
from app.services.email_service import (
    send_welcome_email,
    AIRPORT_DISPLAY,
)
from app.services.in_app_notify import notify_all_super_admins, notify_airport_admin
from app.schemas.schemas import (
    ProfileCompleteRequest,
    PatchMySettingsRequest,
    SuperAdminSelfProfilePatch,
    SuperAdminAdminProfilePatch,
    IdDocumentReuploadRequest,
    AdminReviewDetail,
    IdReviewRequest,
)
from app.validators import (
    normalize_tunisian_phone,
    validate_tunisian_phone_digits,
    validate_id_document_data_url,
    validate_profile_photo_data_url,
    validate_emergency_contact_phone,
    normalize_emergency_contact_phone,
    validate_passport_number,
    validate_passport_expiry_future,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["User Management"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Airport slug map ────────────────────────────────────────────────────
AIRPORT_SLUGS = {
    "TUN": "tun",
    "MIR": "mir",
    "DJE": "dje",
    "NBE": "nbe",
}


# ── Helpers ─────────────────────────────────────────────────────────────

def _allocate_employee_id(db: Session, airport_iata: str) -> str:
    """Next [IATA]-#### for admins at this airport (4-digit zero-padded)."""
    prefix = f"{airport_iata.upper()}-"
    rows = (
        db.query(User.employee_id)
        .filter(
            User.role == "admin",
            User.airport_iata == airport_iata.upper(),
            User.employee_id.isnot(None),
        )
        .all()
    )
    best = 0
    for (eid,) in rows:
        if not eid:
            continue
        up = eid.upper()
        if up.startswith(prefix) and "-" in eid:
            try:
                num = int(eid.split("-", 1)[1])
                best = max(best, num)
            except ValueError:
                pass
    return f"{prefix}{best + 1:04d}"


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
    employee_id: Optional[str] = None

    class Config:
        from_attributes = True


class AdminListItem(BaseModel):
    id: int
    full_name: str
    email: str
    personal_email: Optional[str] = None
    airport_iata: Optional[str] = None
    is_active: int
    profile_complete: int = 0
    employee_id: Optional[str] = None
    id_document_status: Optional[str] = None
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    onboarding_active: bool = False
    verification_status: str = "pending_review"
    profile_photo_url: Optional[str] = None
    cin_document_back_url: Optional[str] = None
    profile_edit_unlocked: bool = False

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
        employee_id=_allocate_employee_id(db, airport_iata),
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
    if current_user.role == "super_admin":
        raise HTTPException(status_code=403, detail="Super admin profile cannot be modified")
    if not re.match(r"^\d{8}$", payload.cin_number.strip()):
        raise HTTPException(status_code=422, detail="CIN must be exactly 8 digits")

    pnum = payload.passport_number.strip()
    if not validate_passport_number(pnum):
        raise HTTPException(
            status_code=422,
            detail="Passport number must be letters followed by digits (min. 6 characters).",
        )

    try:
        dob = datetime.strptime(payload.date_of_birth, "%Y-%m-%d").date()
        age = (date.today() - dob).days // 365
        if age < 18:
            raise HTTPException(status_code=422, detail="Must be at least 18 years old")
    except ValueError:
        raise HTTPException(status_code=422, detail="date_of_birth must be YYYY-MM-DD")

    try:
        pexp = datetime.strptime(payload.passport_expiry_date, "%Y-%m-%d").date()
        if not validate_passport_expiry_future(pexp):
            raise HTTPException(
                status_code=422, detail="Passport expiry must be a future date.",
            )
    except ValueError:
        raise HTTPException(status_code=422, detail="passport_expiry_date must be YYYY-MM-DD")

    nat = (payload.nationality or "").strip()
    if not nat:
        raise HTTPException(status_code=422, detail="Nationality is required.")
    addr = (payload.residential_address or "").strip()
    if not addr:
        raise HTTPException(status_code=422, detail="Residential address is required.")
    ec_name = (payload.emergency_contact_name or "").strip()
    if not ec_name:
        raise HTTPException(status_code=422, detail="Emergency contact name is required.")
    if not validate_emergency_contact_phone(payload.emergency_contact_phone):
        raise HTTPException(
            status_code=422,
            detail="Emergency contact phone must be a valid Tunisian (+216…) or international (+…) number.",
        )

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
        validate_id_document_data_url(payload.cin_document_url)
        validate_id_document_data_url(payload.cin_document_back_url)
        validate_id_document_data_url(payload.passport_document_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    current_user.phone_number = phone_norm
    current_user.date_of_birth = dob
    current_user.nationality = nat
    current_user.gender = payload.gender
    current_user.residential_address = addr
    current_user.emergency_contact_name = ec_name
    current_user.emergency_contact_phone = normalize_emergency_contact_phone(
        payload.emergency_contact_phone
    )
    current_user.emergency_contact_relationship = payload.emergency_contact_relationship
    current_user.cin_number = payload.cin_number.strip()
    current_user.cin_document_url = payload.cin_document_url
    current_user.cin_document_back_url = payload.cin_document_back_url
    current_user.passport_number = pnum.upper()
    current_user.passport_document_url = payload.passport_document_url
    current_user.passport_expiry_date = pexp
    current_user.profile_photo_url = payload.profile_photo_url
    current_user.profile_complete = 1
    current_user.id_document_status = "pending"
    current_user.id_document_rejection_reason = None
    current_user.rejected_fields = None
    current_user.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="CIN number already registered. Each admin must have a unique CIN.",
        )

    iata = current_user.airport_iata or ""
    airport_label = AIRPORT_DISPLAY.get(iata, iata or "Unknown")
    notify_body = (
        f"{current_user.full_name} assigned to {airport_label} has submitted their profile for approval."
    )
    # In-app notification to all super admins
    try:
        notify_all_super_admins(
            db,
            kind="profile_submitted_review",
            body=notify_body,
            context={
                "action": "open_admin_review",
                "admin_id": current_user.id,
            },
        )
        db.commit()
    except Exception as exc:
        logger.error(f"In-app profile review notification error: {exc}")
        db.rollback()

    logger.info(f"Profile completed: {current_user.email}")
    return {"message": "Profile submitted successfully. Waiting for super admin approval."}


@router.patch("/me/settings", status_code=200)
def patch_my_settings(
    payload: PatchMySettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_correction_or_approved_admin),
):
    """
    Update editable profile fields for airport admins.
    Always allowed: phone_number, profile_photo_url, residential_address, emergency contact.
    All other profile fields are read-only (managed by super admin).
    """
    if current_user.role == "super_admin":
        data = payload.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(status_code=422, detail="Nothing to update.")
        
        allowed_keys = {"full_name", "phone_number", "profile_photo_url"}
        for key in data.keys():
            if key not in allowed_keys:
                raise HTTPException(
                    status_code=403,
                    detail=f"Field '{key}' is read-only for Super Admin.",
                )
        
        if "full_name" in data:
            val = (data["full_name"] or "").strip()
            if not val:
                raise HTTPException(status_code=422, detail="Full name cannot be empty")
            current_user.full_name = val
            
        if "phone_number" in data:
            raw = data["phone_number"]
            if raw:
                phone_norm = normalize_tunisian_phone(raw)
                if not validate_tunisian_phone_digits(phone_norm):
                    raise HTTPException(
                        status_code=422,
                        detail="Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)",
                    )
                current_user.phone_number = phone_norm
            else:
                current_user.phone_number = None

        if "profile_photo_url" in data:
            if data["profile_photo_url"]:
                try:
                    validate_profile_photo_data_url(data["profile_photo_url"])
                except ValueError as exc:
                    raise HTTPException(status_code=422, detail=str(exc))
                current_user.profile_photo_url = data["profile_photo_url"]
            else:
                current_user.profile_photo_url = None
            
        current_user.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"message": "Settings updated"}

    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only airport admins can update these fields here.")
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="Nothing to update.")

    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Your account is deactivated. Please contact support.")

    IDENTITY_FIELDS = {"full_name", "cin_number", "date_of_birth", "nationality", "gender"}
    PASSPORT_FIELDS = {"passport_number", "passport_document_url", "passport_expiry_date"}
    CIN_DOC_FIELDS = {"cin_document_url", "cin_document_back_url"}
    CONTACT_FIELDS = {"phone_number", "residential_address", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"}

    if current_user.id_document_status == "rejected":
        # Targeted correction mode
        allowed_keys = set(current_user.rejected_fields or [])
        allowed_keys.add("profile_photo_url")
        if not allowed_keys:
            raise HTTPException(status_code=403, detail="No editable fields during rejection.")
    else:
        # Standard settings mode: dynamically build allowed keys based on section unlock flags
        allowed_keys = {"profile_photo_url"}
        
        if getattr(current_user, 'profile_unlock_identity', False) or getattr(current_user, 'profile_edit_unlocked', False):
            allowed_keys.update(IDENTITY_FIELDS)
        if getattr(current_user, 'profile_unlock_passport', False) or getattr(current_user, 'profile_edit_unlocked', False):
            allowed_keys.update(PASSPORT_FIELDS)
        if getattr(current_user, 'profile_unlock_cin_doc', False) or getattr(current_user, 'profile_edit_unlocked', False):
            allowed_keys.update(CIN_DOC_FIELDS)
        if getattr(current_user, 'profile_unlock_contact', False) or getattr(current_user, 'profile_edit_unlocked', False):
            allowed_keys.update(CONTACT_FIELDS)

    for key in data.keys():
        if key not in allowed_keys:
            raise HTTPException(
                status_code=403,
                detail=f"Field '{key}' is read-only. Contact your super admin to change it.",
            )

    # Need tracking for standard vs ID fields to resubmit
    is_resubmit = current_user.id_document_status == "rejected"
    # Special validations for ID fields if they were allowed
    if "passport_number" in data:
        pnum = (data["passport_number"] or "").strip()
        if pnum and not validate_passport_number(pnum):
             raise HTTPException(status_code=422, detail="Passport number invalid.")
        current_user.passport_number = pnum.upper()
    if "passport_expiry_date" in data:
        try:
             current_user.passport_expiry_date = datetime.strptime(data["passport_expiry_date"], "%Y-%m-%d").date()
        except ValueError:
             raise HTTPException(status_code=422, detail="Invalid passport expiry date.")
    if "passport_document_url" in data:
         current_user.passport_document_url = data["passport_document_url"]
    
    if "cin_number" in data:
        num = (data["cin_number"] or "").strip()
        if num and not re.match(r"^\d{8}$", num):
             raise HTTPException(status_code=422, detail="CIN must be exactly 8 digits.")
        current_user.cin_number = num
    if "cin_document_url" in data:
         current_user.cin_document_url = data["cin_document_url"]
    if "cin_document_back_url" in data:
         current_user.cin_document_back_url = data["cin_document_back_url"]
    
    if "date_of_birth" in data:
        try:
             current_user.date_of_birth = datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()
        except ValueError:
             pass
    if "nationality" in data:
         current_user.nationality = data["nationality"]
    if "gender" in data:
         current_user.gender = data["gender"]
    if "full_name" in data:
         current_user.full_name = data["full_name"]

    if "phone_number" in data:
        phone_norm = normalize_tunisian_phone(data["phone_number"])
        if not validate_tunisian_phone_digits(phone_norm):
            raise HTTPException(
                status_code=422,
                detail="Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)",
            )
        current_user.phone_number = phone_norm

    if "profile_photo_url" in data:
        try:
            validate_profile_photo_data_url(data["profile_photo_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        current_user.profile_photo_url = data["profile_photo_url"]

    if "residential_address" in data:
        current_user.residential_address = (data["residential_address"] or "").strip() or None

    if "emergency_contact_name" in data:
        current_user.emergency_contact_name = (data["emergency_contact_name"] or "").strip() or None

    if "emergency_contact_phone" in data:
        raw = data["emergency_contact_phone"]
        if raw is not None and str(raw).strip():
            if not validate_emergency_contact_phone(raw):
                raise HTTPException(
                    status_code=422,
                    detail="Emergency contact phone must be a valid Tunisian (+216…) or international (+…) number.",
                )
            current_user.emergency_contact_phone = normalize_emergency_contact_phone(raw)
        else:
            current_user.emergency_contact_phone = None

    if "emergency_contact_relationship" in data:
        current_user.emergency_contact_relationship = data["emergency_contact_relationship"]

    if is_resubmit:
        # Remove ONLY the fields that were just corrected from the rejected list.
        # Do NOT wipe all rejected_fields at once — admin may fix them in multiple saves.
        remaining_rejected = list(current_user.rejected_fields or [])
        for key in data.keys():
            if key in remaining_rejected:
                remaining_rejected.remove(key)

        if remaining_rejected:
            # Some fields still need correction — keep status as rejected, update remaining list
            current_user.rejected_fields = remaining_rejected
            fields_str = ", ".join(remaining_rejected)
            current_user.id_document_rejection_reason = (
                f"The following fields still need correction: {fields_str}"
            )
            logger.info(
                f"Admin {current_user.email} corrected some fields; "
                f"still pending: {remaining_rejected}"
            )
        else:
            # All rejected fields have been corrected — resubmit for super admin review
            current_user.id_document_status = "pending"
            current_user.rejected_fields = None
            current_user.id_document_rejection_reason = None
            iata = current_user.airport_iata or ""
            body = (
                f"{current_user.full_name} ({iata}) has corrected all rejected fields "
                f"and resubmitted their profile for review."
            )
            try:
                notify_all_super_admins(
                    db,
                    kind="profile_resubmitted_review",
                    body=body,
                    context={"action": "open_admin_review", "admin_id": current_user.id},
                )
            except Exception:
                pass
            logger.info(f"Admin profile fully resubmitted: {current_user.email}")

    # Auto-relock: only the section that was saved resets its unlock state, others retain it.
    if not is_resubmit:
        if any(k in IDENTITY_FIELDS for k in data.keys()):
            current_user.profile_unlock_identity = False
        if any(k in PASSPORT_FIELDS for k in data.keys()):
            current_user.profile_unlock_passport = False
        if any(k in CIN_DOC_FIELDS for k in data.keys()):
            current_user.profile_unlock_cin_doc = False
        if any(k in CONTACT_FIELDS for k in data.keys()):
            current_user.profile_unlock_contact = False
        
        # Always lock the legacy override flag on any save, letting the individual flags handle remaining sections
        current_user.profile_edit_unlocked = False

    current_user.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="CIN number already registered. Each admin must have a unique CIN.",
        )

    if is_resubmit:
        remaining = current_user.rejected_fields or []
        if remaining:
            return {"message": f"Field(s) saved. {len(remaining)} field(s) still require correction."}
        return {"message": "All corrections submitted. Your profile is pending super admin review."}
    return {"message": "Settings updated"}








@router.get("/admins/{user_id}/review", response_model=AdminReviewDetail)
def get_admin_review_detail(
    user_id: int,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    return AdminReviewDetail.model_validate(user)



@router.post("/admins/{user_id}/id-review", status_code=200)
def review_admin_profile(
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
        user.rejected_fields = None
        user.updated_at = datetime.now(timezone.utc)
        db.commit()

        # In-app notification to the admin
        try:
            notify_airport_admin(
                db,
                admin_id=user.id,
                kind="profile_approved",
                body="Your profile has been approved! You can now access the dashboard.",
                context={"action": "go_dashboard"},
            )
            db.commit()
        except Exception as exc:
            logger.error(f"In-app approval notification error: {exc}")
            db.rollback()

        logger.info(f"Admin profile approved: {user.email}")
        return {"message": "Admin profile approved. They now have dashboard access."}

    else:
        # Rejection Flow
        rejected_fields = payload.rejected_fields or []
        if not rejected_fields:
            raise HTTPException(
                status_code=422, detail="You must select at least one incorrect field to reject the profile."
            )
            
        custom_reason = (payload.reason or "").strip()
        
        # Build dynamic reason message
        fields_str = ", ".join(rejected_fields)
        reason_msg = f"The following fields were rejected: {fields_str}"
        if custom_reason:
            reason_msg += f". Additional notes: {custom_reason}"

        user.id_document_status = "rejected"
        user.id_document_rejection_reason = reason_msg
        user.rejected_fields = rejected_fields
        user.correction_attempts = (user.correction_attempts or 0) + 1
        
        if user.correction_attempts >= 5:
            user.is_active = 0
            reason_msg += ". Maximum correction attempts (5) reached. Account deactivated."
            user.id_document_rejection_reason = reason_msg
            logger.warning(f"Admin {user.email} reached max correction attempts and was deactivated.")

        user.updated_at = datetime.now(timezone.utc)
        db.commit()

        # In-app notification to the admin
        try:
            notify_airport_admin(
                db,
                admin_id=user.id,
                kind="profile_rejected",
                body=f"Your profile was rejected. {reason_msg}. Please update the required information.",
                context={"action": "open_settings"},
            )
            db.commit()
        except Exception as exc:
            logger.error(f"In-app rejection notification error: {exc}")
            db.rollback()

        logger.info(f"Admin profile rejected (fields: {rejected_fields}): {user.email}")
        return {"message": "Admin profile rejected successfully."}


def _admin_verification_status(u: User) -> str:
    st = getattr(u, "id_document_status", None)
    if st in ("expired_verification", "rejected", "approved", "archived", "permanently_rejected"):
        return st
    return "pending_review"


def _admin_onboarding_active(u: User) -> bool:
    if int(getattr(u, "is_active", 0) or 0) != 1:
        return False
    if int(getattr(u, "must_change_password", 0) or 0) != 0:
        return False
    if int(getattr(u, "profile_complete", 0) or 0) != 1:
        return False
    if getattr(u, "id_document_status", None) != "approved":
        return False
    return True


@router.get("/admins", response_model=list[AdminListItem])
def list_admins(
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
    status_filter: Optional[str] = Query(None, alias="status"),
    verification: Optional[str] = Query(None, alias="verification"),
):
    """Return airport admins with onboarding and verification metadata."""
    admins = (
        db.query(User)
        .filter(User.role == "admin")
        .order_by(User.id.asc())
        .all()
    )
    rows: list[AdminListItem] = []
    for u in admins:
        vs = _admin_verification_status(u)
        oa = _admin_onboarding_active(u)
        if status_filter == "active" and not oa:
            continue
        if status_filter == "inactive" and oa:
            continue
        if verification and verification != "all":
            if verification == "approved" and vs != "approved":
                continue
            if verification == "pending_review" and vs != "pending_review":
                continue
            if verification == "under_review" and vs != "under_review":
                continue
            if verification == "rejected" and vs != "rejected":
                continue
        rows.append(
            AdminListItem(
                id=u.id,
                full_name=u.full_name,
                email=u.email,
                personal_email=u.personal_email,
                airport_iata=u.airport_iata,
                is_active=u.is_active,
                profile_complete=int(u.profile_complete or 0),
                employee_id=u.employee_id,
                id_document_status=getattr(u, "id_document_status", None),
                created_at=u.created_at,
                last_login=u.last_login,
                onboarding_active=oa,
                verification_status=vs,
                profile_photo_url=u.profile_photo_url,
                cin_document_back_url=u.cin_document_back_url,
                profile_edit_unlocked=bool(getattr(u, "profile_edit_unlocked", False)),
            )
        )
    return rows


@router.delete("/admins/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_super_admin: User = Depends(require_super_admin),
):
    """Permanently delete an airport admin and their dependent records."""
    if current_super_admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin cannot delete their own account.",
        )

    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")

    try:
        message_ids = [
            message_id
            for (message_id,) in db.query(Message.id).filter(
                or_(Message.from_user_id == user.id, Message.to_user_id == user.id)
            ).all()
        ]
        if message_ids:
            db.query(MessageReply).filter(
                MessageReply.message_id.in_(message_ids)
            ).delete(synchronize_session=False)
            db.query(Message).filter(Message.id.in_(message_ids)).delete(
                synchronize_session=False
            )

        db.query(MessageReply).filter(MessageReply.author_id == user.id).delete(
            synchronize_session=False
        )
        db.query(InAppNotification).filter(
            InAppNotification.recipient_user_id == user.id
        ).delete(synchronize_session=False)
        db.query(PasswordResetToken).filter(
            PasswordResetToken.admin_id == user.id
        ).delete(synchronize_session=False)
        db.query(AIAlert).filter(AIAlert.acted_by_admin_id == user.id).update(
            {AIAlert.acted_by_admin_id: None},
            synchronize_session=False,
        )

        deleted_email = user.email
        db.delete(user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.exception("Failed to delete admin %s due to database constraints", user_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Admin could not be deleted because related records still reference this account.",
        ) from exc

    logger.info(
        "Admin deleted by super admin %s: %s",
        current_super_admin.email,
        deleted_email,
    )


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


class ToggleEditRequest(BaseModel):
    unlock: bool
    section: Optional[str] = None


@router.patch("/admins/{user_id}/toggle-edit", status_code=200)
def toggle_profile_edit(
    user_id: int,
    payload: ToggleEditRequest,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """Super Admin: grant or revoke temporary permission to edit locked profile fields."""
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    
    section = payload.section
    if section:
        section = section.lower()
        if section == "identity":
            user.profile_unlock_identity = payload.unlock
        elif section == "passport":
            user.profile_unlock_passport = payload.unlock
        elif section == "cin_doc":
            user.profile_unlock_cin_doc = payload.unlock
        elif section == "contact":
            user.profile_unlock_contact = payload.unlock
        else:
            raise HTTPException(status_code=422, detail=f"Invalid section '{section}'")
    else:
        user.profile_edit_unlocked = payload.unlock
        user.profile_unlock_identity = payload.unlock
        user.profile_unlock_passport = payload.unlock
        user.profile_unlock_cin_doc = payload.unlock
        user.profile_unlock_contact = payload.unlock

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    status_label = "granted" if payload.unlock else "revoked"
    section_label = f"for section '{section}'" if section else "for all sections"
    logger.info(f"Super admin {status_label} profile edit unlock {section_label} for admin {user.email}")
    if payload.unlock:
        try:
            notify_airport_admin(
                db,
                admin_id=user.id,
                kind="profile_edit_unlocked",
                body=f"The Super Admin has authorized you to edit your {section or 'profile'} fields. This access will be revoked automatically after your next save.",
                context={"action": "open_settings"},
            )
            db.commit()
        except Exception:
            pass
    return {
        "profile_edit_unlocked": user.profile_edit_unlocked,
        "profile_unlock_identity": user.profile_unlock_identity,
        "profile_unlock_passport": user.profile_unlock_passport,
        "profile_unlock_cin_doc": user.profile_unlock_cin_doc,
        "profile_unlock_contact": user.profile_unlock_contact,
        "message": f"Profile edit unlock {status_label} {section_label}.",
    }


# ── Expired Verification Actions (super_admin only) ───────────────────────────

@router.post("/admins/{user_id}/reopen-verification", status_code=200)
def reopen_expired_verification(
    user_id: int,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """
    Super Admin: Reopen an expired verification so the admin can correct and resubmit.
    Sets id_document_status back to 'rejected', preserving audit history.
    """
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if getattr(user, "id_document_status", None) != "expired_verification":
        raise HTTPException(
            status_code=409,
            detail="Admin verification is not in 'expired_verification' state.",
        )

    user.id_document_status = "rejected"
    user.id_document_rejection_reason = (
        "Your verification has been reopened by the Super Admin. "
        "Please correct the required fields and resubmit."
    )
    user.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Notify the admin
    try:
        notify_airport_admin(
            db,
            admin_id=user.id,
            kind="verification_reopened",
            body=(
                "The Super Admin has reopened your verification request. "
                "Please correct and resubmit your profile."
            ),
            context={"action": "open_settings"},
        )
        db.commit()
    except Exception as exc:
        logger.error(f"Failed to notify admin of reopened verification: {exc}")
        db.rollback()

    logger.info(
        f"Super admin {_super.email} reopened expired verification for admin {user.email}"
    )
    return {"message": "Verification reopened. Admin can now correct and resubmit."}


@router.post("/admins/{user_id}/archive", status_code=200)
def archive_expired_admin(
    user_id: int,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """
    Super Admin: Archive an admin whose verification expired.
    Sets id_document_status = 'archived'. Account stays in DB for audit purposes.
    is_active is set to 0 only here — under explicit Super Admin control.
    """
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if getattr(user, "id_document_status", None) != "expired_verification":
        raise HTTPException(
            status_code=409,
            detail="Admin verification is not in 'expired_verification' state.",
        )

    user.id_document_status = "archived"
    user.is_active = 0
    user.id_document_rejection_reason = "Account archived by Super Admin after verification expired."
    user.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Notify the admin
    try:
        notify_airport_admin(
            db,
            admin_id=user.id,
            kind="account_archived",
            body=(
                "Your account has been archived by the Super Admin. "
                "Please contact the system administrator for further assistance."
            ),
        )
        db.commit()
    except Exception as exc:
        logger.error(f"Failed to notify admin of archival: {exc}")
        db.rollback()

    logger.info(
        f"Super admin {_super.email} archived admin {user.email} after verification expiry"
    )
    return {"message": "Admin account archived successfully."}


@router.post("/admins/{user_id}/permanently-reject", status_code=200)
def permanently_reject_admin(
    user_id: int,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """
    Super Admin: Permanently reject an admin whose verification expired.
    Sets id_document_status = 'permanently_rejected'. Account stays for audit.
    is_active is set to 0 only here — under explicit Super Admin control.
    """
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if getattr(user, "id_document_status", None) != "expired_verification":
        raise HTTPException(
            status_code=409,
            detail="Admin verification is not in 'expired_verification' state.",
        )

    user.id_document_status = "permanently_rejected"
    user.is_active = 0
    user.id_document_rejection_reason = (
        "Your account has been permanently rejected by the Super Admin. "
        "No further verification attempts are permitted."
    )
    user.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Notify the admin
    try:
        notify_airport_admin(
            db,
            admin_id=user.id,
            kind="account_permanently_rejected",
            body=(
                "Your account has been permanently rejected by the Super Admin. "
                "No further verification attempts are permitted."
            ),
        )
        db.commit()
    except Exception as exc:
        logger.error(f"Failed to notify admin of permanent rejection: {exc}")
        db.rollback()

    logger.info(
        f"Super admin {_super.email} permanently rejected admin {user.email} after verification expiry"
    )
    return {"message": "Admin account permanently rejected."}
