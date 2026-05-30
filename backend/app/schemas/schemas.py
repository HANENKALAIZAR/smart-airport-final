"""
Pydantic schemas for request/response validation.
"""

from datetime import datetime, date
from pydantic import BaseModel, field_validator
from typing import Optional, Literal




# ── Airport ──────────────────────────────────────────────────

class AirportOut(BaseModel):
    id: int
    iata_code: str
    name: str
    city: str
    country: str
    region: str

    class Config:
        from_attributes = True


# ── Airline ──────────────────────────────────────────────────

class AirlineOut(BaseModel):
    id: int
    iata_code: str
    name: str
    reliability_score: float

    class Config:
        from_attributes = True


# ── Flight ───────────────────────────────────────────────────

class FlightBase(BaseModel):
    flight_number: str
    scheduled_departure: datetime
    scheduled_arrival: datetime
    status: Literal["scheduled", "on_time", "delayed", "cancelled"]
    delay_minutes: int
    distance_km: int
    aircraft_type: Optional[str] = None


class FlightListOut(FlightBase):
    id: int
    airline: AirlineOut
    origin_airport: AirportOut
    dest_airport: AirportOut

    class Config:
        from_attributes = True


class FlightDetailOut(FlightListOut):
    actual_departure: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    prediction: Optional["PredictionOut"] = None
    passenger_rights: Optional[list["PassengerRightOut"]] = None
    gate: Optional[str] = None
    terminal: Optional[str] = None
    delay_cause: Optional["DelayCause"] = None

    class Config:
        from_attributes = True


class FlightCreate(BaseModel):
    flight_number: str
    airline_iata: str
    origin_iata: str
    destination_iata: str
    scheduled_departure: datetime
    scheduled_arrival: datetime
    status: Literal["scheduled", "on_time", "delayed", "cancelled"] = "scheduled"
    delay_minutes: int = 0
    distance_km: int = 0
    aircraft_type: Optional[str] = None


class FlightUpdate(BaseModel):
    status: Optional[Literal["scheduled", "on_time", "delayed", "cancelled"]] = None
    delay_minutes: Optional[int] = None
    actual_departure: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    aircraft_type: Optional[str] = None


# ── Prediction ───────────────────────────────────────────────

class PredictionOut(BaseModel):
    risk_score: float
    predicted_delay_min: int
    confidence: float
    shap_explanation: Optional[dict] = None
    model_version: Optional[str] = None
    predicted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PredictionRequest(BaseModel):
    weather_severity: float
    origin_weather_severity: float
    dest_weather_severity: float
    hour_of_day: int
    day_of_week: int
    month: int
    is_weekend: int
    congestion_level: float
    origin_congestion: float
    dest_congestion: float
    airline_reliability: float
    distance_km: int
    historical_delay_rate: float


# ── Weather ──────────────────────────────────────────────────

class WeatherOut(BaseModel):
    temperature_c: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    visibility_km: Optional[float] = None
    precipitation_mm: Optional[float] = None
    weather_code: Optional[str] = None
    humidity_pct: Optional[int] = None
    recorded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Flight Features ──────────────────────────────────────────

class FlightFeaturesOut(BaseModel):
    weather_severity: float
    origin_weather_severity: float
    dest_weather_severity: float
    hour_of_day: int
    day_of_week: int
    month: int
    is_weekend: int
    congestion_level: float
    origin_congestion: float
    dest_congestion: float
    airline_reliability: float
    distance_km: int
    historical_delay_rate: float
    is_delayed: int
    delay_minutes: int

    class Config:
        from_attributes = True


# ── Passenger Rights ─────────────────────────────────────────

class PassengerRightOut(BaseModel):
    region: str
    regulation_name: str
    delay_threshold_min: int
    right_type: str
    description_en: str
    description_fr: Optional[str] = None
    compensation_amount: Optional[str] = None

    class Config:
        from_attributes = True


# ── Auth ─────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "passenger"


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: int
    airport_iata: Optional[str] = None
    must_change_password: int = 0
    profile_complete: int = 0
    is_approved: bool = False
    personal_email: Optional[str] = None
    employee_id: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    gender: Optional[str] = None
    residential_address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    cin_number: Optional[str] = None
    cin_document_url: Optional[str] = None
    cin_document_back_url: Optional[str] = None
    passport_number: Optional[str] = None
    passport_document_url: Optional[str] = None
    passport_expiry_date: Optional[date] = None
    profile_photo_url: Optional[str] = None
    id_document_status: Optional[str] = None
    id_document_rejection_reason: Optional[str] = None
    rejected_fields: Optional[list[str]] = None
    correction_attempts: int = 0
    onboarding_status: Optional[str] = None
    rejection_reasons: Optional[str] = None

    @field_validator("id_document_status", "gender", "emergency_contact_relationship", mode="before")
    @classmethod
    def _coerce_enums(cls, v):
        if v is None:
            return None
        return str(v)

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False
    profile_complete: bool = False
    is_approved: bool = False
    user: UserOut


class ProfileCompleteRequest(BaseModel):
    phone_number: str
    date_of_birth: str  # YYYY-MM-DD
    nationality: str
    gender: Literal["Male", "Female"]
    residential_address: str
    emergency_contact_name: str
    emergency_contact_phone: str
    emergency_contact_relationship: Literal["Parent", "Spouse", "Sibling", "Friend", "Other"]
    cin_number: str
    cin_document_url: str
    cin_document_back_url: str
    passport_number: str
    passport_document_url: str
    passport_expiry_date: str  # YYYY-MM-DD
    profile_photo_url: str


