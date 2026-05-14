"""
Aviation Edge Historical Data Models
=====================================
Dedicated tables for the AE ingestion pipeline, separate from the
main flights table to avoid polluting operational ML data with raw API snapshots.

Tables:
  ae_flight_snapshots   – Every raw API record, one row per poll cycle per flight
  ae_flight_dataset     – Deduplicated ML-ready feature rows (1 per flight per day)
  ae_sync_log           – Audit log of every background sync run
"""

from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger, Boolean, Column, Date, DateTime,
    Float, Index, Integer, SmallInteger, String, Text, TIMESTAMP,
)

from app.database import Base


def _now():
    return datetime.now(timezone.utc)


# ── 1. Raw Snapshots ──────────────────────────────────────────────────────────

class AEFlightSnapshot(Base):
    """
    One row per Aviation Edge API response record per polling cycle.
    Keeps ALL historical state changes for a flight – this is the raw archive.
    Deduplication: UPSERT on (flight_number, snapshot_date, airport_iata, direction).
    """
    __tablename__ = "ae_flight_snapshots"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    flight_number   = Column(String(12), nullable=False, index=True)
    flight_date     = Column(Date, nullable=True)          # UTC date of scheduled dep
    snapshot_date   = Column(Date, nullable=False, index=True)  # UTC date poll was run
    collected_at    = Column(TIMESTAMP, nullable=False, default=_now)  # exact UTC poll time

    airport_iata    = Column(String(3),  nullable=False, index=True)  # Tunisian airport polled
    direction       = Column(String(9),  nullable=False)               # 'departure'|'arrival'
    source          = Column(String(20), nullable=False, default="aviation_edge")

    # ── Airline ───────────────────────────────────────────────────────────────
    airline_name    = Column(String(120), nullable=True)
    airline_iata    = Column(String(3),   nullable=True)
    airline_icao    = Column(String(4),   nullable=True)

    # ── Departure ─────────────────────────────────────────────────────────────
    dep_iata        = Column(String(3),  nullable=True)
    dep_airport     = Column(String(120),nullable=True)
    dep_terminal    = Column(String(10), nullable=True)
    dep_gate        = Column(String(10), nullable=True)
    dep_scheduled   = Column(DateTime,   nullable=True)
    dep_estimated   = Column(DateTime,   nullable=True)
    dep_actual      = Column(DateTime,   nullable=True)
    dep_delay_min   = Column(Integer,    nullable=True)

    # ── Arrival ───────────────────────────────────────────────────────────────
    arr_iata        = Column(String(3),  nullable=True)
    arr_airport     = Column(String(120),nullable=True)
    arr_terminal    = Column(String(10), nullable=True)
    arr_gate        = Column(String(10), nullable=True)
    arr_scheduled   = Column(DateTime,   nullable=True)
    arr_estimated   = Column(DateTime,   nullable=True)
    arr_actual      = Column(DateTime,   nullable=True)
    arr_delay_min   = Column(Integer,    nullable=True)

    # ── Status / Delay ────────────────────────────────────────────────────────
    status          = Column(String(20), nullable=False, default="scheduled", index=True)
    delay_minutes   = Column(Integer,    nullable=True)

    # ── Aircraft ──────────────────────────────────────────────────────────────
    aircraft_type   = Column(String(30), nullable=True)
    aircraft_reg    = Column(String(20), nullable=True)

    # ── Live GPS (only for in-air flights) ───────────────────────────────────
    latitude        = Column(Float, nullable=True)
    longitude       = Column(Float, nullable=True)
    altitude_ft     = Column(Float, nullable=True)
    speed_kmh       = Column(Float, nullable=True)
    heading_deg     = Column(Float, nullable=True)
    is_ground       = Column(Boolean, nullable=True)

    __table_args__ = (
        # Primary dedup key – one row per flight per day per Tunisian airport per direction
        Index(
            "idx_ae_snapshot_dedup",
            "flight_number", "snapshot_date", "airport_iata", "direction",
            unique=True,
        ),
        Index("idx_ae_snapshot_status",    "status"),
        Index("idx_ae_snapshot_collected", "collected_at"),
        Index("idx_ae_snapshot_dep_iata",  "dep_iata"),
        Index("idx_ae_snapshot_arr_iata",  "arr_iata"),
    )


# ── 2. ML Dataset ─────────────────────────────────────────────────────────────

