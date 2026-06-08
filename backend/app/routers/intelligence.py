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


@router.get("/airport-kpis")
def get_airport_kpis(
    airport_iata: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Per-airport KPIs derived from ae_aviation_stats + ae_future_schedules.
    Returns one row per Tunisian airport with real stats: on_time_rate,
    avg_delay_min, total_flights, reliability_score, upcoming_predictions.
    No mock data — all values come from ae_aviation_stats.
    """
    from app.models.ae_models import AEAviationStats, AEFutureSchedule
    from sqlalchemy import func

    if airport_iata:
        airport_iata = airport_iata.upper()
        if _user.role != "super_admin" and _user.airport_iata and airport_iata != _user.airport_iata.upper():
            raise HTTPException(status_code=403, detail="Not authorized to access other airports.")

    TUNISIAN_AIRPORTS = {
        "TUN": "Tunis-Carthage",
        "MIR": "Monastir",
        "DJE": "Djerba-Zarzis",
        "NBE": "Enfidha-Hammamet",
    }

    # Load all airport stats in one query
    airport_stats = {
        r.entity_key: r
        for r in db.query(AEAviationStats)
            .filter(AEAviationStats.stat_type == "airport")
            .all()
    }

    # Count upcoming predicted flights per departure airport
    future_counts = dict(
        db.query(AEFutureSchedule.dep_iata, func.count(AEFutureSchedule.id))
        .filter(AEFutureSchedule.predicted_at.isnot(None))
        .group_by(AEFutureSchedule.dep_iata)
        .all()
    )

    # Average predicted delay per airport
    future_delays = dict(
        db.query(
            AEFutureSchedule.dep_iata,
            func.avg(AEFutureSchedule.predicted_delay_min)
        )
        .filter(AEFutureSchedule.predicted_at.isnot(None))
        .group_by(AEFutureSchedule.dep_iata)
        .all()
    )

    result = []
    for iata, name in TUNISIAN_AIRPORTS.items():
        if _user.role != "super_admin" and _user.airport_iata and iata != _user.airport_iata:
            continue
        if airport_iata and iata != airport_iata:
            continue
        s = airport_stats.get(iata)
        on_time_rate   = float(s.on_time_rate)   if s and s.on_time_rate   is not None else None
        avg_delay      = float(s.avg_delay_min)   if s and s.avg_delay_min  is not None else None
        total_flights  = int(s.total_flights)     if s and s.total_flights  is not None else 0
        reliability    = float(s.reliability_score) if s and s.reliability_score is not None else None
        delay_rate     = float(s.delay_rate)      if s and s.delay_rate     is not None else None

        # Risk level: derived from on_time_rate (no fake values)
        if on_time_rate is None:
            risk = "Unknown"
        elif on_time_rate >= 0.80:
            risk = "Low"
        elif on_time_rate >= 0.60:
            risk = "Medium"
        else:
            risk = "High"

        result.append({
            "iata":                   iata,
            "name":                   name,
            "on_time_rate":           round(on_time_rate * 100, 1) if on_time_rate is not None else None,
            "avg_delay_min":          round(avg_delay, 1) if avg_delay is not None else None,
            "total_historical_flights": total_flights,
            "reliability_score":      round(reliability, 3) if reliability is not None else None,
            "delay_rate":             round(delay_rate * 100, 1) if delay_rate is not None else None,
            "risk_level":             risk,
            "upcoming_predicted_flights": future_counts.get(iata, 0),
            "upcoming_avg_predicted_delay": round(float(future_delays[iata]), 1)
                if iata in future_delays and future_delays[iata] is not None else None,
            "has_data":               s is not None,
        })

    # Global summary
    total_all = sum(r["total_historical_flights"] for r in result)
    on_time_vals = [r["on_time_rate"] for r in result if r["on_time_rate"] is not None]
    global_otp = round(sum(on_time_vals) / len(on_time_vals), 1) if on_time_vals else None
    high_risk = sum(1 for r in result if r["risk_level"] == "High")

    return {
        "airports": result,
        "global": {
            "total_airports_with_data": sum(1 for r in result if r["has_data"]),
            "total_historical_flights": total_all,
            "global_on_time_rate":      global_otp,
            "high_risk_airports":       high_risk,
        },
    }


@router.get("/flight-predict/{schedule_id}")
def predict_single_future_flight(
    schedule_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Run real model inference for one ae_future_schedules row (by id).
    Returns: flight details + real ML prediction + route/airline stats.
    Uses delay_prediction_model.pkl — no mocks.
    """
    from app.models.ae_models import AEFutureSchedule
    from app.ai.future_predictions import _load_model, _row_to_vector, _confidence, _detect_feature_columns
    from app.ai.historical_ingestion import get_stats_for_flight
    from app.services.prediction_service import _compute_real_shap
    import numpy as np

    row = db.query(AEFutureSchedule).filter(AEFutureSchedule.id == schedule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Future schedule id={schedule_id} not found")

    model, model_path = _load_model()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="ML model not yet trained. Run POST /api/ml/train-ae first.",
        )

    feature_cols = _detect_feature_columns(model)
    if not feature_cols:
        raise ValueError("Cannot detect feature columns from model")
    vec = _row_to_vector(row, db, feature_cols)
    if vec is None:
        raise HTTPException(
            status_code=422,
            detail="Row has insufficient features for prediction (dep_hour/encodings missing).",
        )

    predicted_delay = float(max(0.0, model.predict(vec)[0]))
    confidence      = _confidence(predicted_delay, model)

    # Compute SHAP explanation using the same sklearn Pipeline model
    shap_explanation = _compute_real_shap(model, vec, _detect_feature_columns(model))

    # Fetch intelligence stats from ae_aviation_stats
    stats = get_stats_for_flight(db, row.dep_iata, row.arr_iata, row.airline_iata, row.dep_hour)

    return {
        "schedule_id":          row.id,
        "flight_number":        row.flight_number,
        "airline_iata":         row.airline_iata,
        "airline_name":         row.airline_name,
        "dep_iata":             row.dep_iata,
        "arr_iata":             row.arr_iata,
        "dep_airport":          row.dep_airport,
        "arr_airport":          row.arr_airport,
        "scheduled_departure":  str(row.scheduled_departure) if row.scheduled_departure else None,
        "scheduled_arrival":    str(row.scheduled_arrival)   if row.scheduled_arrival   else None,
        "prediction": {
            "predicted_delay_min": int(round(predicted_delay)),
            "confidence":          round(confidence, 3),
            "model_path":          model_path,
            "risk_level":          "High" if predicted_delay > 30 else ("Medium" if predicted_delay > 10 else "Low"),
            "shap_explanation":    shap_explanation,
        },
        "intelligence": stats,
        "features_used": {
            "dep_hour":        row.dep_hour,
            "is_weekend":      row.is_weekend,
            "distance_km":     row.distance_km,
            "duration_min":    row.duration_min,
            "airline_enc":     row.airline_enc,
            "dep_airport_enc": row.dep_airport_enc,
            "arr_airport_enc": row.arr_airport_enc,
        }
    }


@router.get("/operational-report")
def get_ops_report(
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """
    Returns real-time operational intelligence report.
    Derived from AEAviationStats historical aggregates.
    """
    from app.ai.operational_intelligence import get_operational_intelligence
    try:
        return get_operational_intelligence(db)
    except Exception as e:
        logger.exception(f"Operational report failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