class PatchMySettingsRequest(BaseModel):
    phone_number: Optional[str] = None
    profile_photo_url: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[Literal["Male", "Female"]] = None
    nationality: Optional[str] = None
    residential_address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[
        Literal["Parent", "Spouse", "Sibling", "Friend", "Other"]
    ] = None
    cin_number: Optional[str] = None
    cin_document_url: Optional[str] = None
    cin_document_back_url: Optional[str] = None
    passport_number: Optional[str] = None
    passport_document_url: Optional[str] = None
    passport_expiry_date: Optional[str] = None


class SuperAdminSelfProfilePatch(BaseModel):
    """Super admin may update any of their own profile fields (all optional; send only what changes)."""

    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    profile_photo_url: Optional[str] = None
    date_of_birth: Optional[str] = None  # YYYY-MM-DD
    cin_number: Optional[str] = None
    cin_document_url: Optional[str] = None
    cin_document_back_url: Optional[str] = None
    passport_number: Optional[str] = None
    passport_document_url: Optional[str] = None
    passport_expiry_date: Optional[str] = None


class SuperAdminAdminProfilePatch(BaseModel):
    """Super admin: edit another airport admin’s profile (all optional)."""

    full_name: Optional[str] = None
    personal_email: Optional[str] = None
    phone_number: Optional[str] = None
    profile_photo_url: Optional[str] = None
    date_of_birth: Optional[str] = None
    nationality: Optional[str] = None
    gender: Optional[Literal["Male", "Female"]] = None
    residential_address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[
        Literal["Parent", "Spouse", "Sibling", "Friend", "Other"]
    ] = None
    cin_number: Optional[str] = None
    cin_document_url: Optional[str] = None
    cin_document_back_url: Optional[str] = None
    passport_number: Optional[str] = None
    passport_document_url: Optional[str] = None
    passport_expiry_date: Optional[str] = None


class IdDocumentReuploadRequest(BaseModel):
    cin_document_url: Optional[str] = None
    cin_document_back_url: Optional[str] = None
    passport_document_url: Optional[str] = None


class AdminReviewDetail(BaseModel):
    id: int
    full_name: str
    email: str
    personal_email: Optional[str] = None
    airport_iata: Optional[str] = None
    employee_id: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    gender: Optional[str] = None
    residential_address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    cin_number: Optional[str] = None
    cin_document_url: Optional[str] = None
    cin_document_back_url: Optional[str] = None
    passport_number: Optional[str] = None
    passport_document_url: Optional[str] = None
    passport_expiry_date: Optional[date] = None
    profile_photo_url: Optional[str] = None
    id_document_status: Optional[str] = None
    id_document_rejection_reason: Optional[str] = None
    rejected_fields: Optional[list[str]] = None
    correction_attempts: int = 0
    profile_complete: int = 0

    @field_validator("id_document_status", "gender", "emergency_contact_relationship", mode="before")
    @classmethod
    def _coerce_enums(cls, v):
        if v is None:
            return None
        return str(v)

    class Config:
        from_attributes = True


class IdReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    reason: Optional[str] = None
    rejected_fields: Optional[list[str]] = None


class AiAlertGeneratedBody(BaseModel):
    flight_number: str
    brief_cause: str = ""
    recommendation: str = ""
    risk_pct: int = 0


class AiAlertActionBody(BaseModel):
    flight_number: str
    action: Literal["approved", "rejected"]


class ForgotPasswordRequest(BaseModel):
    work_email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str


# ── Dashboard ────────────────────────────────────────────────

class DashboardOverview(BaseModel):
    total_flights: int
    on_time_count: int
    delayed_count: int
    cancelled_count: int
    at_risk_count: int
    avg_delay_minutes: float
    delay_rate: float


class DelayCause(BaseModel):
    factor: str
    impact: float
    description: str


class DelayHistoryPoint(BaseModel):
    date: str
    delay_rate: float
    avg_delay: float
    total_flights: int


# ── Messaging ────────────────────────────────────────────────

class MessageReplyOut(BaseModel):
    id: int
    author_id: int
    author_name: str
    author_role: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    direction: str
    from_user_id: Optional[int] = None
    from_user_name: str
    from_user_airport: Optional[str] = None
    to_user_id: Optional[int] = None
    to_user_name: Optional[str] = None
    category: str
    subject: str
    body: str
    status: str
    is_read: bool
    created_at: datetime
    updated_at: datetime
    passenger_name: Optional[str] = None
    passenger_email: Optional[str] = None
    airport_code: Optional[str] = None
    sender_type: str = "internal"
    assigned_admin_id: Optional[int] = None
    assigned_admin_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    deleted_by_sender: bool = False
    deleted_by_recipient: bool = False
    replies: list[MessageReplyOut] = []

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    to_user_id: Optional[int] = None   # required when super_admin sends to_admin
    category: str = "general"
    subject: str
    body: str


class PublicFeedbackCreate(BaseModel):
    name: str
    email: str
    airport: str
    subject: str
    message: str


class MessageReplyCreate(BaseModel):
    body: str
