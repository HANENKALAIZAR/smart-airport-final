import logging
"""
Prediction Service (v10)
=========================
Loads trained XGBoost model + SHAP explainer and generates predictions.

v10 changes:
  - threading.Lock() prevents race conditions during hot-reload.
  - Feature columns loaded from feature_columns.json sidecar (falls back
    to the 18-column v10 list if file missing).
  - SHAP output enriched: base_value + feature_contributions with raw values.
  - Predictions are persisted to the predictions table when a db session
    is supplied.
  - run_batch_predictions() generates predictions for upcoming DB flights.
"""

import hashlib
import json
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
from cachetools import TTLCache

from app.config import settings
from app.schemas.schemas import PredictionOut

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────
_MODEL_DIR       = Path(settings.MODEL_DIR)
_CLASSIFIER_PATH = _MODEL_DIR / "delay_classifier.json"
_REGRESSOR_PATH  = _MODEL_DIR / "delay_regressor.json"
_EXPLAINER_PATH  = _MODEL_DIR / "shap_explainer.pkl"
_FEAT_COLS_PATH  = _MODEL_DIR / "feature_columns.json"

# ── Default feature columns (v10) — used if sidecar JSON missing ──────────
_DEFAULT_FEATURE_COLUMNS = [
    "weather_severity",
    "origin_weather_severity",
    "dest_weather_severity",
    "temperature_c",
    "wind_speed_kmh",
    "visibility_km",
    "precipitation_mm",
    "hour_of_day",
    "day_of_week",
    "month",
    "is_weekend",
    "is_holiday",
    "congestion_level",
    "origin_congestion",
    "dest_congestion",
    "airline_reliability",
    "distance_km",
    "historical_delay_rate",
]

FEATURE_LABELS = {
    "weather_severity":           "Weather Severity",
    "origin_weather_severity":    "Origin Weather",
    "dest_weather_severity":      "Destination Weather",
    "temperature_c":              "Temperature (°C)",
    "wind_speed_kmh":             "Wind Speed (km/h)",
    "visibility_km":              "Visibility (km)",
    "precipitation_mm":           "Precipitation (mm)",
    "hour_of_day":                "Time of Day",
    "day_of_week":                "Day of Week",
    "month":                      "Month",
    "is_weekend":                 "Weekend",
    "is_holiday":                 "Holiday",
    "congestion_level":           "Congestion Level",
    "origin_congestion":          "Origin Airport Congestion",
    "dest_congestion":            "Destination Congestion",
    "airline_reliability":        "Airline Reliability",
    "distance_km":                "Flight Distance",
    "historical_delay_rate":      "Route History",
}

# ── Module-level state (guarded by _lock) ─────────────────────────────────
_lock             = threading.Lock()
_model            = None
_explainer        = None
_regressor        = None
_feature_columns  = _DEFAULT_FEATURE_COLUMNS[:]

# ── TTL prediction cache (5 min, 512 slots) ───────────────────────────────
_prediction_cache: TTLCache = TTLCache(maxsize=512, ttl=300)


# ── Model loading ─────────────────────────────────────────────────────────

def load_model():
    """
    Load XGBoost model + SHAP explainer from disk.
    Thread-safe — called at startup and after training (hot-reload).
    """
    global _model, _explainer, _regressor, _feature_columns

    with _lock:
        if not _CLASSIFIER_PATH.exists():
            logger.info(f"No model at {_CLASSIFIER_PATH} — using rule-based fallback")
            return

        try:
            import xgboost as xgb
            import joblib

            _model = xgb.XGBClassifier()
            _model.load_model(str(_CLASSIFIER_PATH))

            if _REGRESSOR_PATH.exists():
                _regressor = xgb.XGBRegressor()
                _regressor.load_model(str(_REGRESSOR_PATH))

            if _EXPLAINER_PATH.exists():
                _explainer = joblib.load(str(_EXPLAINER_PATH))

            if _FEAT_COLS_PATH.exists():
                _feature_columns = json.loads(_FEAT_COLS_PATH.read_text(encoding="utf-8"))
            else:
                _feature_columns = _DEFAULT_FEATURE_COLUMNS[:]

            # Invalidate cache on reload
            _prediction_cache.clear()

            logger.info(
                f"Model loaded: {len(_feature_columns)} features | "
                f"regressor={'yes' if _regressor else 'no'} | "
                f"SHAP={'yes' if _explainer else 'no'}"
            )
        except Exception as e:
            logger.warning(f"Model loading failed: {e} — using rule-based fallback")
            _model = None


