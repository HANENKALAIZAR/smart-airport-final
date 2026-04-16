"""
ML Management Router (v10)
===========================
REST endpoints for model training, metrics, batch predictions,
feature pipeline management, and scheduler status.

All endpoints require admin JWT. Training requires super_admin.
"""

import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.dependencies import require_admin, require_super_admin
from app.models.models import User
from app.services.data_cleaner import run_data_cleaner
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["ML"])


# ── Training ──────────────────────────────────────────────────────────────

@router.post("/train")
def trigger_training(
    background_tasks: BackgroundTasks,
    notes: str = Query(default="", description="Optional notes for this training run"),
    _user: User = Depends(require_super_admin),
):
    """
    Trigger a full model training run as a background task.
    Requires super_admin JWT.

    The job: loads flight_features from DB → time-based split →
    trains XGBoost classifier + regressor → builds SHAP explainer →
    archives old model → saves new artifacts → writes model_metrics row →
    hot-reloads prediction service.
    """
    def _train_task():
        from app.database import SessionLocal
        from app.ai.train_from_db import train_from_db
        db2 = SessionLocal()
        try:
            result = train_from_db(db2, notes=notes)
            logger.info(f"Background training result: {result.get('status')} — {result.get('version', '')}")
        except Exception as e:
            logger.exception(f"Background training failed: {e}")
        finally:
            db2.close()

    background_tasks.add_task(_train_task)
    return {
        "status":  "training_started",
        "message": "Training job queued. Check GET /api/ml/metrics for results.",
        "triggered_by": _user.email,
    }


# ── Metrics ───────────────────────────────────────────────────────────────

