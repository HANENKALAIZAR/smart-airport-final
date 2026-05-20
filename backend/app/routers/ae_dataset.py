"""
Aviation Edge Dataset API Router
==================================
Exposes the ingestion pipeline data for admin dashboards and ML tooling.

Endpoints:
  GET  /api/ae-dataset/snapshots      – Query raw snapshots
  GET  /api/ae-dataset/dataset        – Query ML-ready rows
  GET  /api/ae-dataset/sync-logs      – Pipeline sync audit log
  GET  /api/ae-dataset/stats          – Dataset health & counts
  POST /api/ae-dataset/trigger-sync   – Manually trigger a full ingestion run
"""

import logging
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.ae_models import AEFlightSnapshot, AEFlightDataset, AESyncLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ae-dataset", tags=["AE Dataset"])


# ── Pydantic output schemas ───────────────────────────────────────────────────

class SnapshotOut(BaseModel):
    id: int
    flight_number: str
    snapshot_date: date
    collected_at: datetime
    airport_iata: str
    direction: str
    airline_name: Optional[str]
    airline_iata: Optional[str]
    dep_iata: Optional[str]
    arr_iata: Optional[str]
    dep_scheduled: Optional[datetime]
    arr_scheduled: Optional[datetime]
    dep_actual: Optional[datetime]
    arr_actual: Optional[datetime]
    dep_gate: Optional[str]
    arr_gate: Optional[str]
    dep_terminal: Optional[str]
    arr_terminal: Optional[str]
    status: str
    delay_minutes: Optional[int]
    aircraft_type: Optional[str]
    aircraft_reg: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    altitude_ft: Optional[float]
    speed_kmh: Optional[float]

    class Config:
        from_attributes = True


class DatasetRowOut(BaseModel):
    id: int
    flight_number: str
    flight_date: Optional[date]
    airport_iata: str
    direction: str
    airline_iata: Optional[str]
    dep_iata: Optional[str]
    arr_iata: Optional[str]
    is_delayed: int
    delay_minutes: int
    final_status: Optional[str]
    dep_hour: Optional[int]
    dep_day_of_week: Optional[int]
    dep_month: Optional[int]
    is_weekend: int
    is_peak_hour: int
    distance_km: Optional[int]
    duration_min: Optional[int]
    status_enc: Optional[int]
    completeness: Optional[float]
    usable_for_ml: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class SyncLogOut(BaseModel):
    id: int
    started_at: datetime
    finished_at: Optional[datetime]
    airport_iata: str
    direction: str
    flights_fetched: int
    snapshots_upserted: int
    dataset_upserted: int
    errors: int
    status: str
    error_detail: Optional[str]

    class Config:
        from_attributes = True


class DatasetStats(BaseModel):
    total_snapshots: int
    total_dataset_rows: int
    usable_for_ml: int
    total_delayed: int
    delay_rate_pct: float
    last_sync_at: Optional[datetime]
    airports_covered: list[str]
    sync_runs_today: int
    sync_errors_today: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/snapshots", response_model=list[SnapshotOut])