class AEFlightDataset(Base):
    """
    One preprocessed, ML-ready row per flight per day.
    Computed/normalised from AEFlightSnapshot.
    This is the dataset an AI model consumes directly.
    """
    __tablename__ = "ae_flight_dataset"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # ── Source link ───────────────────────────────────────────────────────────
    flight_number   = Column(String(12), nullable=False, index=True)
    flight_date     = Column(Date,       nullable=False, index=True)
    airport_iata    = Column(String(3),  nullable=False, index=True)
    direction       = Column(String(9),  nullable=False)
    airline_iata    = Column(String(3),  nullable=True)
    dep_iata        = Column(String(3),  nullable=True)
    arr_iata        = Column(String(3),  nullable=True)

    # ── Target variables (what we predict) ────────────────────────────────────
    is_delayed      = Column(SmallInteger, nullable=False, default=0, index=True)  # 1/0
    delay_minutes   = Column(Integer,      nullable=False, default=0)
    final_status    = Column(String(20),   nullable=True)                # landed/cancelled/etc

    # ── Time features ─────────────────────────────────────────────────────────
    dep_hour        = Column(SmallInteger, nullable=True)   # 0-23
    dep_day_of_week = Column(SmallInteger, nullable=True)   # 0=Mon
    dep_month       = Column(SmallInteger, nullable=True)   # 1-12
    dep_week        = Column(SmallInteger, nullable=True)   # ISO week 1-53
    is_weekend      = Column(SmallInteger, nullable=False, default=0)
    is_peak_hour    = Column(SmallInteger, nullable=False, default=0)   # 07-09 / 17-20

    # ── Continuous features ───────────────────────────────────────────────────
    distance_km     = Column(Integer,  nullable=True)
    duration_min    = Column(Integer,  nullable=True)
    dep_delay_min   = Column(Integer,  nullable=True)   # raw API departure delay
    arr_delay_min   = Column(Integer,  nullable=True)   # raw API arrival delay

    # ── Categorical encodings (label-encoded) ──────────────────────────────────
    airline_enc     = Column(Integer,  nullable=True)   # integer label
    dep_airport_enc = Column(Integer,  nullable=True)
    arr_airport_enc = Column(Integer,  nullable=True)
    status_enc      = Column(Integer,  nullable=True)   # scheduled=0, delayed=1, ...

    # ── Live GPS at snapshot time ─────────────────────────────────────────────
    latitude        = Column(Float, nullable=True)
    longitude       = Column(Float, nullable=True)
    altitude_ft     = Column(Float, nullable=True)
    speed_kmh       = Column(Float, nullable=True)

    # ── Data quality ─────────────────────────────────────────────────────────
    completeness    = Column(Float, nullable=True)   # 0.0-1.0 fraction of non-null cols
    usable_for_ml   = Column(Boolean, nullable=False, default=True)

    # ── Metadata ─────────────────────────────────────────────────────────────
    created_at      = Column(TIMESTAMP, nullable=False, default=_now)
    updated_at      = Column(TIMESTAMP, nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        Index(
            "idx_ae_dataset_dedup",
            "flight_number", "flight_date", "airport_iata", "direction",
            unique=True,
        ),
        Index("idx_ae_dataset_ml",    "usable_for_ml"),
        Index("idx_ae_dataset_delay", "is_delayed"),
        Index("idx_ae_dataset_date",  "flight_date"),
    )


# ── 3. Sync Log ───────────────────────────────────────────────────────────────

class AESyncLog(Base):
    """
    One row per background sync run. Used for monitoring and debugging.
    """
    __tablename__ = "ae_sync_log"

    id              = Column(Integer,   primary_key=True, autoincrement=True)
    started_at      = Column(TIMESTAMP, nullable=False, default=_now)
    finished_at     = Column(TIMESTAMP, nullable=True)
    airport_iata    = Column(String(3), nullable=False)
    direction       = Column(String(9), nullable=False)

    flights_fetched  = Column(Integer, nullable=False, default=0)
    snapshots_upserted = Column(Integer, nullable=False, default=0)
    dataset_upserted   = Column(Integer, nullable=False, default=0)
    errors           = Column(Integer, nullable=False, default=0)

    status          = Column(String(10), nullable=False, default="running")  # running|ok|error
    error_detail    = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_ae_synclog_airport", "airport_iata"),
        Index("idx_ae_synclog_started", "started_at"),
    )


# ── 4. Future Schedules (prediction-only, NO labels) ──────────────────────────

