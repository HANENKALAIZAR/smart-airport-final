"""
SQLAlchemy ORM models for Smart Airport Operations.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, ForeignKey,
    DECIMAL, Text, JSON, TIMESTAMP, SmallInteger, Date, Boolean,
    Index, Float, UniqueConstraint
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
    # v10: direct IATA codes for fast feature-pipeline joins (no airline/airport join needed)
    flight_date  = Column(Date, nullable=True, index=True)
    dep_iata     = Column(String(3), nullable=True, index=True)
    arr_iata     = Column(String(3), nullable=True)
    source       = Column(String(20), nullable=True, default="manual")
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
        Index("idx_airport_time", "airport_id", "recorded_at", unique=True),
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

    # v11: reliability scoring
    confidence_score = Column(Float, nullable=True, default=1.0)
    usable_for_ml    = Column(Boolean, nullable=True, default=True)

    # v10: raw weather values stored alongside computed severity
    temperature_c    = Column(DECIMAL(5, 2), nullable=True)
    wind_speed_kmh   = Column(DECIMAL(6, 2), nullable=True)
    visibility_km    = Column(DECIMAL(5, 2), nullable=True)
    precipitation_mm = Column(DECIMAL(5, 2), nullable=True)
    # v10: version tag so pipeline knows which rows need reprocessing
    feature_version  = Column(String(10), nullable=True, default="v1")

    created_at = Column(TIMESTAMP, default=_now)

    flight = relationship("Flight", back_populates="features")


# ── Prediction ───────────────────────────────────────────────

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # v10: flight_id is nullable — predictions on live flights not yet in DB use flight_number
    flight_id = Column(Integer, ForeignKey("flights.id"), nullable=True, index=True)
    flight_number = Column(String(10), nullable=True, index=True)   # set when flight_id is NULL
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
    __table_args__ = (
        Index('ix_unique_super_admin', 'role', unique=True, postgresql_where=(Column('role') == 'super_admin'), sqlite_where=(Column('role') == 'super_admin')),
    )

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
    cin_document_back_url = Column(Text, nullable=True)
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
    rejected_fields = Column(JSON, nullable=True)  # List of explicitly rejected field keys
    correction_attempts = Column(Integer, default=0, nullable=False)



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
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
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
    is_read      = Column(Boolean, nullable=False, default=False)
    created_at   = Column(TIMESTAMP, default=_now)
    updated_at   = Column(TIMESTAMP, default=_now, onupdate=_now)

    # Soft deletion
    deleted_by_sender = Column(Boolean, nullable=False, default=False)
    deleted_by_recipient = Column(Boolean, nullable=False, default=False)

    # Passenger feedback fields
    passenger_name = Column(String(200), nullable=True)
    passenger_email = Column(String(200), nullable=True)
    airport_code = Column(String(10), nullable=True)
    sender_type = Column(String(50), nullable=False, default="internal")

    # Assignment fields
    assigned_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_admin_name = Column(String(200), nullable=True)
    assigned_at = Column(TIMESTAMP, nullable=True)

    from_user  = relationship("User", foreign_keys=[from_user_id])
    to_user    = relationship("User", foreign_keys=[to_user_id])
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id])
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


# ── Model Metrics (v10) ─────────────────────────────────────────────

class ModelMetrics(Base):
    """Stores evaluation metrics for each trained model version."""
    __tablename__ = "model_metrics"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    model_version     = Column(String(30), nullable=False)
    trained_at        = Column(TIMESTAMP, default=_now, nullable=False)
    n_train_samples   = Column(Integer, nullable=True)
    n_test_samples    = Column(Integer, nullable=True)
    train_cutoff_date = Column(Date, nullable=True)
    accuracy          = Column(DECIMAL(5, 4), nullable=True)
    precision_score   = Column(DECIMAL(5, 4), nullable=True)
    recall            = Column(DECIMAL(5, 4), nullable=True)
    f1                = Column(DECIMAL(5, 4), nullable=True)
    roc_auc           = Column(DECIMAL(5, 4), nullable=True)
    mae_minutes       = Column(DECIMAL(6, 2), nullable=True)
    rmse_minutes      = Column(DECIMAL(6, 2), nullable=True)
    r2_score          = Column(DECIMAL(5, 4), nullable=True)
    feature_columns   = Column(JSON, nullable=True)
    hyperparams       = Column(JSON, nullable=True)  # includes confusion matrix
    notes             = Column(Text, nullable=True)
    is_active         = Column(SmallInteger, nullable=False, default=0)


# ── Passenger Alert Subscriptions ────────────────────────────────────────────

class PassengerAlertSubscription(Base):
    """
    One row per passenger email + flight_number subscription.
    UNIQUE on (email, flight_number) — no duplicate subscriptions.
    """
    __tablename__ = "passenger_alert_subscriptions"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    email               = Column(String(255), nullable=False, index=True)
    flight_number       = Column(String(12),  nullable=False, index=True)
    dep_iata            = Column(String(3),   nullable=True)
    arr_iata            = Column(String(3),   nullable=True)
    airline             = Column(String(120), nullable=True)
    scheduled_departure = Column(DateTime,    nullable=True)
    is_active           = Column(Boolean,     nullable=False, default=True)
    status              = Column(String(20),  nullable=False, default="ACTIVE")
    completed_at        = Column(TIMESTAMP,   nullable=True)
    completion_reason   = Column(String(50),  nullable=True)
    last_checked_at     = Column(TIMESTAMP,   nullable=True)
    last_notified_status= Column(String(50),  nullable=True)
    created_at          = Column(TIMESTAMP,   default=_now)

    logs = relationship("PassengerAlertLog", back_populates="subscription")

    __table_args__ = (
        Index("idx_pas_active", "is_active"),
        Index("idx_pas_dedup", "email", "flight_number", unique=True),
    )


class PassengerAlertLog(Base):
    """
    Every email event sent for a subscription.
    Used by the background job to detect state changes and avoid duplicate emails.
    last_status / last_gate / last_delay are the last-notified values.
    """
    __tablename__ = "passenger_alert_logs"

    id              = Column(Integer,     primary_key=True, autoincrement=True)
    subscription_id = Column(Integer,     ForeignKey("passenger_alert_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    flight_number   = Column(String(12),  nullable=False, index=True)
    email           = Column(String(255), nullable=False)
    event_type      = Column(String(40),  nullable=False)   # confirmed|delay|gate_change|status_change|boarding|cancelled
    old_value       = Column(String(200), nullable=True)
    new_value       = Column(String(200), nullable=True)
    email_sent      = Column(Boolean,     nullable=False, default=False)
    sent_at         = Column(TIMESTAMP,   nullable=True)
    created_at      = Column(TIMESTAMP,   default=_now)

    subscription = relationship("PassengerAlertSubscription", back_populates="logs")

    __table_args__ = (
        Index("idx_pal_sub", "subscription_id"),
        Index("idx_pal_sent", "sent_at"),
    )


# ── Passenger Helpdesk Ticket System ─────────────────────────

class PassengerMessage(Base):
    """Passenger helpdesk tickets submitted from the public contact portal."""
    __tablename__ = "passenger_messages"

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    reference_id         = Column(String(50), unique=True, nullable=False, index=True)
    airport_iata         = Column(String(3), nullable=False, index=True)
    sender_name          = Column(String(120), nullable=False)
    sender_email         = Column(String(255), nullable=False)
    subject              = Column(String(255), nullable=False)
    message_body         = Column(Text, nullable=False)
    source               = Column(String(50), nullable=False, default="passenger_portal")
    priority             = Column(String(10), nullable=False, default="LOW")
    category             = Column(String(30), nullable=False, default="general")
    status               = Column(String(20), nullable=False, default="NEW")
    is_read              = Column(Boolean, nullable=False, default=False)
    
    assigned_admin_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    claimed_at           = Column(TIMESTAMP, nullable=True)
    claim_expires_at     = Column(TIMESTAMP, nullable=True)
    
    draft_body           = Column(Text, nullable=True)
    draft_last_saved_at  = Column(TIMESTAMP, nullable=True)
    
    first_response_at    = Column(TIMESTAMP, nullable=True)
    response_time_minutes = Column(Integer, nullable=True)
    
    created_at           = Column(TIMESTAMP, default=_now)
    updated_at           = Column(TIMESTAMP, default=_now, onupdate=_now)
    replied_at           = Column(TIMESTAMP, nullable=True)
    replied_by_admin_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at          = Column(TIMESTAMP, nullable=True)
    resolved_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id])
    replied_by_admin = relationship("User", foreign_keys=[replied_by_admin_id])
    resolved_by_admin = relationship("User", foreign_keys=[resolved_by_admin_id])
    replies = relationship("PassengerMessageThread", back_populates="message", order_by="PassengerMessageThread.created_at", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_pm_airport_status_created", "airport_iata", "status", "created_at"),
    )


class PassengerMessageThread(Base):
    """Chronological thread of message replies and internal coordination notes."""
    __tablename__ = "passenger_message_threads"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    message_id        = Column(Integer, ForeignKey("passenger_messages.id"), nullable=False, index=True)
    sender_type       = Column(String(20), nullable=False) # passenger | admin | system | internal_note
    sender_name       = Column(String(120), nullable=False)
    sender_email      = Column(String(255), nullable=True)
    admin_id          = Column(Integer, ForeignKey("users.id"), nullable=True)
    body              = Column(Text, nullable=False)
    email_status      = Column(String(50), nullable=True) # sent | failed | None
    message_id_header = Column(String(255), nullable=True)
    retry_count       = Column(Integer, default=0, nullable=False)
    created_at        = Column(TIMESTAMP, default=_now)

    message = relationship("PassengerMessage", back_populates="replies")
    admin = relationship("User", foreign_keys=[admin_id])


class PassengerMessageReadState(Base):
    """Tracks which admins have read which passenger messages to support per-user read/unread indicators."""
    __tablename__ = "passenger_message_read_states"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("passenger_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    read_at = Column(TIMESTAMP, default=_now)

    message = relationship("PassengerMessage")
    admin = relationship("User")

    __table_args__ = (
        UniqueConstraint("message_id", "admin_id", name="uq_msg_admin_read"),
    )



