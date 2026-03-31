"""
Smart Airport Operations – Admin User Management Router
=========================================================
Super-admin-only endpoints for creating and managing airport admins.
All endpoints require a valid super_admin JWT token.
"""

import json
import re
import uuid
import secrets
import string
import logging
from datetime import datetime, timezone, date

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    CORRECTION_FIELD_KEYS,
    ProfileCompleteRequest,
    PatchMySettingsRequest,
    SuperAdminSelfProfilePatch,
    SuperAdminAdminProfilePatch,
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
    validate_emergency_contact_phone,
    normalize_emergency_contact_phone,
    validate_passport_number,
    validate_passport_expiry_future,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["User Management"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_LEGACY_FULL_CORRECTION_FIELDS = list(CORRECTION_FIELD_KEYS)


def _parse_json_list(raw) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw]
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
            return [str(x) for x in (data or []) if x]
        except Exception:
            return []
    return []


def _unlock_set(user: User) -> set[str]:
    return set(_parse_json_list(getattr(user, "correction_unlock_fields", None)))


def _fulfill_unlocked_cr(db: Session, user: User) -> None:
    cr = (
        db.query(CorrectionRequest)
        .filter(
            CorrectionRequest.admin_id == user.id,
            CorrectionRequest.status == "unlocked",
        )
        .order_by(CorrectionRequest.created_at.desc())
        .first()
    )
    if cr:
        cr.status = "fulfilled"


def _remove_unlock_keys(db: Session, user: User, keys_to_remove: list[str]) -> None:
    ul = _parse_json_list(user.correction_unlock_fields)
    if not ul:
        return
    s = set(ul)
    for k in keys_to_remove:
        s.discard(k)
    user.correction_unlock_fields = list(s) if s else None
    user.id_fields_unlocked = 1 if ({"cin", "passport"} & s) else 0
    if not s:
        user.id_fields_unlocked = 0
        _fulfill_unlocked_cr(db, user)


