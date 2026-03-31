"""
Shared validation: Tunisian phone numbers and base64 data-URL uploads.
"""

import base64
import re
from datetime import date
from typing import Optional

TUNISIAN_PHONE_RE = re.compile(r"^\+216[2459]\d{7}$")

ERR_DOC_FORMAT = "Only JPG, PNG or PDF files are accepted."
ERR_DOC_SIZE = "File size must be under 5MB."
ERR_PHOTO_FORMAT = "Only JPG, PNG or JPEG files are accepted."
ERR_PHOTO_SIZE = "File size must be under 2MB."

_DOC_TYPES = {"image/jpeg", "image/jpg", "image/png", "application/pdf"}
_PHOTO_TYPES = {"image/jpeg", "image/jpg", "image/png"}


def normalize_tunisian_phone(raw: str) -> str:
    """Strip to +216 plus up to 8 subscriber digits (drops country code if repeated)."""
    d = re.sub(r"\D", "", raw or "")
    if d.startswith("216"):
        d = d[3:]
    d = d[:8]
    return f"+216{d}" if d else ""


def validate_tunisian_phone_digits(phone: str) -> bool:
    return bool(TUNISIAN_PHONE_RE.match(normalize_tunisian_phone(phone)))


def normalize_emergency_contact_phone(raw: Optional[str]) -> str:
    """Keep only + and digits (no spaces, letters, or other symbols)."""
    if raw is None:
        return ""
    return re.sub(r"[^+\d]", "", str(raw).strip())


def validate_emergency_contact_phone(raw: Optional[str]) -> bool:
    """
    Tunisian: +216[2459] + 7 digits (exactly 8 digits after +216).
    International (non-216): + then 7–15 digits total after +.
    Only + and digits allowed before normalization.
    """
    s = normalize_emergency_contact_phone(raw)
    if not s or s[0] != "+":
        return False
    if not re.match(r"^\+\d+$", s):
        return False
    rest = s[1:]
    if s.startswith("+216"):
        return bool(TUNISIAN_PHONE_RE.match(normalize_tunisian_phone(s)))
    if 7 <= len(rest) <= 15:
        return True
    return False


def validate_passport_number(raw: str) -> bool:
    """Letter(s) then digit(s), min 6 characters total."""
    if not raw or len(raw.strip()) < 6:
        return False
    t = raw.strip()
    return bool(re.match(r"^[A-Za-z]+[0-9][A-Za-z0-9]*$", t))


def validate_passport_expiry_future(d: date) -> bool:
    return d > date.today()


def _parse_data_url(data_url: str) -> tuple[str, bytes]:
    if not data_url or not isinstance(data_url, str):
        raise ValueError("Invalid upload")
    s = data_url.strip()
    if not s.startswith("data:"):
        raise ValueError(ERR_DOC_FORMAT)
    try:
        header, b64 = s.split(",", 1)
    except ValueError:
        raise ValueError(ERR_DOC_FORMAT)
    if ";base64" not in header:
        raise ValueError(ERR_DOC_FORMAT)
    mime = header.split(";", 1)[0].replace("data:", "").strip().lower()
    if mime == "image/jpg":
        mime = "image/jpeg"
    try:
        raw = base64.b64decode(b64, validate=False)
    except Exception:
        raise ValueError(ERR_DOC_FORMAT)
    return mime, raw


def validate_id_document_data_url(data_url: str) -> None:
    mime, raw = _parse_data_url(data_url)
    if mime not in _DOC_TYPES:
        raise ValueError(ERR_DOC_FORMAT)
    if len(raw) > 5 * 1024 * 1024:
        raise ValueError(ERR_DOC_SIZE)


def validate_profile_photo_data_url(data_url: str) -> None:
    mime, raw = _parse_data_url(data_url)
    if mime not in _PHOTO_TYPES:
        raise ValueError(ERR_PHOTO_FORMAT)
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError(ERR_PHOTO_SIZE)
