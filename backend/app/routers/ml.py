"""
ML Management Router (v10)
===========================
REST endpoints for model training, metrics, batch predictions,
feature pipeline management, and scheduler status.

All endpoints require admin JWT. Training requires super_admin.
"""

import logging
from datetime import datetime, timezone
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


# ── AE Dataset Training (production-grade, no leakage) ───────────────────

@router.post("/train-ae")
def trigger_ae_training(
    background_tasks: BackgroundTasks,
    notes: str = Query(default="", description="Optional notes for this training run"),
    _user: User = Depends(require_super_admin),
):
    """
    Train a flight delay regression model from ae_flight_dataset.

    Pipeline:
      1. Load ae_flight_dataset (usable rows only, already FE-processed)
      2. Leakage guard — blocks if forbidden columns detected
      3. Time-based split (older → train, newer → test)
      4. Compute baselines: route-mean and airline-mean delay
      5. Train XGBoost regressor via sklearn Pipeline
      6. Evaluate: MAE, RMSE, R², per-airline error, per-route error
      7. Real-world validation sample (100 test flights with predicted vs actual)
      8. Model verdict: better than baseline? recommend deploy/retrain/improve
      9. Save model → app/ai/model/delay_prediction_model.pkl
     10. Save JSON report → app/ai/model/ae_evaluation_report.json

    Check GET /api/ml/train-ae/report for results after completion.
    Requires super_admin JWT.
    """
    def _task():
        from app.database import SessionLocal
        from app.ai.train_ae_dataset import train_ae_model
        db2 = SessionLocal()
        try:
            result = train_ae_model(db2, notes=notes)
            logger.info(
                f"[AE Train] status={result.get('status')} "
                f"version={result.get('version', '')} "
                f"mae={result.get('metrics', {}).get('mae', 'n/a')}"
            )
        except Exception as e:
            logger.exception(f"[AE Train] Failed: {e}")
        finally:
            db2.close()

    background_tasks.add_task(_task)
    return {
        "status":       "training_started",
        "message":      "AE training job queued. Check GET /api/ml/train-ae/report for results.",
        "triggered_by": _user.email,
        "note":         "Run POST /api/ae-dataset/rebuild-features first if encodings are stale.",
    }