def get_snapshots(
    airport_iata: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    flight_number: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Query raw Aviation Edge snapshots with optional filters."""
    q = db.query(AEFlightSnapshot)
    if airport_iata:
        q = q.filter(AEFlightSnapshot.airport_iata == airport_iata.upper())
    if direction:
        q = q.filter(AEFlightSnapshot.direction == direction)
    if status:
        q = q.filter(AEFlightSnapshot.status == status)
    if flight_number:
        q = q.filter(AEFlightSnapshot.flight_number.ilike(f"%{flight_number}%"))
    if date_from:
        q = q.filter(AEFlightSnapshot.snapshot_date >= date_from)
    if date_to:
        q = q.filter(AEFlightSnapshot.snapshot_date <= date_to)
    return q.order_by(AEFlightSnapshot.collected_at.desc()).offset(skip).limit(limit).all()


@router.get("/dataset", response_model=list[DatasetRowOut])
def get_dataset(
    airport_iata: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    is_delayed: Optional[int] = Query(None),
    usable_only: bool = Query(True),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=5000),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Query the ML-ready preprocessed dataset."""
    q = db.query(AEFlightDataset)
    if airport_iata:
        q = q.filter(AEFlightDataset.airport_iata == airport_iata.upper())
    if direction:
        q = q.filter(AEFlightDataset.direction == direction)
    if is_delayed is not None:
        q = q.filter(AEFlightDataset.is_delayed == is_delayed)
    if usable_only:
        q = q.filter(AEFlightDataset.usable_for_ml == True)
    if date_from:
        q = q.filter(AEFlightDataset.flight_date >= date_from)
    if date_to:
        q = q.filter(AEFlightDataset.flight_date <= date_to)
    return q.order_by(AEFlightDataset.updated_at.desc()).offset(skip).limit(limit).all()


@router.get("/sync-logs", response_model=list[SyncLogOut])
def get_sync_logs(
    airport_iata: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return pipeline sync audit history."""
    q = db.query(AESyncLog)
    if airport_iata:
        q = q.filter(AESyncLog.airport_iata == airport_iata.upper())
    if status:
        q = q.filter(AESyncLog.status == status)
    return q.order_by(AESyncLog.started_at.desc()).limit(limit).all()


@router.get("/stats", response_model=DatasetStats)
def get_dataset_stats(db: Session = Depends(get_db)):
    """Dataset health overview: counts, delay rate, last sync, etc."""
    total_snap = db.query(func.count(AEFlightSnapshot.id)).scalar() or 0
    total_ds   = db.query(func.count(AEFlightDataset.id)).scalar() or 0
    usable     = db.query(func.count(AEFlightDataset.id)).filter(
        AEFlightDataset.usable_for_ml == True
    ).scalar() or 0
    delayed    = db.query(func.count(AEFlightDataset.id)).filter(
        AEFlightDataset.is_delayed == 1,
        AEFlightDataset.usable_for_ml == True,
    ).scalar() or 0

    delay_rate = round((delayed / usable * 100) if usable else 0, 1)

    last_sync = db.query(func.max(AESyncLog.finished_at)).scalar()

    airports = [r[0] for r in db.query(AEFlightSnapshot.airport_iata).distinct().all()]

    today = date.today()
    sync_today = db.query(func.count(AESyncLog.id)).filter(
        func.date(AESyncLog.started_at) == today
    ).scalar() or 0
    err_today = db.query(func.count(AESyncLog.id)).filter(
        func.date(AESyncLog.started_at) == today,
        AESyncLog.status == "error",
    ).scalar() or 0

    return DatasetStats(
        total_snapshots=total_snap,
        total_dataset_rows=total_ds,
        usable_for_ml=usable,
        total_delayed=delayed,
        delay_rate_pct=delay_rate,
        last_sync_at=last_sync,
        airports_covered=airports,
        sync_runs_today=sync_today,
        sync_errors_today=err_today,
    )


@router.post("/trigger-sync")
async def trigger_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Manually fire a full ingestion run (admin use)."""
    async def _run():
        from app.services.ae_ingestion_service import run_full_ingestion
        from app.database import SessionLocal
        _db = SessionLocal()
        try:
            result = await run_full_ingestion(_db)
            logger.info(f"[Manual Sync] {result}")
        except Exception as e:
            logger.error(f"[Manual Sync] Failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_run)
    return {"message": "Ingestion sync triggered", "status": "running"}


# ── ML Feature Engineering Endpoints ─────────────────────────────────────────

@router.post("/rebuild-features")
def rebuild_features(background_tasks: BackgroundTasks):
    """
    One-shot ML feature stabilization for ae_flight_dataset.

    Applies feature_engineering.py to ALL existing rows:
      - Computes distance_km (Haversine + median fallback)
      - Derives duration_min where missing
      - Fits + persists LabelEncoders for airline, dep_airport, arr_airport
      - Writes airline_enc, dep_airport_enc, arr_airport_enc back to DB
      - Runs dataset health validation and logs the report

    Safe to run multiple times — encoders are extended, never refit.
    Check backend logs for the health report after completion.
    """
    def _rebuild_task():
        from app.database import SessionLocal
        from app.ml.rebuild_dataset import rebuild_ae_dataset
        _db = SessionLocal()
        try:
            result = rebuild_ae_dataset(_db, validate=True)
            logger.info(
                f"[FE Rebuild] Done: processed={result['processed']} "
                f"skipped={result['skipped']} errors={result['errors']} "
                f"ready={result.get('health_report', {}).get('ready', 'n/a')}"
            )
        except Exception as e:
            logger.exception(f"[FE Rebuild] Failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_rebuild_task)
    return {
        "message": "Feature engineering rebuild triggered",
        "status":  "running",
        "note":    "Monitor backend logs for the health report.",
    }


@router.get("/health")
def dataset_health(db: Session = Depends(get_db)):
    """
    Live ML-readiness check for ae_flight_dataset.

    Runs feature engineering on all usable rows and returns the health report.
    Does NOT modify any data.

    Returns 200 if ready, 422 if blocking issues remain.
    """
    from fastapi import HTTPException
    from app.ml.feature_engineering import apply_feature_engineering, validate_dataset_health

    usable_rows = (
        db.query(AEFlightDataset)
        .filter(AEFlightDataset.usable_for_ml == True)
        .all()
    )

    if not usable_rows:
        raise HTTPException(
            status_code=404,
            detail="No usable rows in ae_flight_dataset — run ingestion first.",
        )

    processed = apply_feature_engineering(usable_rows)

    try:
        report = validate_dataset_health(processed, print_report=False)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return report


@router.post("/historical-backfill")
def historical_backfill(
    background_tasks: BackgroundTasks,
    days: int = Query(90, ge=7, le=365, description="Calendar days to backfill"),
    target_min: int = Query(5000, ge=500, le=50000, description="Minimum dataset target"),
    daily_cap: int = Query(120, ge=10, le=500, description="Max augmented rows per day"),
):
    """
    [DEPRECATED — DO NOT USE in production]

    This endpoint generated statistically-augmented rows tagged as
    data_source='augmented_training'. It was used during the early dataset
    bootstrapping phase when real data was insufficient.

    The ae_flight_dataset now contains 7,616+ real Aviation Edge rows.
    The production XGBoost model (train_ae_dataset.py) filters to ONLY
    data_source='aviation_edge' rows and will NEVER train on augmented data.

    This endpoint is retained for reference only and returns a 405 error
    to prevent accidental activation.
    """
    raise HTTPException(
        status_code=405,
        detail=(
            "Historical synthetic backfill is disabled. "
            "The production dataset now contains 7,616+ real Aviation Edge flights. "
            "Use GET /api/ae/dataset/stats to inspect the current dataset."
        ),
    )


@router.post("/fix-incomplete")
def fix_incomplete(background_tasks: BackgroundTasks):
    """
    Fix the 260 rows in ae_flight_dataset that are missing dep_hour, distance_km,
    or airline_enc. Recalculates distance_km from known coordinates, and marks rows
    without dep_hour as unusable for ML.

    Safe to run multiple times. Runs as a background task.
    """
    def _fix_task():
        from app.database import SessionLocal
        from app.ai.historical_backfill import fix_incomplete_rows
        _db = SessionLocal()
        try:
            result = fix_incomplete_rows(_db)
            logger.info(f"[Fix Incomplete API] {result}")
        except Exception as e:
            logger.exception(f"[Fix Incomplete API] Failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_fix_task)
    return {"message": "Fix incomplete rows triggered", "status": "running"}