@router.get("/metrics")
def get_all_metrics(
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """Return all model versions, newest first."""
    from app.models.models import ModelMetrics
    rows = (
        db.query(ModelMetrics)
        .order_by(ModelMetrics.trained_at.desc())
        .all()
    )
    return [_row_to_dict(r) for r in rows]


@router.get("/metrics/active")
def get_active_metrics(
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """Return the currently active (loaded) model's metrics."""
    from app.models.models import ModelMetrics
    row = db.query(ModelMetrics).filter(ModelMetrics.is_active == 1).first()
    if not row:
        raise HTTPException(status_code=404, detail="No active model metrics found")
    return _row_to_dict(row)


# ── Scheduler ─────────────────────────────────────────────────────────────

@router.get("/scheduler-status")
def get_scheduler_status(
    _user: User = Depends(require_admin),
):
    """Return APScheduler job list with next-run timestamps."""
    try:
        from app.scheduler import get_scheduler_status
        return {"jobs": get_scheduler_status()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scheduler error: {e}")


# ── Batch predictions ─────────────────────────────────────────────────────

@router.post("/predict-batch")
def trigger_batch_predictions(
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_admin),
):
    """
    Manually trigger batch predictions for all flights in the next 24h
    that have features but no recent prediction (last hour).
    """
    def _batch_task():
        from app.database import SessionLocal
        from app.services.prediction_service import run_batch_predictions
        db2 = SessionLocal()
        try:
            count = run_batch_predictions(db2)
            logger.info(f"Manual batch predictions: {count} generated")
        except Exception as e:
            logger.exception(f"Batch prediction task failed: {e}")
        finally:
            db2.close()

    background_tasks.add_task(_batch_task)
    return {"status": "batch_started", "message": "Batch prediction job queued."}


# ── Feature pipeline ──────────────────────────────────────────────────────

@router.post("/run-features")
def trigger_feature_pipeline(
    background_tasks: BackgroundTasks,
    batch_size: int = Query(default=500, ge=1, le=5000),
    _user: User = Depends(require_admin),
):
    """
    Manually trigger the feature engineering pipeline.
    Processes flights that don't have up-to-date (v2) features yet.
    """
    def _feature_task():
        from app.database import SessionLocal
        from app.services.feature_pipeline import run_feature_pipeline
        db2 = SessionLocal()
        try:
            stats = run_feature_pipeline(db2, batch_size=batch_size)
            logger.info(f"Manual feature pipeline: {stats}")
        except Exception as e:
            logger.exception(f"Feature pipeline task failed: {e}")
        finally:
            db2.close()

    background_tasks.add_task(_feature_task)
    return {"status": "pipeline_started", "batch_size": batch_size}


# ── Weather collection ────────────────────────────────────────────────────

@router.post("/collect-weather")
def trigger_weather_collection(
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_admin),
):
    """Manually trigger a weather collection run for all airports."""
    from app.routers.aviationstack import AIRPORTS

    async def _weather_task():
        from app.database import SessionLocal
        from app.api_clients.weather_client import fetch_and_store_weather
        db2 = SessionLocal()
        try:
            for iata in AIRPORTS.keys():
                await fetch_and_store_weather(iata, db2)
        except Exception as e:
            logger.exception(f"Manual weather collection failed: {e}")
        finally:
            db2.close()

    import asyncio
    def _run():
        asyncio.run(_weather_task())

    background_tasks.add_task(_run)
    return {"status": "weather_collection_started"}


# ── Data quality ────────────────────────────────────────────────────────────

@router.get("/data-quality")
def check_data_quality(
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Executes the strict data cleaner and returns detailed metrics on
    outliers, duplicates, and physical limits, confirming training readiness.
    Now includes reliability scoring metrics (v11).
    """
    from app.models.models import FlightFeature
    metrics = run_data_cleaner(db)
    
    high_conf = db.query(func.count(FlightFeature.id)).filter(
        FlightFeature.confidence_score >= 0.6
    ).scalar() or 0
    
    low_conf = db.query(func.count(FlightFeature.id)).filter(
        FlightFeature.confidence_score < 0.6
    ).scalar() or 0

    ready = high_conf >= 300
    
    return {
        "status": "cleaning_completed",
        "total_flights_processed": metrics["total_flights_before"],
        "valid_flights": metrics["total_valid_flights_after"],
        "high_confidence_flights": high_conf,
        "low_confidence_flights": low_conf,
        "invalid_flights_removed": metrics["invalid_flights_removed"],
        "duplicate_flights_removed": metrics["duplicate_flights_removed"],
        "airlines_mapped": metrics["airlines_mapped_to_other"],
        "suspicious_routes_removed": metrics["suspicious_routes_removed"],
        "batch_outliers_removed": metrics["batch_outliers_removed"],
        "ready_for_training": ready
    }


# ── Data summary ──────────────────────────────────────────────────────────

@router.get("/data-summary")
def get_data_summary(
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Quick summary of the training dataset state:
    flight count, labelled features, delay rate, weather coverage.
    """
    from app.models.models import Flight, FlightFeature, WeatherCondition

    total_flights    = db.query(func.count(Flight.id)).scalar() or 0
    labelled_feats   = db.query(func.count(FlightFeature.id)).filter(
        FlightFeature.is_delayed.isnot(None)
    ).scalar() or 0
    v2_feats         = db.query(func.count(FlightFeature.id)).filter(
        FlightFeature.feature_version == "v2"
    ).scalar() or 0
    delayed_feats    = db.query(func.count(FlightFeature.id)).filter(
        FlightFeature.is_delayed == 1
    ).scalar() or 0
    weather_records  = db.query(func.count(WeatherCondition.id)).scalar() or 0
    delay_rate       = round(delayed_feats / labelled_feats * 100, 1) if labelled_feats > 0 else 0

    from app.config import settings
    ready_to_train = labelled_feats >= settings.MIN_TRAIN_SAMPLES

    return {
        "total_flights":        total_flights,
        "labelled_features":    labelled_feats,
        "v2_features":          v2_feats,
        "delayed_features":     delayed_feats,
        "delay_rate_pct":       delay_rate,
        "weather_records":      weather_records,
        "min_train_samples":    settings.MIN_TRAIN_SAMPLES,
        "ready_to_train":       ready_to_train,
    }


# ── Helper ────────────────────────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    return {
        "id":                row.id,
        "model_version":     row.model_version,
        "trained_at":        row.trained_at.isoformat() if row.trained_at else None,
        "n_train_samples":   row.n_train_samples,
        "n_test_samples":    row.n_test_samples,
        "train_cutoff_date": row.train_cutoff_date.isoformat() if row.train_cutoff_date else None,
        "accuracy":          float(row.accuracy)        if row.accuracy        is not None else None,
        "precision_score":   float(row.precision_score) if row.precision_score is not None else None,
        "recall":            float(row.recall)          if row.recall          is not None else None,
        "f1":                float(row.f1)              if row.f1              is not None else None,
        "roc_auc":           float(row.roc_auc)         if row.roc_auc         is not None else None,
        "mae_minutes":       float(row.mae_minutes)     if row.mae_minutes     is not None else None,
        "rmse_minutes":      float(row.rmse_minutes)    if row.rmse_minutes    is not None else None,
        "r2_score":          float(row.r2_score)        if row.r2_score        is not None else None,
        "feature_columns":   row.feature_columns,
        "hyperparams":       row.hyperparams,
        "notes":             row.notes,
        "is_active":         row.is_active,
    }
