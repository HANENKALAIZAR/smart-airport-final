"""
SQLAlchemy ORM models for Smart Airport Operations.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, ForeignKey,
    DECIMAL, Text, JSON, TIMESTAMP, SmallInteger, Date,
    Index,
)
from sqlalchemy.orm import relationship
from app.database import Base


def _now():
    """Current UTC time — timezone-aware (replaces deprecated datetime.utcnow)."""
    return datetime.now(timezone.utc)


# ── Airport ──────────────────────────────────────────────────

class Airport(Base):
    __tablename__ = "airports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    iata_code = Column(String(3), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    city = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    region = Column(String(30), nullable=False)
    timezone = Column(String(50), nullable=False)
    latitude = Column(DECIMAL(9, 6))
    longitude = Column(DECIMAL(9, 6))
    created_at = Column(TIMESTAMP, default=_now)

    weather_conditions = relationship("WeatherCondition", back_populates="airport")


# ── Airline ──────────────────────────────────────────────────

class Airline(Base):
    __tablename__ = "airlines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    iata_code = Column(String(2), unique=True, nullable=False)
    name = Column(String(120), nullable=False)
    reliability_score = Column(DECIMAL(3, 2), nullable=False, default=0.80)
    created_at = Column(TIMESTAMP, default=_now)

    flights = relationship("Flight", back_populates="airline")


# ── Flight ───────────────────────────────────────────────────

class Flight(Base):
    __tablename__ = "flights"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flight_number = Column(String(10), nullable=False, index=True)
    airline_id = Column(Integer, ForeignKey("airlines.id"), nullable=False)
    origin_airport_id = Column(Integer, ForeignKey("airports.id"), nullable=False)
    dest_airport_id = Column(Integer, ForeignKey("airports.id"), nullable=False)
    scheduled_departure = Column(DateTime, nullable=False, index=True)
    scheduled_arrival = Column(DateTime, nullable=False)
    actual_departure = Column(DateTime, nullable=True)
    actual_arrival = Column(DateTime, nullable=True)
    status = Column(
        Enum("scheduled", "on_time", "delayed", "cancelled", name="flight_status"),
        nullable=False, default="scheduled", index=True,
    )
    delay_minutes = Column(Integer, nullable=False, default=0)
    distance_km = Column(Integer, nullable=False, default=0)
    aircraft_type = Column(String(30), nullable=True)
    created_at = Column(TIMESTAMP, default=_now)
    updated_at = Column(TIMESTAMP, default=_now, onupdate=_now)

    airline = relationship("Airline", back_populates="flights")
    origin_airport = relationship("Airport", foreign_keys=[origin_airport_id])
    dest_airport = relationship("Airport", foreign_keys=[dest_airport_id])
    features = relationship("FlightFeature", back_populates="flight", uselist=False)
    predictions = relationship("Prediction", back_populates="flight")


# ── Weather Condition ────────────────────────────────────────

class WeatherCondition(Base):
    __tablename__ = "weather_conditions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    airport_id = Column(Integer, ForeignKey("airports.id"), nullable=False)
    recorded_at = Column(DateTime, nullable=False)
    temperature_c = Column(DECIMAL(5, 2))
    wind_speed_kmh = Column(DECIMAL(6, 2))
    wind_direction = Column(Integer)
    visibility_km = Column(DECIMAL(5, 2))
    precipitation_mm = Column(DECIMAL(5, 2), default=0)
    weather_code = Column(String(30))
    humidity_pct = Column(Integer)
    pressure_hpa = Column(DECIMAL(6, 1))
    created_at = Column(TIMESTAMP, default=_now)

    airport = relationship("Airport", back_populates="weather_conditions")

    __table_args__ = (
        Index("idx_airport_time", "airport_id", "recorded_at"),
    )


# ── Flight Features (ML) ────────────────────────────────────

class FlightFeature(Base):
    __tablename__ = "flight_features"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flight_id = Column(Integer, ForeignKey("flights.id"), unique=True, nullable=False)

    weather_severity = Column(DECIMAL(4, 3), nullable=False, default=0.000)
    origin_weather_severity = Column(DECIMAL(4, 3), nullable=False, default=0.000)
    dest_weather_severity = Column(DECIMAL(4, 3), nullable=False, default=0.000)

    hour_of_day = Column(Integer, nullable=False)
    day_of_week = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    is_weekend = Column(SmallInteger, nullable=False, default=0)
    is_holiday = Column(SmallInteger, nullable=False, default=0)

    congestion_level = Column(DECIMAL(4, 3), nullable=False, default=0.000)
    origin_congestion = Column(DECIMAL(4, 3), nullable=False, default=0.000)
    dest_congestion = Column(DECIMAL(4, 3), nullable=False, default=0.000)

    airline_reliability = Column(DECIMAL(3, 2), nullable=False, default=0.80)
    distance_km = Column(Integer, nullable=False, default=0)
    historical_delay_rate = Column(DECIMAL(4, 3), nullable=False, default=0.000)

    is_delayed = Column(SmallInteger, nullable=False, default=0, index=True)
    delay_minutes = Column(Integer, nullable=False, default=0)

    created_at = Column(TIMESTAMP, default=_now)

    flight = relationship("Flight", back_populates="features")


# ── Prediction ───────────────────────────────────────────────

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flight_id = Column(Integer, ForeignKey("flights.id"), nullable=False, index=True)
    risk_score = Column(DECIMAL(5, 2), nullable=False)
    predicted_delay_min = Column(Integer, nullable=False, default=0)
    confidence = Column(DECIMAL(4, 3), nullable=False, default=0.000)
    shap_explanation = Column(JSON, nullable=True)
    model_version = Column(String(30), nullable=True)
    predicted_at = Column(TIMESTAMP, default=_now)

    flight = relationship("Flight", back_populates="predictions")

    __table_args__ = (
        Index("idx_risk", "risk_score"),
    )


# ── User ─────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    email                = Column(String(255), unique=True, nullable=False)
    password_hash        = Column(String(255), nullable=False)
    full_name            = Column(String(120), nullable=False)
    # No 'staff' role — only passenger, admin, super_admin
    role = Column(
        Enum("passenger", "admin", "super_admin", name="user_role"),
        nullable=False, default="admin", index=True,
    )
    airport_iata         = Column(String(3), nullable=True)   # e.g. 'TUN', 'DJE'
    is_active            = Column(SmallInteger, nullable=False, default=1)
    must_change_password = Column(SmallInteger, nullable=False, default=0)
    profile_complete     = Column(SmallInteger, nullable=False, default=0)
    last_login           = Column(TIMESTAMP, nullable=True)
    created_at           = Column(TIMESTAMP, default=_now)
    updated_at           = Column(TIMESTAMP, default=_now, onupdate=_now)

    # ── Profile fields (completed during first-login onboarding) ──
    employee_id          = Column(String(32), unique=True, nullable=True, index=True)
    phone_number         = Column(String(30), nullable=True)
    date_of_birth        = Column(Date, nullable=True)
    nationality          = Column(String(120), nullable=True)
    gender               = Column(String(20), nullable=True)  # Male | Female
    residential_address  = Column(Text, nullable=True)
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(40), nullable=True)
    emergency_contact_relationship = Column(String(30), nullable=True)  # Parent, Spouse, ...
    cin_number           = Column(String(50), nullable=True)
    cin_document_url     = Column(Text, nullable=True)
    passport_number      = Column(String(50), nullable=True)
    passport_document_url = Column(Text, nullable=True)
    passport_expiry_date = Column(Date, nullable=True)
    profile_photo_url    = Column(Text, nullable=True)   # base64 data URL (large)
    personal_email       = Column(String(255), nullable=True)    # personal gmail/yahoo for welcome emails
    id_document_status = Column(
        Enum("pending", "approved", "rejected", name="id_document_status_enum"),
        nullable=True,
    )
    id_document_rejection_reason = Column(Text, nullable=True)
    id_fields_unlocked = Column(SmallInteger, nullable=False, default=0)
    # JSON list of field keys: full_name, date_of_birth, gender, nationality, cin, passport,
    # residential_address, emergency_contact — set when super admin approves a correction request.
    correction_unlock_fields = Column(JSON, nullable=True)


# ── In-app notifications (bell) ────────────────────────────

class InAppNotification(Base):
    __tablename__ = "in_app_notifications"

    id = Column(String(36), primary_key=True)
    recipient_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(64), nullable=False, index=True)
    body = Column(Text, nullable=False)
    context = Column(JSON, nullable=True)
    is_read = Column(SmallInteger, nullable=False, default=0, index=True)
    created_at = Column(TIMESTAMP, default=_now)


class CorrectionRequest(Base):
    __tablename__ = "correction_requests"

    id = Column(String(36), primary_key=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    requested_fields = Column(JSON, nullable=True)  # list[str] — fields admin asked to correct
    status = Column(
        Enum(
            "pending", "unlocked", "dismissed", "fulfilled",
            name="correction_request_status_enum",
        ),
        nullable=False,
        default="pending",
    )
    super_admin_note = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, default=_now)


# ── AI Alerts ──────────────────────────────────────────────────
class AIAlert(Base):
    __tablename__ = "ai_alerts"

    id = Column(String(36), primary_key=True)
    flight_number = Column(String(32), nullable=False, index=True)
    airport_iata = Column(String(3), nullable=False, index=True)
    airport_name = Column(String(150), nullable=False)
    risk_pct = Column(SmallInteger, nullable=False, default=0)
    cause = Column(Text, nullable=False, default="")
    recommendation = Column(Text, nullable=False, default="")

    decision = Column(
        Enum("pending", "approved", "rejected", name="ai_alert_decision_enum"),
        nullable=False,
        default="pending",
        index=True,
    )
    acted_by_admin_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    decided_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, default=_now, nullable=False)

    __table_args__ = (
        Index("idx_ai_alert_airport_flight", "airport_iata", "flight_number"),
    )


# ── Password reset (airport admins / super_admin) ───────────

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(TIMESTAMP, nullable=False)
    used = Column(SmallInteger, nullable=False, default=0)


# ── Passenger Rights ─────────────────────────────────────────

class PassengerRight(Base):
    __tablename__ = "passenger_rights"

    id = Column(Integer, primary_key=True, autoincrement=True)
    region = Column(String(30), nullable=False)
    regulation_name = Column(String(120), nullable=False)
    delay_threshold_min = Column(Integer, nullable=False)
    distance_min_km = Column(Integer, nullable=True)
    distance_max_km = Column(Integer, nullable=True)
    right_type = Column(
        Enum("refreshment", "meal", "hotel", "transport", "compensation",
             "refund", "reboard", name="right_type_enum"),
        nullable=False,
    )
    description_en = Column(Text, nullable=False)
    description_fr = Column(Text, nullable=True)
    compensation_amount = Column(String(50), nullable=True)
    created_at = Column(TIMESTAMP, default=_now)

    __table_args__ = (
        Index("idx_region_delay", "region", "delay_threshold_min"),
    )


# ── Internal Message ─────────────────────────────────────────

class Message(Base):
    """Internal messaging between airport admins and super admin."""
    __tablename__ = "messages"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    # 'to_super' = admin → super admin | 'to_admin' = super admin → admin
    direction    = Column(Enum("to_super", "to_admin", name="msg_direction"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id   = Column(Integer, ForeignKey("users.id"), nullable=True)  # None = broadcast to super
    category     = Column(
        Enum("technical", "operational", "request", "general", name="msg_category"),
        nullable=False, default="general",
    )
    subject      = Column(String(200), nullable=False)
    body         = Column(Text, nullable=False)
    status       = Column(
        Enum("open", "in_progress", "resolved", name="msg_status"),
        nullable=False, default="open",
    )
    created_at   = Column(TIMESTAMP, default=_now)
    updated_at   = Column(TIMESTAMP, default=_now, onupdate=_now)

    from_user  = relationship("User", foreign_keys=[from_user_id])
    to_user    = relationship("User", foreign_keys=[to_user_id])
    replies    = relationship("MessageReply", back_populates="message", order_by="MessageReply.created_at")

    __table_args__ = (
        Index("idx_msg_direction", "direction"),
        Index("idx_msg_status", "status"),
    )


class MessageReply(Base):
    """A reply within a message thread."""
    __tablename__ = "message_replies"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False, index=True)
    author_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    body       = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, default=_now)

    message = relationship("Message", back_populates="replies")
    author  = relationship("User", foreign_keys=[author_id])


# ── Audit Log ─────────────────────────────────────────────────

class AuditLog(Base):
    """Records sensitive super-admin actions, e.g. bypassing duplicate warnings."""
    __tablename__ = "audit_log"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    super_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action         = Column(String(100), nullable=False)    # e.g. 'bypassed_duplicate_warning'
    target_name    = Column(String(120), nullable=False)
    details        = Column(Text, nullable=True)
    created_at     = Column(TIMESTAMP, default=_now)

    super_admin = relationship("User", foreign_keys=[super_admin_id])
