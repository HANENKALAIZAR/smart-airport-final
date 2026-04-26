"""
Smart Airport Operations – JWT Authentication Dependencies
==========================================================
Reusable FastAPI dependencies for JWT validation and role-based access control.
"""

import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.models import User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode JWT token and return the authenticated user.
    Raises HTTP 401 if token is missing, expired, or invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """
    Require admin or super_admin role.
    Raises HTTP 403 if the user lacks sufficient privileges.
    """
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    """Require super_admin role only."""
    if user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super-admin access required",
        )
    return user


def require_approved_admin(user: User = Depends(get_current_user)) -> User:
    """
    Require admin or super_admin role AND, for airport admins, an approved profile.
    Super admins bypass the approval check.
    Airport admins whose id_document_status is not 'approved' receive HTTP 403
    with a clear message so the frontend can route them to the pending screen.
    """
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    if user.role == "admin":
        doc_status = str(getattr(user, "id_document_status", None) or "")
        if doc_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Profile approval pending. Please wait for super admin approval.",
            )
    return user


def require_correction_or_approved_admin(user: User = Depends(get_current_user)) -> User:
    """
    Allow airport admins whose profile is 'approved' OR 'rejected'.
    Used for endpoints that rejected admins must still reach (e.g. /me/settings).
    'pending' and null statuses are still blocked — those admins haven't been
    reviewed at all yet and belong on the PendingApprovalScreen.
    """
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    if user.role == "admin":
        doc_status = str(getattr(user, "id_document_status", None) or "")
        if doc_status not in ("approved", "rejected"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Profile approval pending. Please wait for super admin approval.",
            )
    return user

