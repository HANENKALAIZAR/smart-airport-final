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

# ── Default feature columns — MUST match train_ae_dataset.py AE_FEATURE_COLUMNS ──
_DEFAULT_FEATURE_COLUMNS = [
    "dep_hour",
    "is_weekend",
    "distance_km",
    "duration_min",
    "airline_enc",
    "dep_airport_enc",
    "arr_airport_enc",
]

FEATURE_LABELS = {
    "dep_hour":        "Time of Day",
    "is_weekend":      "Weekend",
    "distance_km":     "Flight Distance",
    "duration_min":    "Flight Duration",
    "airline_enc":     "Airline Reliability",
    "dep_airport_enc": "Origin Airport",
    "arr_airport_enc": "Destination Airport",
}

# ── Module-level state (guarded by _lock) ─────────────────────────────────
_lock             = threading.Lock()
_model            = None   # sklearn Pipeline (StandardScaler + XGBRegressor)
_explainer        = None
_feature_columns  = _DEFAULT_FEATURE_COLUMNS[:]

# NOTE: _regressor is the sklearn Pipeline regression model (delay_prediction_model.pkl)
# For the passenger passenger endpoint we use it to predict delay minutes directly.
_regressor        = None

# ── TTL prediction cache (5 min, 512 slots) ───────────────────────────────
_prediction_cache: TTLCache = TTLCache(maxsize=512, ttl=300)


# ── Model loading ─────────────────────────────────────────────────────────

def load_model():
    """
    Load the trained sklearn Pipeline (StandardScaler + XGBRegressor) from
    delay_prediction_model.pkl — the model produced by train_ae_dataset.py.
    Also loads the feature column list from feature_columns.json sidecar.
    Thread-safe — called at startup and after training (hot-reload).
    """
    global _model, _explainer, _regressor, _feature_columns

    with _lock:
        # Priority 1: sklearn pipeline (7-column regression model)
        _PKL_PATH = _MODEL_DIR / "delay_prediction_model.pkl"
        if _PKL_PATH.exists():
            try:
                import joblib
                _model = joblib.load(str(_PKL_PATH))
                _regressor = _model  # same object — sklearn Pipeline has .predict()
                logger.info(f"Sklearn pipeline loaded from {_PKL_PATH}")
            except Exception as e:
                logger.warning(f"sklearn pipeline loading failed: {e} — using rule-based")
                _model = None
                _regressor = None
        elif _CLASSIFIER_PATH.exists():
            # Fallback: XGBoost native format (older model)
            try:
                import xgboost as xgb
                _model = xgb.XGBClassifier()
                _model._estimator_type = "classifier"
                _model.load_model(str(_CLASSIFIER_PATH))
                logger.info(f"XGBoost classifier loaded from {_CLASSIFIER_PATH}")
            except Exception as e:
                logger.warning(f"XGBoost loading failed: {e} — using rule-based")
                _model = None
        else:
            logger.info("No model file found — using rule-based fallback")
            return

        if _EXPLAINER_PATH.exists():
            try:
                import joblib
                _explainer = joblib.load(str(_EXPLAINER_PATH))
            except Exception:
                _explainer = None

        if _FEAT_COLS_PATH.exists():
            import json
            _feature_columns = json.loads(_FEAT_COLS_PATH.read_text(encoding="utf-8"))
        else:
            _feature_columns = _DEFAULT_FEATURE_COLUMNS[:]

        # Invalidate cache on reload
        _prediction_cache.clear()

        logger.info(
            f"Model ready: {len(_feature_columns)} features | "
            f"SHAP={'yes' if _explainer else 'no'}"
        )


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


def _ml_prediction(features: np.ndarray, cols: list) -> tuple[float, int, dict]:
    """
    Run the sklearn Pipeline or XGBoost model.
    The sklearn Pipeline (delay_prediction_model.pkl) predicts delay_minutes directly
    (regression). The risk score is derived from the delay estimate.
    """
    import joblib
    from sklearn.pipeline import Pipeline as SklearnPipeline

    explanation = {"base_value": None, "feature_contributions": {}}

    if isinstance(_model, SklearnPipeline):
        # Regression pipeline: predicts delay_minutes
        delay_raw = float(max(0, _model.predict(features)[0]))
        # Map delay minutes to a 0-100 risk score:
        # 0 min → 0%, 15 min → 30%, 30 min → 55%, 60+ min → 85%+
        risk_score = min(100.0, delay_raw / 60.0 * 85.0 + (5.0 if delay_raw > 0 else 0))
        predicted_delay = int(round(delay_raw))

        # Build simple importance-based explanation
        try:
            regressor = _model.named_steps.get("regressor")
            if regressor is not None and hasattr(regressor, "feature_importances_"):
                importances = regressor.feature_importances_
                for i, col in enumerate(cols):
                    label = FEATURE_LABELS.get(col, col)
                    raw = float(features[0][i]) if not np.isnan(features[0][i]) else 0.0
                    explanation["feature_contributions"][label] = {
                        "shap": round(float(importances[i] * raw), 4),
                        "value": round(raw, 4),
                    }
        except Exception as e:
            logger.debug(f"Feature importance extraction failed: {e}")

    else:
        # XGBoost classifier (legacy path — predict_proba)
        proba = _model.predict_proba(features)[0]
        risk_score = float(proba[1]) * 100
        predicted_delay = int(risk_score * 1.5)

        if _explainer is not None:
            try:
                shap_vals = _explainer.shap_values(features)
                sv = shap_vals[1][0] if isinstance(shap_vals, list) else shap_vals[0]
                base_value = float(
                    _explainer.expected_value[1]
                    if isinstance(_explainer.expected_value, (list, np.ndarray))
                    else _explainer.expected_value
                )
                explanation["base_value"] = base_value
                for i, col in enumerate(cols):
                    label = FEATURE_LABELS.get(col, col)
                    raw = float(features[0][i]) if not np.isnan(features[0][i]) else None
                    explanation["feature_contributions"][label] = {
                        "shap": round(float(sv[i]), 4),
                        "value": round(raw, 4) if raw is not None else None,
                    }
            except Exception as e:
                logger.warning(f"SHAP explanation failed: {e}")

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
    except Exception as e: # SQLAlchemy exceptions imported locally
        from sqlalchemy.exc import SQLAlchemyError
        if not isinstance(e, SQLAlchemyError):
            raise
        logger.warning(f"Prediction persistence failed: {e}")
        try:
            db.rollback()
        except SQLAlchemyError:
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
            try:
                risk, delay, explanation = _ml_prediction(features, cols)
                version = "xgboost-v10"
            except Exception as e:
                logger.warning(f"ML prediction failed (shape mismatch?): {e} — falling back to rule-based")
                risk, delay, contributions = _rule_based(features, cols)
                explanation = {"base_value": None, "feature_contributions": {
                    k: {"shap": v, "value": None} for k, v in contributions.items()
                }}
                version = "rule-based-v1-fallback"
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
        except (ValueError, TypeError, RuntimeError) as e:
            logger.warning(f"Batch prediction failed for flight {flight.id}: {e}")

    logger.info(f"Batch predictions complete: {count} generated")
    return count