class AEFutureSchedule(Base):
    """
    Upcoming flights sourced from the Aviation Edge timetable.
    Purpose: prediction input ONLY — this table never contains delay labels.

    Populated by: app/ai/historical_ingestion.py  (fetch_future_schedules)
    Consumed by:  app/ai/future_predictions.py    (predict_future_flights)

    Strict separation rule: data here must NEVER flow into ae_flight_dataset
    or be used for model training.
    """
    __tablename__ = "ae_future_schedules"

    id               = Column(BigInteger, primary_key=True, autoincrement=True)

    # Identity
    flight_number    = Column(String(12), nullable=False, index=True)
    airline_iata     = Column(String(3),  nullable=True,  index=True)
    airline_name     = Column(String(120),nullable=True)

    # Route
    dep_iata         = Column(String(3),  nullable=True,  index=True)
    arr_iata         = Column(String(3),  nullable=True,  index=True)
    dep_airport      = Column(String(120),nullable=True)
    arr_airport      = Column(String(120),nullable=True)

    # Schedule
    scheduled_departure = Column(DateTime, nullable=True, index=True)
    scheduled_arrival   = Column(DateTime, nullable=True)
    flight_date         = Column(Date,     nullable=True, index=True)
    day_of_week         = Column(SmallInteger, nullable=True)   # 0=Mon
    dep_hour            = Column(SmallInteger, nullable=True)   # 0-23

    # Pre-computed features (filled at insert time via feature_engineering.py)
    distance_km      = Column(Integer, nullable=True)
    duration_min     = Column(Integer, nullable=True)
    is_weekend       = Column(SmallInteger, nullable=True, default=0)
    airline_enc      = Column(Integer, nullable=True)
    dep_airport_enc  = Column(Integer, nullable=True)
    arr_airport_enc  = Column(Integer, nullable=True)

    # Prediction output (written after model.predict())
    predicted_delay_min = Column(Integer,  nullable=True)
    confidence          = Column(Float,    nullable=True)
    predicted_at        = Column(TIMESTAMP,nullable=True)
    model_version       = Column(String(40), nullable=True)

    # Metadata
    source           = Column(String(20), nullable=False, default="aviation_edge")
    fetched_at       = Column(TIMESTAMP,  nullable=False, default=_now)
    airport_iata     = Column(String(3),  nullable=True, index=True)  # Tunisian airport queried

    __table_args__ = (
        Index(
            "idx_ae_future_dedup",
            "flight_number", "flight_date", "dep_iata", "arr_iata",
            unique=True,
        ),
        Index("idx_ae_future_dep_date",   "scheduled_departure"),
        Index("idx_ae_future_airline",    "airline_iata"),
        Index("idx_ae_future_predicted",  "predicted_at"),
    )


# ── 5. Aviation Stats (aggregated intelligence from historical data) ───────────

class AEAviationStats(Base):
    """
    Computed statistics from historical flight data.
    One row per (stat_type, entity_key) pair — updated by historical_ingestion.py.

    stat_type values:
      'route'    → entity_key = 'TUN→CDG'  (dep_iata→arr_iata)
      'airline'  → entity_key = 'TU'        (airline IATA)
      'airport'  → entity_key = 'TUN'       (airport IATA)
      'hour'     → entity_key = '14'        (departure hour 0-23)

    This table feeds feature enrichment for both ae_flight_dataset and
    ae_future_schedules without touching the core training logic.
    """
    __tablename__ = "ae_aviation_stats"

    id              = Column(Integer, primary_key=True, autoincrement=True)

    stat_type       = Column(String(20),  nullable=False, index=True)
    entity_key      = Column(String(40),  nullable=False, index=True)

    # Delay statistics
    avg_delay_min   = Column(Float, nullable=True)
    median_delay_min= Column(Float, nullable=True)
    p90_delay_min   = Column(Float, nullable=True)   # 90th-percentile delay
    delay_rate      = Column(Float, nullable=True)   # fraction of flights > 15 min late
    on_time_rate    = Column(Float, nullable=True)   # fraction on time (≤ 15 min)

    # Reliability
    reliability_score = Column(Float, nullable=True)  # 0.0-1.0

    # Volume
    total_flights   = Column(Integer, nullable=True)
    sample_days     = Column(Integer, nullable=True)   # distinct days in the sample

    # Context
    computed_at     = Column(TIMESTAMP, nullable=False, default=_now)
    data_from_date  = Column(Date, nullable=True)
    data_to_date    = Column(Date, nullable=True)

    __table_args__ = (
        Index(
            "idx_ae_stats_dedup",
            "stat_type", "entity_key",
            unique=True,
        ),
        Index("idx_ae_stats_type", "stat_type"),
    )


# ── 6. Model Version Registry ──────────────────────────────────────────────────

