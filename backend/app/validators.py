"""
Shared validation: Tunisian phone numbers and base64 data-URL uploads.
"""

import base64
import re

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
