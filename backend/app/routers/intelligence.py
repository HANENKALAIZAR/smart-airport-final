"""
Aviation Intelligence API Router
=================================
Exposes the historical + future prediction intelligence layer.

Endpoints
---------
  POST /api/intelligence/fetch-future      – Pull future timetable → ae_future_schedules
  POST /api/intelligence/compute-stats     – Aggregate historical stats → ae_aviation_stats
  POST /api/intelligence/predict-future    – Run model on ae_future_schedules
  POST /api/intelligence/run-all           – Steps 1 + 2 + 3 in sequence
  GET  /api/intelligence/future-schedules  – Query upcoming predicted flights
  GET  /api/intelligence/stats             – Query ae_aviation_stats
  GET  /api/intelligence/route-predictions – Predictions for a specific route
  GET  /api/intelligence/validate          – Full system validation report
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin, require_super_admin
from app.models.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/intelligence", tags=["Intelligence"])


# ── Triggers (background tasks) ───────────────────────────────────────────────

@router.post("/fetch-future")
def trigger_fetch_future(
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_admin),
):
    """
    Fetch Aviation Edge timetable for all Tunisian airports and upsert into
    ae_future_schedules with pre-computed ML features.
    Does NOT touch ae_flight_dataset or the training pipeline.
    """
    def _task():
        import asyncio
        from app.database import SessionLocal
        from app.ai.historical_ingestion import fetch_future_schedules
        _db = SessionLocal()
        try:
            result = asyncio.run(fetch_future_schedules(_db))
            logger.info(f"[Intelligence] fetch-future done: {result}")
        except Exception as e:
            logger.exception(f"[Intelligence] fetch-future failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_task)
    return {"status": "started", "message": "Future schedule fetch queued."}


@router.post("/compute-stats")
def trigger_compute_stats(
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_admin),
):
    """
    Aggregate ae_flight_dataset into ae_aviation_stats (route / airline /
    airport / hour delay statistics). Safe — read-only on ae_flight_dataset.
    """
    def _task():
        from app.database import SessionLocal
        from app.ai.historical_ingestion import compute_aviation_stats
        _db = SessionLocal()
        try:
            result = compute_aviation_stats(_db)
            logger.info(f"[Intelligence] compute-stats done: {result}")
        except Exception as e:
            logger.exception(f"[Intelligence] compute-stats failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_task)
    return {"status": "started", "message": "Aviation stats computation queued."}


@router.post("/predict-future")
def trigger_predict_future(
    background_tasks: BackgroundTasks,
    horizon_hours: int = Query(default=72, ge=1, le=168),
    _user: User = Depends(require_admin),
):
    """
    Run delay_prediction_model.pkl over all unpredicted ae_future_schedules
    rows in the next `horizon_hours` hours.
    Requires POST /api/ml/train-ae to have completed first.
    """
    def _task():
        from app.database import SessionLocal
        from app.ai.future_predictions import predict_future_flights
        _db = SessionLocal()
        try:
            result = predict_future_flights(_db, horizon_hours=horizon_hours)
            logger.info(f"[Intelligence] predict-future done: {result}")
        except Exception as e:
            logger.exception(f"[Intelligence] predict-future failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_task)
    return {
        "status": "started",
        "message": f"Future flight predictions queued (next {horizon_hours}h).",
    }


@router.post("/run-all")
def trigger_run_all(
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_super_admin),
):
    """
    Full intelligence pipeline:
      1. Fetch future timetable → ae_future_schedules
      2. Compute aviation stats → ae_aviation_stats
      3. Predict delays on ae_future_schedules

    Requires super_admin JWT.
    """
    def _task():
        import asyncio
        from app.database import SessionLocal
        from app.ai.historical_ingestion import run_full_intelligence_pipeline
        from app.ai.future_predictions import predict_future_flights
        _db = SessionLocal()
        try:
            pipeline_result = asyncio.run(run_full_intelligence_pipeline(_db))
            pred_result = predict_future_flights(_db, horizon_hours=72)
            logger.info(
                f"[Intelligence] run-all done: pipeline={pipeline_result} "
                f"predictions={pred_result}"
            )
        except Exception as e:
            logger.exception(f"[Intelligence] run-all failed: {e}")
        finally:
            _db.close()

    background_tasks.add_task(_task)
    return {
        "status": "started",
        "message": "Full intelligence pipeline queued (fetch → stats → predict).",
    }


# ── Read endpoints ────────────────────────────────────────────────────────────

@router.get("/future-schedules")
def get_future_schedules(
    dep_iata:      Optional[str] = Query(None),
    arr_iata:      Optional[str] = Query(None),
    airline_iata:  Optional[str] = Query(None),
    airport_iata:  Optional[str] = Query(None),
    predicted_only: bool = Query(False),
    limit:  int = Query(100, ge=1, le=1000),
    skip:   int = Query(0,   ge=0),
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Query ae_future_schedules with optional filters.
    Returns upcoming flights with predicted delay where available.
    """
    from app.models.ae_models import AEFutureSchedule
    q = db.query(AEFutureSchedule)
    if dep_iata:
        q = q.filter(AEFutureSchedule.dep_iata == dep_iata.upper())
    if arr_iata:
        q = q.filter(AEFutureSchedule.arr_iata == arr_iata.upper())
    if airline_iata:
        q = q.filter(AEFutureSchedule.airline_iata == airline_iata.upper())
    if airport_iata:
        q = q.filter(AEFutureSchedule.airport_iata == airport_iata.upper())
    if predicted_only:
        q = q.filter(AEFutureSchedule.predicted_at.isnot(None))
    rows = (
        q.order_by(AEFutureSchedule.scheduled_departure.asc())
        .offset(skip).limit(limit).all()
    )
    return [
        {
            "id":               r.id,
            "flight_number":    r.flight_number,
            "airline_iata":     r.airline_iata,
            "dep_iata":         r.dep_iata,
            "arr_iata":         r.arr_iata,
            "scheduled_departure": str(r.scheduled_departure) if r.scheduled_departure else None,
            "scheduled_arrival":   str(r.scheduled_arrival)   if r.scheduled_arrival   else None,
            "dep_hour":         r.dep_hour,
            "is_weekend":       r.is_weekend,
            "distance_km":      r.distance_km,
            "duration_min":     r.duration_min,
            "predicted_delay_min": r.predicted_delay_min,
            "confidence":       r.confidence,
            "predicted_at":     str(r.predicted_at) if r.predicted_at else None,
        }
        for r in rows
    ]


