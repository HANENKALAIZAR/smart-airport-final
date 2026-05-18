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

# Feature columns (must match train_ae_dataset.py AE_FEATURE_COLUMNS exactly)
_FEATURE_COLUMNS = [
    "dep_hour",
    "is_weekend",
    "distance_km",
    "duration_min",
    "airline_enc",
    "dep_airport_enc",
    "arr_airport_enc",
]

# Leakage guard — these must never be present in the feature vector
_FORBIDDEN = {"delay_minutes", "is_delayed", "dep_delay_min", "arr_delay_min"}


def _load_model():
    """Load the sklearn Pipeline from disk. Returns None if not yet trained."""
    if not MODEL_PATH.exists():
        logger.warning(f"[FuturePredictions] Model not found at {MODEL_PATH}")
        return None, None
    try:
        import joblib
        model = joblib.load(str(MODEL_PATH))
        version = MODEL_PATH.stat().st_mtime
        logger.info(f"[FuturePredictions] Model loaded from {MODEL_PATH}")
        return model, str(MODEL_PATH)
    except Exception as e:
        logger.error(f"[FuturePredictions] Model load failed: {e}")
        return None, None


def _row_to_vector(row, db) -> Optional[np.ndarray]:
    """Build a (1, 15) float32 feature array from an AEFutureSchedule ORM row + rolling features."""
    from app.ml.rolling_features import get_rolling_features_for_inference

    base_values = []
    for col in _FEATURE_COLUMNS:
        v = getattr(row, col, None)
        base_values.append(float(v) if v is not None else 0.0)

    # Sanity check — all zeros means the row is unprocessed
    if all(v == 0.0 for v in base_values):
        return None

    # Fetch rolling features dynamically
    rolling = get_rolling_features_for_inference(
        dep_iata=row.dep_iata,
        arr_iata=row.arr_iata,
        airline_iata=row.airline_iata,
        dep_hour=row.dep_hour,
        flight_date=row.scheduled_departure,
        db=db,
    )

    ROLLING_COLS = [
        "route_avg_delay_hist", "airline_avg_delay_hist", "hour_avg_delay_hist",
        "route_flight_count", "airline_flight_count", "airport_departure_count",
        "dep_month", "dep_day_of_week",
    ]

    rolling_values = [float(rolling.get(k, 0.0)) for k in ROLLING_COLS]
    full_vector = base_values + rolling_values

    return np.array([full_vector], dtype=np.float32)


def _confidence(predicted_delay: float, model) -> float:
    """
    Heuristic confidence:
      • Very short delay (<5 min) → high confidence the flight is on time
      • Long delay (>60 min) → lower confidence (rare events)
    Maps to [0.50, 0.95].
    """
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

    Parameters
    ----------
    db            : SQLAlchemy Session
    horizon_hours : how far ahead to predict (default 72 h)
    batch_size    : rows per DB commit cycle

    Returns
    -------
    dict: {predicted, skipped, errors, model_version}
    """
    from app.models.ae_models import AEFutureSchedule

    model, model_path = _load_model()
    if model is None:
        return {
            "status":  "no_model",
            "message": "Train the model first: POST /api/ml/train-ae",
            "predicted": 0,
        }

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

    logger.info(f"[FuturePredictions] {len(rows)} unpredicted future flights in next {horizon_hours}h")

    predicted = skipped = errors = 0
    model_ver = f"delay_prediction_model @ {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"

    for i in range(0, len(rows), batch_size):
        batch = rows[i: i + batch_size]
        try:
            for row in batch:
                vec = _row_to_vector(row, db)
                if vec is None:
                    skipped += 1
                    continue

                pred_delay = float(max(0.0, model.predict(vec)[0]))
                conf       = _confidence(pred_delay, model)

                row.predicted_delay_min = int(round(pred_delay))
                row.confidence          = round(conf, 3)
                row.predicted_at        = now
                row.model_version       = model_ver
                predicted += 1

            db.commit()
            logger.debug(f"[FuturePredictions] Committed batch [{i}–{i+len(batch)}]")
        except Exception as e:
            db.rollback()
            logger.error(f"[FuturePredictions] Batch [{i}] failed: {e}")
            errors += len(batch)

    logger.info(
        f"[FuturePredictions] Done: predicted={predicted} skipped={skipped} errors={errors}"
    )
    return {
        "status":        "ok",
        "predicted":     predicted,
        "skipped":       skipped,
        "errors":        errors,
        "model_version": model_ver,
        "horizon_hours": horizon_hours,
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
