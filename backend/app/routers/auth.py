"""
Authentication API router.
"""

import json
import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import bcrypt

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import User, PasswordResetToken, CorrectionRequest
from app.schemas.schemas import (
    UserOut,
    LoginRequest,
    TokenOut,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.services.email_service import send_password_reset_email

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def assert_new_password_policy(password: str, *, must_differ_from: str | None = None) -> None:
    """Shared rules: change-password + reset-password."""
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be at least 8 characters",
        )
    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must contain at least one uppercase letter",
        )
    if not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must contain at least one number",
        )
    if not re.search(r"[!@#$%^&*]", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must contain at least one special character (!@#$%^&*)",
        )
    if must_differ_from is not None and password == must_differ_from:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be different from the current password",
        )


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return JWT token. Rate-limited to 10 attempts per minute."""
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.password_hash):
        logger.warning(f"Failed login attempt for email: {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    # JWT payload must be JSON-serializable (Postgres ENUM role is not always a plain str).
    token = create_access_token({
        "sub": str(user.id),
        "role": str(user.role),
        "airport": user.airport_iata,
    })

    logger.info(f"Successful login: {user.email} (role={user.role})")
    return TokenOut(
        access_token=token,
        must_change_password=bool(user.must_change_password),
        profile_complete=bool(getattr(user, "profile_complete", 0)),
        user=UserOut.model_validate(user),
    )


@router.post("/change-password", status_code=200)
def change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Change password for the currently authenticated user.
    Required on first login when must_change_password = 1.
    """
    current_password = (payload.get("current_password") or "").strip()
    new_password = payload.get("new_password", "") or ""

    if not new_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="new_password is required",
        )

    must_set_initial = bool(current_user.must_change_password)

    if must_set_initial:
        # User already authenticated with the temporary password; no need to send it again.
        if verify_password(new_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="New password must be different from your current password",
            )
        assert_new_password_policy(new_password)
    else:
        if not current_password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="current_password is required",
            )
        if not verify_password(current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect",
            )
        assert_new_password_policy(new_password, must_differ_from=current_password)

    current_user.password_hash = hash_password(new_password)
    current_user.must_change_password = 0
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(f"Password changed for user: {current_user.email}")
    return {"message": "Password updated successfully"}


def _mask_ident(value: Optional[str]) -> Optional[str]:
    """Mask ID numbers for airport admins viewing /me (last 4 visible)."""
    if not value:
        return value
    s = str(value)
    if len(s) <= 4:
        return "••••"
    return "•" * min(12, len(s) - 4) + s[-4:]


def _parse_unlock_list(raw) -> list[str]:
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


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the currently authenticated user's profile."""
    base = UserOut.model_validate(current_user)
    if current_user.role != "admin":
        return base
    pend = (
        db.query(CorrectionRequest)
        .filter(
            CorrectionRequest.admin_id == current_user.id,
            CorrectionRequest.status == "pending",
        )
        .first()
    )
    ul = set(_parse_unlock_list(getattr(current_user, "correction_unlock_fields", None)))
    has_cin_unlock = "cin" in ul
    has_pass_unlock = "passport" in ul
    legacy_unlock = int(getattr(current_user, "id_fields_unlocked", 0) or 0)
    id_unlock = legacy_unlock or has_cin_unlock or has_pass_unlock
    upd = {
        "correction_request_pending": pend is not None,
        "correction_unlock_fields": sorted(ul) if ul else None,
        "id_fields_unlocked": 1 if id_unlock else 0,
    }
    if has_cin_unlock or (legacy_unlock and not ul):
        upd["cin_number"] = getattr(current_user, "cin_number", None)
    else:
        upd["cin_number"] = _mask_ident(getattr(current_user, "cin_number", None))
    if has_pass_unlock or (legacy_unlock and not ul):
        upd["passport_number"] = getattr(current_user, "passport_number", None)
    else:
        upd["passport_number"] = _mask_ident(getattr(current_user, "passport_number", None))
    return base.model_copy(update=upd)


def _token_expiry_naive_utc(expires_at: datetime) -> datetime:
    if expires_at.tzinfo is None:
        return expires_at.replace(tzinfo=timezone.utc)
    return expires_at.astimezone(timezone.utc)


@router.post("/forgot-password", status_code=200)
@limiter.limit("5/minute")
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Always returns the same message. If the work email exists, sends reset link to personal_email.
    """
    msg = "If this email exists, a reset link has been sent to your personal email address."
    email = body.work_email.lower().strip()
    user = (
        db.query(User)
        .filter(User.email == email, User.role.in_(["admin", "super_admin"]))
        .first()
    )
    if user and user.is_active:
        personal = (getattr(user, "personal_email", None) or "").strip()
        if personal:
            db.query(PasswordResetToken).filter(
                PasswordResetToken.admin_id == user.id,
                PasswordResetToken.used == 0,
            ).update({PasswordResetToken.used: 1})
            raw_token = secrets.token_urlsafe(32)
            rec = PasswordResetToken(
                id=str(uuid.uuid4()),
                admin_id=user.id,
                token=raw_token,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
                used=0,
            )
            db.add(rec)
            db.commit()
            base = (settings.FRONTEND_URL or "").rstrip("/")
            reset_url = f"{base}/reset-password?token={raw_token}"
            first = user.full_name.split()[0] if user.full_name.strip() else "there"
            try:
                send_password_reset_email(personal, reset_url, first)
            except Exception as exc:
                logger.error(f"Password reset email failed: {exc}")
    return {"message": msg}


@router.get("/reset-password/validate")
def validate_reset_token(token: str, db: Session = Depends(get_db)):
    rec = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == (token or "").strip())
        .first()
    )
    if not rec or rec.used:
        return {"valid": False}
    exp = _token_expiry_naive_utc(rec.expires_at)
    if exp < datetime.now(timezone.utc):
        return {"valid": False}
    return {"valid": True}


@router.post("/reset-password", status_code=200)
@limiter.limit("10/minute")
def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    if body.new_password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password and confirmation do not match.",
        )

    assert_new_password_policy(body.new_password)

    rec = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == (body.token or "").strip())
        .first()
    )
    if not rec or rec.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link has expired or has already been used.",
        )
    exp = _token_expiry_naive_utc(rec.expires_at)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link has expired or has already been used.",
        )

    user = db.query(User).filter(User.id == rec.admin_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token.")

    user.password_hash = hash_password(body.new_password)
    user.must_change_password = 0
    user.updated_at = datetime.now(timezone.utc)
    rec.used = 1
    db.commit()

    return {
        "message": "Password changed successfully. You can now log in.",
    }