def _unlock_keys_for_patch_field(name: str) -> list[str]:
    m = {
        "full_name": ["full_name"],
        "date_of_birth": ["date_of_birth"],
        "gender": ["gender"],
        "nationality": ["nationality"],
        "residential_address": ["residential_address"],
        "emergency_contact_name": ["emergency_contact"],
        "emergency_contact_phone": ["emergency_contact"],
        "emergency_contact_relationship": ["emergency_contact"],
        "cin_number": ["cin"],
        "cin_document_url": ["cin"],
        "passport_number": ["passport"],
        "passport_document_url": ["passport"],
        "passport_expiry_date": ["passport"],
    }
    return m.get(name, [])


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
    current_user.passport_number = pnum.upper()
    current_user.passport_document_url = payload.passport_document_url
    current_user.passport_expiry_date = pexp
    current_user.profile_photo_url = payload.profile_photo_url
    current_user.profile_complete = 1
    current_user.id_document_status = "pending"
    current_user.id_document_rejection_reason = None
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()

    iata = current_user.airport_iata or ""
    airport_label = AIRPORT_DISPLAY.get(iata, iata or "Unknown")
    body = (
        f"{current_user.full_name} assigned to {airport_label} has submitted identity documents for review."
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
    """Update phone, photo, and profile fields allowed by correction unlock (airport admins)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only airport admins can update these fields here.")
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="Nothing to update.")

    unlock = _unlock_set(current_user)
    profile_done = int(getattr(current_user, "profile_complete", 0) or 0) == 1
    always_ok = {"phone_number", "profile_photo_url"}

    for key in data.keys():
        if key in always_ok:
            continue
        if not profile_done:
            raise HTTPException(
                status_code=403,
                detail="Complete your profile before editing these fields.",
            )
        if not unlock:
            raise HTTPException(
                status_code=403,
                detail="This field is locked. Request a correction to edit identity information.",
            )
        needed = _unlock_keys_for_patch_field(key)
        if not needed or not any(n in unlock for n in needed):
            raise HTTPException(
                status_code=403,
                detail="This field is not unlocked for correction.",
            )

    if "phone_number" in data:
        phone_norm = normalize_tunisian_phone(data["phone_number"])
        if not validate_tunisian_phone_digits(phone_norm):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)"
                ),
            )
        current_user.phone_number = phone_norm

    if "profile_photo_url" in data:
        try:
            validate_profile_photo_data_url(data["profile_photo_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        current_user.profile_photo_url = data["profile_photo_url"]

    if "full_name" in data:
        fn = (data["full_name"] or "").strip()
        if not fn:
            raise HTTPException(status_code=422, detail="Full name cannot be empty.")
        current_user.full_name = fn

    if "date_of_birth" in data:
        dob_raw = data["date_of_birth"]
        if dob_raw:
            try:
                dob = datetime.strptime(dob_raw, "%Y-%m-%d").date()
                age = (date.today() - dob).days // 365
                if age < 18:
                    raise HTTPException(status_code=422, detail="Must be at least 18 years old")
            except ValueError:
                raise HTTPException(status_code=422, detail="date_of_birth must be YYYY-MM-DD")
            current_user.date_of_birth = dob
        else:
            current_user.date_of_birth = None

    if "gender" in data:
        g = data["gender"]
        if g is not None and g not in ("Male", "Female"):
            raise HTTPException(status_code=422, detail="gender must be Male or Female.")
        current_user.gender = g

    if "nationality" in data:
        current_user.nationality = (data["nationality"] or "").strip() or None

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
                    detail=(
                        "Emergency contact phone must match Tunisian (+216…) or international (+ and 7–15 digits)."
                    ),
                )
            current_user.emergency_contact_phone = normalize_emergency_contact_phone(raw)
        else:
            current_user.emergency_contact_phone = None

    if "emergency_contact_relationship" in data:
        current_user.emergency_contact_relationship = data["emergency_contact_relationship"]

    if "cin_number" in data:
        num = (data["cin_number"] or "").strip()
        if num and not re.match(r"^\d{8}$", num):
            raise HTTPException(status_code=422, detail="CIN must be exactly 8 digits")
        current_user.cin_number = num or None

    if "cin_document_url" in data:
        try:
            validate_id_document_data_url(data["cin_document_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        current_user.cin_document_url = data["cin_document_url"]
        current_user.id_document_status = "pending"
        current_user.id_document_rejection_reason = None

    if "passport_number" in data:
        pnum = (data["passport_number"] or "").strip()
        if pnum and not validate_passport_number(pnum):
            raise HTTPException(
                status_code=422,
                detail="Passport number must be letters followed by digits (min. 6 characters).",
            )
        current_user.passport_number = pnum.upper() if pnum else None

    if "passport_expiry_date" in data:
        raw = data["passport_expiry_date"]
        if raw:
            try:
                pexp = datetime.strptime(raw, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=422, detail="passport_expiry_date must be YYYY-MM-DD")
            if not validate_passport_expiry_future(pexp):
                raise HTTPException(
                    status_code=422, detail="Passport expiry must be a future date.",
                )
            current_user.passport_expiry_date = pexp
        else:
            current_user.passport_expiry_date = None

    if "passport_document_url" in data:
        try:
            validate_id_document_data_url(data["passport_document_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        current_user.passport_document_url = data["passport_document_url"]
        current_user.id_document_status = "pending"
        current_user.id_document_rejection_reason = None

    to_remove: list[str] = []
    if "full_name" in data and "full_name" in unlock:
        to_remove.append("full_name")
    if "date_of_birth" in data and "date_of_birth" in unlock:
        to_remove.append("date_of_birth")
    if "gender" in data and "gender" in unlock:
        to_remove.append("gender")
    if "nationality" in data and "nationality" in unlock:
        to_remove.append("nationality")
    if "residential_address" in data and "residential_address" in unlock:
        to_remove.append("residential_address")
    if "emergency_contact" in unlock and any(
        k in data
        for k in (
            "emergency_contact_name",
            "emergency_contact_phone",
            "emergency_contact_relationship",
        )
    ):
        to_remove.append("emergency_contact")
    if "cin" in unlock and "cin_document_url" in data:
        to_remove.append("cin")
    if "passport" in unlock and "passport_document_url" in data:
        to_remove.append("passport")

    current_user.updated_at = datetime.now(timezone.utc)
    if to_remove:
        _remove_unlock_keys(db, current_user, list(dict.fromkeys(to_remove)))
    db.commit()

    return {"message": "Settings updated"}


@router.patch("/me/super-admin-profile", status_code=200)
def patch_super_admin_self_profile(
    payload: SuperAdminSelfProfilePatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Super admin: full edit of own profile (no ID review workflow)."""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super administrators can use this endpoint.",
        )
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="Nothing to update.")

    if "full_name" in data:
        fn = (data["full_name"] or "").strip()
        if not fn:
            raise HTTPException(status_code=422, detail="Full name cannot be empty.")
        current_user.full_name = fn

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

    if "date_of_birth" in data:
        dob_raw = data["date_of_birth"]
        if dob_raw:
            try:
                dob = datetime.strptime(dob_raw, "%Y-%m-%d").date()
                age = (date.today() - dob).days // 365
                if age < 18:
                    raise HTTPException(status_code=422, detail="Must be at least 18 years old")
            except ValueError:
                raise HTTPException(status_code=422, detail="date_of_birth must be YYYY-MM-DD")
            current_user.date_of_birth = dob
        else:
            current_user.date_of_birth = None

    if "cin_number" in data:
        num = (data["cin_number"] or "").strip()
        if num and not re.match(r"^\d{8}$", num):
            raise HTTPException(status_code=422, detail="CIN must be exactly 8 digits")
        current_user.cin_number = num or None

    if "passport_number" in data:
        pnum = (data["passport_number"] or "").strip()
        if pnum and not validate_passport_number(pnum):
            raise HTTPException(
                status_code=422,
                detail="Passport number must be letters followed by digits (min. 6 characters).",
            )
        current_user.passport_number = pnum.upper() if pnum else None

    if "passport_expiry_date" in data:
        raw = data["passport_expiry_date"]
        if raw:
            try:
                pexp = datetime.strptime(raw, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=422, detail="passport_expiry_date must be YYYY-MM-DD")
            current_user.passport_expiry_date = pexp
        else:
            current_user.passport_expiry_date = None

    if "cin_document_url" in data:
        try:
            validate_id_document_data_url(data["cin_document_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        current_user.cin_document_url = data["cin_document_url"]
        current_user.id_document_status = "approved"
        current_user.id_document_rejection_reason = None

    if "passport_document_url" in data:
        try:
            validate_id_document_data_url(data["passport_document_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        current_user.passport_document_url = data["passport_document_url"]
        current_user.id_document_status = "approved"
        current_user.id_document_rejection_reason = None

    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Profile updated"}


@router.post("/me/id-document", status_code=200)
def reupload_id_document(
    payload: IdDocumentReuploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-submit CIN and/or passport document after super admin rejection."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed.")
    if current_user.id_document_status != "rejected":
        raise HTTPException(
            status_code=422,
            detail="Re-upload is only available after your ID was rejected.",
        )

    cin_u = payload.cin_document_url
    pass_u = payload.passport_document_url
    if not cin_u and not pass_u:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one of cin_document_url or passport_document_url.",
        )

    if cin_u:
        try:
            validate_id_document_data_url(cin_u)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        current_user.cin_document_url = cin_u
    if pass_u:
        try:
            validate_id_document_data_url(pass_u)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        current_user.passport_document_url = pass_u

    current_user.id_document_status = "pending"
    current_user.id_document_rejection_reason = None
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()

    iata = current_user.airport_iata or ""
    airport_label = AIRPORT_DISPLAY.get(iata, iata or "Unknown")
    body = (
        f"{current_user.full_name} assigned to {airport_label} has submitted identity documents for review."
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
    """After super admin unlocks CIN and/or passport, admin saves corrected ID data."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed.")
    unlock = _unlock_set(current_user)
    legacy = int(getattr(current_user, "id_fields_unlocked", 0) or 0)
    need_cin = "cin" in unlock or (legacy and not unlock)
    need_pass = "passport" in unlock or (legacy and not unlock)
    if not need_cin and not need_pass:
        raise HTTPException(
            status_code=422,
            detail="ID fields are not unlocked for correction.",
        )

    pexp = None
    if need_cin:
        if not payload.cin_number or not str(payload.cin_number).strip():
            raise HTTPException(status_code=422, detail="CIN number is required.")
        if not re.match(r"^\d{8}$", str(payload.cin_number).strip()):
            raise HTTPException(status_code=422, detail="CIN must be exactly 8 digits")
        if not payload.cin_document_url:
            raise HTTPException(status_code=422, detail="CIN document is required.")
        try:
            validate_id_document_data_url(payload.cin_document_url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    if need_pass:
        pnum = (payload.passport_number or "").strip()
        if not validate_passport_number(pnum):
            raise HTTPException(
                status_code=422,
                detail="Passport number must be letters followed by digits (min. 6 characters).",
            )
        if not payload.passport_expiry_date:
            raise HTTPException(status_code=422, detail="Passport expiry is required.")
        try:
            pexp = datetime.strptime(payload.passport_expiry_date, "%Y-%m-%d").date()
            if not validate_passport_expiry_future(pexp):
                raise HTTPException(
                    status_code=422, detail="Passport expiry must be a future date.",
                )
        except ValueError:
            raise HTTPException(status_code=422, detail="passport_expiry_date must be YYYY-MM-DD")
        if not payload.passport_document_url:
            raise HTTPException(status_code=422, detail="Passport document is required.")
        try:
            validate_id_document_data_url(payload.passport_document_url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    if need_cin:
        current_user.cin_number = str(payload.cin_number).strip()
        current_user.cin_document_url = payload.cin_document_url
    if need_pass:
        pnum = (payload.passport_number or "").strip()
        current_user.passport_number = pnum.upper()
        current_user.passport_document_url = payload.passport_document_url
        current_user.passport_expiry_date = pexp

    current_user.id_fields_unlocked = 0
    current_user.id_document_status = "pending"
    current_user.id_document_rejection_reason = None
    current_user.updated_at = datetime.now(timezone.utc)

    to_remove: list[str] = []
    if need_cin and ("cin" in unlock or (legacy and not unlock)):
        to_remove.append("cin")
    if need_pass and ("passport" in unlock or (legacy and not unlock)):
        to_remove.append("passport")
    if to_remove:
        _remove_unlock_keys(db, current_user, to_remove)
    db.commit()

    iata = current_user.airport_iata or ""
    airport_label = AIRPORT_DISPLAY.get(iata, iata or "Unknown")
    body = (
        f"{current_user.full_name} assigned to {airport_label} has submitted identity documents for review."
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
    if _unlock_set(current_user):
        raise HTTPException(
            status_code=422,
            detail="Finish saving your unlocked correction fields before requesting another change.",
        )
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
        requested_fields=list(payload.fields),
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


@router.patch("/admins/{user_id}/profile", status_code=200)
def patch_admin_profile_by_super(
    user_id: int,
    payload: SuperAdminAdminProfilePatch,
    db: Session = Depends(get_db),
    _super: User = Depends(require_super_admin),
):
    """Super admin: edit any field on an airport admin (including read-only fields for the admin)."""
    user = db.query(User).filter(User.id == user_id, User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin not found.")
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="Nothing to update.")

    if "full_name" in data:
        fn = (data["full_name"] or "").strip()
        if not fn:
            raise HTTPException(status_code=422, detail="Full name cannot be empty.")
        user.full_name = fn

    if "personal_email" in data:
        pe = (data["personal_email"] or "").strip()
        if pe and "@" not in pe:
            raise HTTPException(status_code=422, detail="Invalid personal email.")
        user.personal_email = pe or None

    if "phone_number" in data:
        phone_norm = normalize_tunisian_phone(data["phone_number"])
        if not validate_tunisian_phone_digits(phone_norm):
            raise HTTPException(
                status_code=422,
                detail="Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)",
            )
        user.phone_number = phone_norm

    if "profile_photo_url" in data:
        try:
            validate_profile_photo_data_url(data["profile_photo_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        user.profile_photo_url = data["profile_photo_url"]

    if "date_of_birth" in data:
        dob_raw = data["date_of_birth"]
        if dob_raw:
            try:
                dob = datetime.strptime(dob_raw, "%Y-%m-%d").date()
                age = (date.today() - dob).days // 365
                if age < 18:
                    raise HTTPException(status_code=422, detail="Must be at least 18 years old")
            except ValueError:
                raise HTTPException(status_code=422, detail="date_of_birth must be YYYY-MM-DD")
            user.date_of_birth = dob
        else:
            user.date_of_birth = None

    if "nationality" in data:
        user.nationality = (data["nationality"] or "").strip() or None

    if "gender" in data:
        g = data["gender"]
        if g is not None and g not in ("Male", "Female"):
            raise HTTPException(status_code=422, detail="gender must be Male or Female.")
        user.gender = g

    if "residential_address" in data:
        user.residential_address = (data["residential_address"] or "").strip() or None

    if "emergency_contact_name" in data:
        user.emergency_contact_name = (data["emergency_contact_name"] or "").strip() or None

    if "emergency_contact_phone" in data:
        raw = data["emergency_contact_phone"]
        if raw is not None and str(raw).strip():
            if not validate_emergency_contact_phone(raw):
                raise HTTPException(
                    status_code=422,
                    detail="Emergency contact phone must be Tunisian (+216…) or international (+…).",
                )
            user.emergency_contact_phone = normalize_emergency_contact_phone(raw)
        else:
            user.emergency_contact_phone = None

    if "emergency_contact_relationship" in data:
        user.emergency_contact_relationship = data["emergency_contact_relationship"]

    if "cin_number" in data:
        num = (data["cin_number"] or "").strip()
        if num and not re.match(r"^\d{8}$", num):
            raise HTTPException(status_code=422, detail="CIN must be exactly 8 digits")
        user.cin_number = num or None

    if "passport_number" in data:
        pnum = (data["passport_number"] or "").strip()
        if pnum and not validate_passport_number(pnum):
            raise HTTPException(
                status_code=422,
                detail="Passport number must be letters followed by digits (min. 6 characters).",
            )
        user.passport_number = pnum.upper() if pnum else None

    if "passport_expiry_date" in data:
        raw = data["passport_expiry_date"]
        if raw:
            try:
                pexp = datetime.strptime(raw, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=422, detail="passport_expiry_date must be YYYY-MM-DD")
            user.passport_expiry_date = pexp
        else:
            user.passport_expiry_date = None

    if "cin_document_url" in data:
        try:
            validate_id_document_data_url(data["cin_document_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        user.cin_document_url = data["cin_document_url"]

    if "passport_document_url" in data:
        try:
            validate_id_document_data_url(data["passport_document_url"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        user.passport_document_url = data["passport_document_url"]

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Admin profile updated"}


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
            requested_fields=_parse_json_list(cr.requested_fields),
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
    fields = _parse_json_list(cr.requested_fields)
    if not fields:
        fields = list(_LEGACY_FULL_CORRECTION_FIELDS)
    user.correction_unlock_fields = fields
    user.id_fields_unlocked = 1 if ({"cin", "passport"} & set(fields)) else 0
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


def _admin_verification_status(
    u: User,
    pending_correction_ids: set[int],
) -> str:
    if u.id in pending_correction_ids:
        return "under_review"
    st = getattr(u, "id_document_status", None)
    if st == "rejected":
        return "rejected"
    if st == "approved":
        return "approved"
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
    pending_correction_ids = {
        int(r[0])
        for r in db.query(CorrectionRequest.admin_id)
        .filter(CorrectionRequest.status == "pending")
        .all()
    }

    rows: list[AdminListItem] = []
    for u in admins:
        vs = _admin_verification_status(u, pending_correction_ids)
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
            )
        )
    return rows


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