# ── Feature extraction ────────────────────────────────────────────────────

def _extract_features(features_obj, cols: list) -> np.ndarray:
    """Extract feature array from SQLAlchemy model or dict. NaN for missing values."""
    if isinstance(features_obj, dict):
        values = [
            float(features_obj[col]) if features_obj.get(col) is not None else np.nan
            for col in cols
        ]
    else:
        values = [
            float(getattr(features_obj, col)) if getattr(features_obj, col, None) is not None else np.nan
            for col in cols
        ]
    return np.array([values], dtype=np.float32)


def _cache_key(features: np.ndarray) -> str:
    safe = np.nan_to_num(features, nan=0.0)
    return hashlib.md5(safe.tobytes()).hexdigest()


# ── Rule-based fallback ───────────────────────────────────────────────────

def _rule_based(features: np.ndarray, cols: list) -> tuple[float, int, dict]:
    fd = dict(zip(cols, features[0]))

    weather_sev = float(fd.get("weather_severity") or 0)
    congestion  = float(fd.get("congestion_level")  or 0)
    reliability = float(fd.get("airline_reliability") or 0.80)
    hist_rate   = float(fd.get("historical_delay_rate") or 0)

    risk = (
        3.0
        + weather_sev * 28.0
        + congestion  * 15.0
        + (1.0 - reliability) * 18.0
        + hist_rate   * 10.0
    )
    risk = min(max(risk, 0), 100)

    predicted_delay = 0
    if risk > 40:
        mix = weather_sev * 0.5 + congestion * 0.3 + (1 - reliability) * 0.2
        predicted_delay = int(15 + mix * 100)

    contributions = {
        "Weather Severity":   round(weather_sev * 28.0, 2),
        "Airport Congestion": round(congestion  * 15.0, 2),
        "Airline Reliability":round((1.0 - reliability) * 18.0, 2),
        "Route History":      round(hist_rate   * 10.0, 2),
        "Time of Day":        round(float(fd.get("hour_of_day") or 0) / 24.0 * 5.0, 2),
    }
    return risk, predicted_delay, contributions


# ── ML prediction ─────────────────────────────────────────────────────────

def _ml_prediction(features: np.ndarray, cols: list) -> tuple[float, int, dict]:
    proba       = _model.predict_proba(features)[0]
    risk_score  = float(proba[1]) * 100

    predicted_delay = (
        max(0, int(_regressor.predict(features)[0]))
        if _regressor is not None
        else int(risk_score * 1.5)
    )

    # Build enriched SHAP explanation
    base_value   = None
    contributions: dict = {}

    if _explainer is not None:
        try:
            shap_vals = _explainer.shap_values(features)
            # For binary classifiers shap_values may return list[array] or single array
            sv = shap_vals[1][0] if isinstance(shap_vals, list) else shap_vals[0]
            base_value = float(
                _explainer.expected_value[1]
                if isinstance(_explainer.expected_value, (list, np.ndarray))
                else _explainer.expected_value
            )
            for i, col in enumerate(cols):
                label = FEATURE_LABELS.get(col, col)
                raw   = float(features[0][i]) if not np.isnan(features[0][i]) else None
                contributions[label] = {
                    "shap":  round(float(sv[i]), 4),
                    "value": round(raw, 4) if raw is not None else None,
                }
        except Exception as e:
            logger.warning(f"SHAP explanation failed: {e}")
    else:
        # Fallback: use feature importances × feature values as proxy
        importances = _model.feature_importances_
        for i, col in enumerate(cols):
            label = FEATURE_LABELS.get(col, col)
            raw   = float(features[0][i]) if not np.isnan(features[0][i]) else 0.0
            contributions[label] = {
                "shap":  round(float(importances[i] * raw), 4),
                "value": round(raw, 4),
            }

    # Sort by abs(shap) descending
    sorted_contribs = dict(
        sorted(contributions.items(), key=lambda x: abs(x[1]["shap"]), reverse=True)
    )

    explanation = {
        "base_value":            base_value,
        "feature_contributions": sorted_contribs,
    }

    return risk_score, predicted_delay, explanation


