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
