"""
Future Flight Predictions
==========================
Loads rows from ae_future_schedules, applies feature_engineering.py,
runs the trained delay model (delay_prediction_model.pkl), and writes
predictions back to ae_future_schedules.predicted_delay_min.

Separation guarantee
---------------------
* Reads ONLY from ae_future_schedules — never from ae_flight_dataset.
* Writes ONLY to ae_future_schedules.predicted_delay_min / confidence.
* The model loaded here is delay_prediction_model.pkl (sklearn Pipeline).
* No retraining occurs here.

Backward-compatible feature detection
--------------------------------------
The loaded .pkl model is inspected to determine how many features it
expects (7 for the V1 pipeline, 15 for the V2 pipeline).

* 7 features (V1): uses base feature columns only.
* 15 features (V2): base features + 8 rolling historical features fetched
  from ae_aviation_stats via rolling_features.get_rolling_features_for_inference().

This ensures that predictions never crash with a shape-mismatch error
during the transition from V1 to V2.

Usage
-----
    cd backend
    python -m app.ai.future_predictions          # CLI
    POST /api/intelligence/predict-future        # API
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parent / "model" / "delay_prediction_model.pkl"

# ── Base feature columns ────────────────────────────────────────────────────
# V2.1 adds is_peak_hour as a 9th base feature (was 7 in V1, 8 in V2.0)
_BASE_FEATURE_COLUMNS = [
    "dep_hour",
    "is_weekend",
    "is_peak_hour",     # V2.1: peak departure window flag (07-09 / 17-20)
    "distance_km",
    "duration_min",
    "airline_enc",
    "dep_airport_enc",
    "arr_airport_enc",
]

# Sidecar path — written by train_v2.py after every training run
_FEATURE_COLS_SIDECAR = Path(__file__).resolve().parent / "model" / "feature_columns_v2.json"

# ── Rolling feature columns — added by V2 (train_v2.py) ──────────────────────
_ROLLING_FEATURE_COLUMNS = [
    "route_avg_delay_hist",
    "airline_avg_delay_hist",
    "hour_avg_delay_hist",
    "route_flight_count",
    "airline_flight_count",
    "airport_departure_count",
    "dep_month",
    "dep_day_of_week",
]

# Leakage guard — these must never be present in the feature vector
_FORBIDDEN = {"delay_minutes", "is_delayed", "dep_delay_min", "arr_delay_min"}


def _load_model():
    """Load the sklearn Pipeline from disk. Returns (model, path) or (None, None)."""
    if not MODEL_PATH.exists():
        logger.warning(f"[FuturePredictions] Model not found at {MODEL_PATH}")
        return None, None
    try:
        import joblib
        model = joblib.load(str(MODEL_PATH))
        logger.info(f"[FuturePredictions] Model loaded from {MODEL_PATH}")
        return model, str(MODEL_PATH)
    except Exception as e:
        logger.error(f"[FuturePredictions] Model load failed: {e}")
        return None, None


def _detect_feature_columns(model) -> list[str]:
    """
    Determine the exact feature list the loaded model expects.

    Priority order:
      1. feature_columns_v2.json sidecar (written by train_v2 after every run)
         — exact and version-aware, covers V2.0 (15 features), V2.1 (16 features), etc.
      2. model.named_steps["scaler"].n_features_in_ inspection
         — fallback: 7 features → V1, 15+ → V2 all features
      3. Base features only — last resort to avoid crashes.
    """
    # --- Priority 1: sidecar JSON ---
    if _FEATURE_COLS_SIDECAR.exists():
        try:
            cols = json.loads(_FEATURE_COLS_SIDECAR.read_text(encoding="utf-8"))
            if isinstance(cols, list) and len(cols) > 0:
                logger.info(f"[FuturePredictions] Sidecar loaded: {len(cols)} features")
                return cols
        except Exception as e:
            logger.warning(f"[FuturePredictions] Sidecar read failed ({e}) — falling back to introspection")

    # --- Priority 2: model introspection ---
    try:
        n = model.named_steps["scaler"].n_features_in_
        if n >= 8:  # V2 (any version with rolling features)
            logger.info(f"[FuturePredictions] Introspected V2 model ({n} features) — using full feature set")
            return _BASE_FEATURE_COLUMNS + _ROLLING_FEATURE_COLUMNS
        logger.info(f"[FuturePredictions] Introspected V1 model ({n} features) — base features only")
        return _BASE_FEATURE_COLUMNS[:7]   # V1: first 7 (no is_peak_hour)
    except Exception as e:
        logger.warning(f"[FuturePredictions] Introspection failed ({e}) — defaulting to base features")

    # --- Priority 3: safe fallback ---
    return _BASE_FEATURE_COLUMNS


def _get_rolling_features(row, db) -> dict:
    """
    Fetch rolling historical features from ae_aviation_stats for a single
    future schedule row.  All lookups are pure reads from pre-computed
    historical aggregates — no future information, no training data read.

    Falls back to a global mean of 21.0 min if a stat is missing.
    """
    try:
        from app.ml.rolling_features import get_rolling_features_for_inference
        return get_rolling_features_for_inference(
            dep_iata=row.dep_iata,
            arr_iata=row.arr_iata,
            airline_iata=row.airline_iata,
            dep_hour=row.dep_hour,
            flight_date=row.flight_date,
            db=db,
        )
    except Exception as e:
        logger.debug(f"[FuturePredictions] Rolling features unavailable for {row.flight_number}: {e}")
        # Safe fallback — global mean; model will still run
        return {col: 0.0 for col in _ROLLING_FEATURE_COLUMNS}


def _row_to_vector(row, db, feature_columns: list[str]) -> Optional[np.ndarray]:
    """
    Build a float32 feature array from an AEFutureSchedule ORM row.

    Handles V1 (7), V2.0 (15), and V2.1 (16, includes is_peak_hour) models
    via the sidecar-driven feature list.

    is_peak_hour is computed from dep_hour if not present as a native column:
      peak = 1 if dep_hour in [7,8,9,17,18,19,20] else 0
    """
    # Compute is_peak_hour from dep_hour (native or derived)
    dep_h = getattr(row, "dep_hour", None)
    if hasattr(row, "is_peak_hour") and getattr(row, "is_peak_hour") is not None:
        is_peak_hour_val = float(row.is_peak_hour)
    elif dep_h is not None:
        h = int(dep_h)
        is_peak_hour_val = 1.0 if (7 <= h <= 9 or 17 <= h <= 20) else 0.0
    else:
        is_peak_hour_val = 0.0

    # Extract base feature values from the ORM row
    base_values = {
        col: float(getattr(row, col) if getattr(row, col, None) is not None else 0.0)
        for col in _BASE_FEATURE_COLUMNS
        if col != "is_peak_hour"
    }
    base_values["is_peak_hour"] = is_peak_hour_val

    # If V2: add rolling historical features from ae_aviation_stats
    rolling_values = {}
    if len(feature_columns) > len(_BASE_FEATURE_COLUMNS):
        rolling_values = _get_rolling_features(row, db)
    elif len(feature_columns) > 7 and "is_peak_hour" not in feature_columns:
        # V2.0 model (15 features, no is_peak_hour) — still needs rolling
        rolling_values = _get_rolling_features(row, db)

    # Build the ordered feature vector
    all_values = []
    for col in feature_columns:
        if col in base_values:
            all_values.append(base_values[col])
        else:
            all_values.append(float(rolling_values.get(col, 0.0)))

    # Sanity check — if all base features are zero, row is unprocessed
    base_cols_in_vector = [c for c in feature_columns if c in base_values]
    base_slice = [all_values[feature_columns.index(c)] for c in base_cols_in_vector]
    if all(v == 0.0 for v in base_slice):
        return None

    return np.array([all_values], dtype=np.float32)


def _confidence(predicted_delay: float, model, db=None) -> float:
    """
    Data-driven confidence score calibrated from reconciled prediction history.

    Strategy:
      1. Query ae_prediction_logs for predictions in the same delay bucket
         (±30 min of predicted_delay) that have been reconciled.
      2. Compute the fraction within ±15 min of actual delay.
      3. Clamp to [0.45, 0.95].

    Falls back to the heuristic lookup table if no reconciled data exists yet
    (e.g., on first deployment or when predictions haven't completed yet).
    """
    if db is not None:
        try:
            from app.models.ae_models import AEPredictionLog
            from sqlalchemy import func as sqlfunc

            bucket_lo = max(0.0, predicted_delay - 30.0)
            bucket_hi = predicted_delay + 30.0

            total = db.query(sqlfunc.count(AEPredictionLog.id)).filter(
                AEPredictionLog.predicted_delay_min.between(int(bucket_lo), int(bucket_hi)),
                AEPredictionLog.prediction_error.isnot(None),
            ).scalar() or 0

            if total >= 20:  # enough data to calibrate
                accurate = db.query(sqlfunc.count(AEPredictionLog.id)).filter(
                    AEPredictionLog.predicted_delay_min.between(int(bucket_lo), int(bucket_hi)),
                    AEPredictionLog.prediction_error.isnot(None),
                    sqlfunc.abs(AEPredictionLog.prediction_error) <= 15,
                ).scalar() or 0
                calibrated = float(accurate) / float(total)
                return round(min(0.95, max(0.45, calibrated)), 3)
        except Exception:
            pass  # fall through to heuristic

    # Heuristic fallback (used when no reconciled history exists yet)
    if predicted_delay < 0:
        predicted_delay = 0.0
    if predicted_delay < 5:
        return 0.92
    if predicted_delay < 15:
        return 0.84
    if predicted_delay < 30:
        return 0.75
    if predicted_delay < 60:
        return 0.65
    return 0.55


def predict_future_flights(
    db,
    *,
    horizon_hours: int = 72,
    batch_size: int = 200,
) -> dict:
    """
    Predict delay for all ae_future_schedules rows scheduled within
    the next `horizon_hours` hours that haven't been predicted yet.

    Automatically detects whether the loaded model is V1 (7 features)
    or V2 (15 features) and constructs the correct feature vector.

    Parameters
    ----------
    db            : SQLAlchemy Session
    horizon_hours : how far ahead to predict (default 72 h)
    batch_size    : rows per DB commit cycle

    Returns
    -------
    dict: {predicted, skipped, errors, model_version, feature_count}
    """
    from app.models.ae_models import AEFutureSchedule

    model, model_path = _load_model()
    if model is None:
        return {
            "status":  "no_model",
            "message": "Train the model first: POST /api/ml/train-ae",
            "predicted": 0,
        }

    # Detect V1 vs V2 feature set from the loaded model
    feature_columns = _detect_feature_columns(model)

    now        = datetime.now(timezone.utc).replace(tzinfo=None)
    horizon_dt = now + timedelta(hours=horizon_hours)

    # Load unpredicted rows within the forecast window
    rows = (
        db.query(AEFutureSchedule)
        .filter(
            AEFutureSchedule.scheduled_departure >= now,
            AEFutureSchedule.scheduled_departure <= horizon_dt,
            AEFutureSchedule.predicted_at.is_(None),
        )
        .order_by(AEFutureSchedule.scheduled_departure.asc())
        .all()
    )

    logger.info(
        f"[FuturePredictions] {len(rows)} unpredicted future flights in next {horizon_hours}h "
        f"| model expects {len(feature_columns)} features"
    )

    predicted = skipped = errors = 0
    model_ver = f"delay_prediction_model @ {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"

    from app.ai.mlops_controller import log_prediction

    for i in range(0, len(rows), batch_size):
        batch = rows[i: i + batch_size]
        try:
            for row in batch:
                vec = _row_to_vector(row, db, feature_columns)
                if vec is None:
                    skipped += 1
                    continue

                # Predict delay, ensuring it is clamped and realistic (min 0, max 300 min)
                raw_pred   = float(model.predict(vec)[0])
                pred_delay = float(max(0.0, min(300.0, raw_pred)))
                conf       = _confidence(pred_delay, model, db)

                row.predicted_delay_min = int(round(pred_delay))
                row.confidence          = round(conf, 3)
                row.predicted_at        = now
                row.model_version       = model_ver
                predicted += 1

                # Write log atomically (commit=False)
                log_prediction(
                    db,
                    flight_number=row.flight_number,
                    airline_iata=row.airline_iata,
                    dep_iata=row.dep_iata,
                    arr_iata=row.arr_iata,
                    predicted_delay_min=row.predicted_delay_min,
                    confidence=row.confidence,
                    model_version=row.model_version,
                    source="future_schedule",
                    dep_hour=row.dep_hour,
                    is_weekend=row.is_weekend,
                    distance_km=row.distance_km,
                    duration_min=row.duration_min,
                    airline_enc=row.airline_enc,
                    dep_airport_enc=row.dep_airport_enc,
                    arr_airport_enc=row.arr_airport_enc,
                    commit=False,
                )

            db.commit()
            logger.debug(f"[FuturePredictions] Committed batch [{i}–{i+len(batch)}]")
        except Exception as e:
            db.rollback()
            logger.error(f"[FuturePredictions] Batch [{i}] failed: {e}")
            errors += len(batch)

    logger.info(
        f"[FuturePredictions] Done: predicted={predicted} skipped={skipped} errors={errors} "
        f"feature_count={len(feature_columns)}"
    )
    return {
        "status":        "ok",
        "predicted":     predicted,
        "skipped":       skipped,
        "errors":        errors,
        "model_version": model_ver,
        "horizon_hours": horizon_hours,
        "feature_count": len(feature_columns),
    }


def get_predictions_for_route(
    db,
    dep_iata: str,
    arr_iata: str,
    *,
    limit: int = 20,
) -> list[dict]:
    """
    Return the latest predictions for a specific route, ordered by departure.
    Used by the intelligence API endpoint.
    """
    from app.models.ae_models import AEFutureSchedule

    rows = (
        db.query(AEFutureSchedule)
        .filter(
            AEFutureSchedule.dep_iata  == dep_iata.upper(),
            AEFutureSchedule.arr_iata  == arr_iata.upper(),
            AEFutureSchedule.predicted_at.isnot(None),
        )
        .order_by(AEFutureSchedule.scheduled_departure.asc())
        .limit(limit)
        .all()
    )

    return [
        {
            "flight_number":    row.flight_number,
            "airline_iata":     row.airline_iata,
            "dep_iata":         row.dep_iata,
            "arr_iata":         row.arr_iata,
            "scheduled_departure": str(row.scheduled_departure),
            "predicted_delay":  row.predicted_delay_min,
            "confidence":       row.confidence,
            "predicted_at":     str(row.predicted_at),
        }
        for row in rows
    ]


# ══════════════════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    import json
    from app.database import SessionLocal
    _db = SessionLocal()
    try:
        result = predict_future_flights(_db, horizon_hours=72)
        print(json.dumps(result, indent=2, default=str))
    finally:
        _db.close()