# ── Persist to DB ─────────────────────────────────────────────────────────

def _persist_prediction(
    result: PredictionOut,
    db,
    flight_id: Optional[int] = None,
    flight_number: Optional[str] = None,
):
    """Write a prediction row to the predictions table (best-effort)."""
    if db is None:
        return
    try:
        from app.models.models import Prediction
        row = Prediction(
            flight_id           = flight_id,
            flight_number       = flight_number,
            risk_score          = result.risk_score,
            predicted_delay_min = result.predicted_delay_min,
            confidence          = result.confidence,
            shap_explanation    = result.shap_explanation,
            model_version       = result.model_version,
        )
        db.add(row)
        db.commit()
    except Exception as e:
        logger.warning(f"Prediction persistence failed: {e}")
        try:
            db.rollback()
        except Exception:
            pass


# ── Public API ────────────────────────────────────────────────────────────

def _run_prediction(
    features_obj,
    db=None,
    flight_id: Optional[int] = None,
    flight_number: Optional[str] = None,
) -> PredictionOut:
    cols = _feature_columns
    features = _extract_features(features_obj, cols)
    key = _cache_key(features)

    if key in _prediction_cache:
        return _prediction_cache[key]

    with _lock:
        if _model is not None:
            risk, delay, explanation = _ml_prediction(features, cols)
            version = "xgboost-v10"
        else:
            risk, delay, contributions = _rule_based(features, cols)
            explanation = {"base_value": None, "feature_contributions": {
                k: {"shap": v, "value": None} for k, v in contributions.items()
            }}
            version = "rule-based-v1"

    result = PredictionOut(
        risk_score          = round(risk, 2),
        predicted_delay_min = delay,
        confidence          = round(min(risk / 100, 1.0), 3),
        shap_explanation    = explanation,
        model_version       = version,
        predicted_at        = datetime.utcnow(),
    )

    _prediction_cache[key] = result

    # Persist asynchronously-safe (best-effort)
    _persist_prediction(result, db, flight_id=flight_id, flight_number=flight_number)

    return result


def predict_flight(features_obj, db=None, flight_id: Optional[int] = None) -> PredictionOut:
    """Generate prediction from a FlightFeature ORM object."""
    return _run_prediction(features_obj, db=db, flight_id=flight_id)


def predict_from_dict(
    features_dict: dict,
    db=None,
    flight_id: Optional[int] = None,
    flight_number: Optional[str] = None,
) -> PredictionOut:
    """Generate prediction from a feature dict."""
    return _run_prediction(
        features_dict, db=db, flight_id=flight_id, flight_number=flight_number
    )


# ── Batch predictions ─────────────────────────────────────────────────────

def run_batch_predictions(db) -> int:
    """
    Generate and persist predictions for flights scheduled in the next 24h
    that have features but no prediction in the last hour.

    Returns:
        Number of predictions generated.
    """
    from app.models.models import Flight, FlightFeature, Prediction

    now          = datetime.utcnow()
    future_cut   = now + timedelta(hours=24)
    recent_cut   = now - timedelta(hours=1)

    # Flight IDs with a recent prediction
    recent_ids = (
        db.query(Prediction.flight_id)
        .filter(
            Prediction.flight_id.isnot(None),
            Prediction.predicted_at >= recent_cut,
        )
        .subquery()
    )

    pairs = (
        db.query(Flight, FlightFeature)
        .join(FlightFeature, FlightFeature.flight_id == Flight.id)
        .filter(
            Flight.scheduled_departure.between(now, future_cut),
            Flight.id.notin_(recent_ids.select()),
        )
        .all()
    )

    count = 0
    for flight, feat in pairs:
        try:
            predict_flight(feat, db=db, flight_id=flight.id)
            count += 1
        except Exception as e:
            logger.warning(f"Batch prediction failed for flight {flight.id}: {e}")

    logger.info(f"Batch predictions complete: {count} generated")
    return count