@router.get("/stats")
def get_aviation_stats(
    stat_type:  Optional[str] = Query(None, description="route | airline | airport | hour"),
    entity_key: Optional[str] = Query(None),
    limit:  int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Query ae_aviation_stats — route/airline/airport/hour delay intelligence.
    """
    from app.models.ae_models import AEAviationStats
    q = db.query(AEAviationStats)
    if stat_type:
        q = q.filter(AEAviationStats.stat_type == stat_type)
    if entity_key:
        q = q.filter(AEAviationStats.entity_key == entity_key)
    rows = q.order_by(AEAviationStats.total_flights.desc()).limit(limit).all()
    return [
        {
            "stat_type":       r.stat_type,
            "entity_key":      r.entity_key,
            "avg_delay_min":   r.avg_delay_min,
            "median_delay_min":r.median_delay_min,
            "p90_delay_min":   r.p90_delay_min,
            "delay_rate":      r.delay_rate,
            "on_time_rate":    r.on_time_rate,
            "reliability_score": r.reliability_score,
            "total_flights":   r.total_flights,
            "sample_days":     r.sample_days,
            "computed_at":     str(r.computed_at),
        }
        for r in rows
    ]


@router.get("/route-predictions")
def get_route_predictions(
    dep_iata: str = Query(..., description="Departure IATA e.g. TUN"),
    arr_iata: str = Query(..., description="Arrival IATA e.g. CDG"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Latest predicted future flights for a specific route.
    Returns: flight_number, predicted_delay, confidence, scheduled_departure.
    """
    from app.ai.future_predictions import get_predictions_for_route
    results = get_predictions_for_route(db, dep_iata, arr_iata, limit=limit)
    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No predictions found for route {dep_iata}→{arr_iata}. "
                   "Run POST /api/intelligence/run-all first.",
        )
    return results


@router.get("/stats/flight")
def get_stats_for_flight(
    dep_iata:     Optional[str] = Query(None),
    arr_iata:     Optional[str] = Query(None),
    airline_iata: Optional[str] = Query(None),
    dep_hour:     Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Retrieve context-aware delay stats for a specific flight context.
    Returns: route_avg_delay, airline_reliability, hour_delay_rate.
    """
    from app.ai.historical_ingestion import get_stats_for_flight
    return get_stats_for_flight(db, dep_iata, arr_iata, airline_iata, dep_hour)


@router.get("/validate")
def validate_system(
    db: Session = Depends(get_db),
    _user: User = Depends(require_super_admin),
):
    """
    Run the full end-to-end system validation and return a structured report.

    Checks:
      • Feature consistency (train == inference == FE output)
      • No leakage columns in feature set
      • Model artifact exists and loads
      • Encoder files exist
      • Evaluation report correctness (time-split, leakage field, metric ranges)
      • API route presence
      • DB integrity (nulls, duplicates, value ranges)
      • Intelligence layer value validity
      • Prediction simulation on 10 future flights

    Response fields:
      overall_status    : READY | PARTIALLY_READY | BROKEN
      ml_reliability    : trustworthy | unstable | invalid | not evaluated
      critical_failures : list of blocking issues
      checks_passed/failed : summary counts
      all_checks        : granular check-by-check results
      verdict           : human-readable summary

    Requires super_admin JWT.
    """
    from app.ai.system_validator import run_full_validation
    try:
        report = run_full_validation(db)
        # Return 422 if system is BROKEN so callers can detect it programmatically
        if report["overall_status"] == "BROKEN":
            raise HTTPException(status_code=422, detail=report)
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed unexpectedly: {e}")