class AEModelVersion(Base):
    """
    Immutable registry of every trained model version.
    One row per training run — never deleted, only superseded.

    Promotion rule: is_active may be True for exactly ONE row at a time.
    The promotion controller sets is_active=False on the previous champion
    before setting is_active=True on the challenger (only if it wins).
    """
    __tablename__ = "ae_model_versions"

    id               = Column(Integer,    primary_key=True, autoincrement=True)
    model_version    = Column(String(40), nullable=False, unique=True, index=True)
    trained_at       = Column(TIMESTAMP,  nullable=False, default=_now)
    model_path       = Column(String(300),nullable=True)  # absolute path to .pkl

    # Dataset info at training time
    dataset_size     = Column(Integer, nullable=True)   # total rows
    train_rows       = Column(Integer, nullable=True)
    test_rows        = Column(Integer, nullable=True)
    cutoff_date      = Column(Date,    nullable=True)

    # Model metrics (on held-out test set)
    mae              = Column(Float,   nullable=True)
    rmse             = Column(Float,   nullable=True)
    r2_score         = Column(Float,   nullable=True)

    # Baseline comparison
    baseline_route_mae   = Column(Float, nullable=True)
    baseline_airline_mae = Column(Float, nullable=True)
    improvement_pct      = Column(Float, nullable=True)  # vs best baseline
    better_than_baseline = Column(Boolean, nullable=True, default=False)

    # Promotion
    is_active        = Column(Boolean,   nullable=False, default=False, index=True)
    promoted_at      = Column(TIMESTAMP, nullable=True)
    retired_at       = Column(TIMESTAMP, nullable=True)
    promotion_reason = Column(String(200), nullable=True)
    rejection_reason = Column(String(200), nullable=True)

    # Drift at time of promotion decision
    drift_severity   = Column(String(20), nullable=True)   # none|low|medium|high|critical
    drift_mae_delta  = Column(Float,      nullable=True)   # MAE change vs previous champion

    notes            = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_ae_model_active",  "is_active"),
        Index("idx_ae_model_trained", "trained_at"),
    )


# ── 7. Prediction Logs (long-term monitoring dataset) ─────────────────────────

class AEPredictionLog(Base):
    """
    Every prediction produced by the active model, stored for drift monitoring.

    actual_delay_min is populated later when the flight completes and
    ae_flight_dataset is updated — this is the reconciliation step.
    prediction_error = actual_delay_min - predicted_delay_min (signed).
    """
    __tablename__ = "ae_prediction_logs"

    id                   = Column(BigInteger, primary_key=True, autoincrement=True)

    # Identity
    flight_number        = Column(String(12),  nullable=False, index=True)
    airline_iata         = Column(String(3),   nullable=True,  index=True)
    dep_iata             = Column(String(3),   nullable=True,  index=True)
    arr_iata             = Column(String(3),   nullable=True)
    route                = Column(String(10),  nullable=True,  index=True)  # 'TUN→CDG'

    # Prediction
    predicted_delay_min  = Column(Integer,  nullable=False)
    confidence           = Column(Float,    nullable=True)
    prediction_timestamp = Column(TIMESTAMP,nullable=False, default=_now, index=True)
    model_version        = Column(String(40), nullable=True, index=True)

    # Actuals (backfilled when flight completes)
    actual_delay_min     = Column(Integer,  nullable=True)
    prediction_error     = Column(Float,    nullable=True)  # actual - predicted
    reconciled_at        = Column(TIMESTAMP,nullable=True)

    # Feature snapshot at prediction time (for drift analysis)
    dep_hour             = Column(SmallInteger, nullable=True)
    is_weekend           = Column(SmallInteger, nullable=True)
    distance_km          = Column(Integer,      nullable=True)
    duration_min         = Column(Integer,      nullable=True)
    airline_enc          = Column(Integer,      nullable=True)
    dep_airport_enc      = Column(Integer,      nullable=True)
    arr_airport_enc      = Column(Integer,      nullable=True)

    # Source (future_schedule | real_time | batch)
    prediction_source    = Column(String(20), nullable=True, default="future_schedule")

    __table_args__ = (
        Index("idx_ae_predlog_flight",   "flight_number"),
        Index("idx_ae_predlog_ts",       "prediction_timestamp"),
        Index("idx_ae_predlog_model",    "model_version"),
        Index("idx_ae_predlog_airline",  "airline_iata"),
        Index("idx_ae_predlog_route",    "route"),
        Index("idx_ae_predlog_reconcil", "reconciled_at"),
    )