@router.get("/train-ae/report")
def get_ae_report(_user: User = Depends(require_admin)):
    """
    Return the latest AE training evaluation report.

    Contains: metrics, baseline comparison, verdict, per-airline/route error
    breakdown, error histogram, and 100-row sample of predicted vs actual delays.
    """
    import json
    from pathlib import Path
    report_path = Path(__file__).resolve().parents[2] / "ai" / "model" / "ae_evaluation_report.json"
    if not report_path.exists():
        raise HTTPException(
            status_code=404,
            detail="No AE evaluation report found. Run POST /api/ml/train-ae first.",
        )
    try:
        return json.loads(report_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read report: {e}")


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


# ══════════════════════════════════════════════════════════════════════════════
# MLOps Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/models")
def get_model_versions(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """AE model version history — all training runs, newest first."""
    from app.models.ae_models import AEModelVersion
    rows = (
        db.query(AEModelVersion)
        .order_by(AEModelVersion.trained_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "model_version":        r.model_version,
            "trained_at":           str(r.trained_at),
            "is_active":            r.is_active,
            "mae":                  r.mae,
            "rmse":                 r.rmse,
            "r2_score":             r.r2_score,
            "dataset_size":         r.dataset_size,
            "better_than_baseline": r.better_than_baseline,
            "improvement_pct":      r.improvement_pct,
            "drift_severity":       r.drift_severity,
            "promotion_reason":     r.promotion_reason,
            "rejection_reason":     r.rejection_reason,
            "promoted_at":          str(r.promoted_at) if r.promoted_at else None,
            "retired_at":           str(r.retired_at)  if r.retired_at  else None,
            "model_path":           r.model_path,
        }
        for r in rows
    ]


@router.get("/drift-status")
def get_drift_status(
    window_days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Live drift report for the active model.
    Checks: MAE drift, distribution shift, route drift, airline drift, volume drop.
    """
    from app.ai.drift_detection import compute_drift_report
    return compute_drift_report(db, window_days=window_days)


@router.get("/prediction-health")
def get_prediction_health(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Live prediction accuracy trends from ae_prediction_logs.
    Shows rolling MAE, reconciliation rate, and error distribution.
    """
    from app.models.ae_models import AEPredictionLog
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    logs = (
        db.query(AEPredictionLog)
        .filter(AEPredictionLog.prediction_timestamp >= cutoff)
        .all()
    )
    reconciled = [l for l in logs if l.prediction_error is not None]
    abs_errors  = [abs(l.prediction_error) for l in reconciled]

    live_mae = round(sum(abs_errors) / len(abs_errors), 2) if abs_errors else None
    bias      = round(sum(l.prediction_error for l in reconciled) / len(reconciled), 2) if reconciled else None

    # Error buckets
    buckets = {"0-5": 0, "5-15": 0, "15-30": 0, "30-60": 0, "60+": 0}
    for e in abs_errors:
        if   e <  5:  buckets["0-5"]   += 1
        elif e < 15:  buckets["5-15"]  += 1
        elif e < 30:  buckets["15-30"] += 1
        elif e < 60:  buckets["30-60"] += 1
        else:         buckets["60+"]   += 1

    # Per-airline breakdown
    by_airline: dict = {}
    for l in reconciled:
        al = l.airline_iata or "UNK"
        by_airline.setdefault(al, []).append(abs(l.prediction_error))
    airline_breakdown = sorted(
        [{"airline": k, "n": len(v), "mae": round(sum(v)/len(v), 2)} for k, v in by_airline.items()],
        key=lambda x: x["mae"], reverse=True
    )[:10]

    return {
        "period_days":          days,
        "total_predictions":    len(logs),
        "reconciled":           len(reconciled),
        "reconciliation_rate":  round(len(reconciled) / max(len(logs), 1) * 100, 1),
        "live_mae":             live_mae,
        "bias":                 bias,
        "error_distribution":   buckets,
        "airline_breakdown":    airline_breakdown,
    }


@router.get("/retraining-status")
def get_retraining_status(
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """Check retraining policy — returns whether a retrain is needed and why."""
    from app.ai.mlops_controller import check_retraining_policy
    return check_retraining_policy(db)


@router.post("/promote")
def promote_model_version(
    version: str = Query(..., description="Model version string to promote"),
    force: bool = Query(False, description="Force promotion (skip gates) — use with care"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_super_admin),
):
    """
    Manually promote a specific model version to active champion.
    Runs all promotion gates unless force=True.
    Requires super_admin.
    """
    from app.ai.mlops_controller import promote_model
    result = promote_model(db, version, force=force)
    if not result["promoted"] and not force:
        raise HTTPException(status_code=409, detail=result)
    return result


@router.post("/reconcile")
def trigger_reconciliation(
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_admin),
):
    """
    Backfill actual delays into ae_prediction_logs by cross-referencing
    ae_flight_dataset. Run after new flights land and dataset is updated.
    """
    def _task():
        from app.database import SessionLocal
        from app.ai.mlops_controller import reconcile_predictions
        _db = SessionLocal()
        try:
            r = reconcile_predictions(_db)
            logger.info(f"[MLOps] Reconcile done: {r}")
        except Exception as e:
            logger.exception(f"[MLOps] Reconcile failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_task)
    return {"status": "started", "message": "Prediction reconciliation queued."}


@router.post("/auto-retrain")
def trigger_auto_retrain(
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_super_admin),
):
    """
    Run the full automatic retraining policy check.
    If policy says retrain: trains → registers → promotes (safe gates apply).
    Existing active model is only replaced if challenger wins all gates.
    Requires super_admin.
    """
    def _task():
        from app.database import SessionLocal
        from app.ai.mlops_controller import run_auto_retrain
        _db = SessionLocal()
        try:
            result = run_auto_retrain(_db)
            logger.info(f"[MLOps] auto-retrain done: triggered={result['triggered']}")
        except Exception as e:
            logger.exception(f"[MLOps] auto-retrain failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_task)
    return {"status": "started", "message": "Auto-retrain policy check queued."}


@router.get("/dashboard")
def get_mlops_dashboard(
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Admin dashboard metrics for the ML system.
    Returns: current MAE, active version, prediction count, drift severity,
    retrain recommendation, model age, R², improvement vs baseline.
    """
    from app.ai.mlops_controller import get_dashboard_metrics
    return get_dashboard_metrics(db)
