import logging
"""
Prediction Service
==================
Loads the trained model + SHAP explainer and generates predictions.
Falls back to rule-based estimation if no model is available.

Improvements:
  - Model is pre-loaded at app startup (not lazily on first request)
  - TTLCache (5 min) avoids re-running XGBoost on identical feature sets
"""

import hashlib
import json
from pathlib import Path
from typing import Optional

import numpy as np
from cachetools import TTLCache

from app.config import settings
from app.schemas.schemas import PredictionOut
logger = logging.getLogger(__name__)

# ── Feature columns (must match training order) ──────────────────────────
FEATURE_COLUMNS = [
    "weather_severity",
    "origin_weather_severity",
    "dest_weather_severity",
    "hour_of_day",
    "day_of_week",
    "month",
    "is_weekend",
    "congestion_level",
    "origin_congestion",
    "dest_congestion",
    "airline_reliability",
    "distance_km",
    "historical_delay_rate",
]

FEATURE_LABELS = {
    "weather_severity":         "Weather Severity",
    "origin_weather_severity":  "Origin Weather",
    "dest_weather_severity":    "Destination Weather",
    "hour_of_day":              "Time of Day",
    "day_of_week":              "Day of Week",
    "month":                    "Month",
    "is_weekend":               "Weekend",
    "congestion_level":         "Congestion Level",
    "origin_congestion":        "Origin Airport Congestion",
    "dest_congestion":          "Destination Airport Congestion",
    "airline_reliability":      "Airline Reliability",
    "distance_km":              "Flight Distance",
    "historical_delay_rate":    "Route History",
}

# ── In-memory prediction cache (TTL = 5 minutes, max 512 entries) ─────────
_prediction_cache: TTLCache = TTLCache(maxsize=512, ttl=300)

# ── Model state (loaded once at startup) ──────────────────────────────────
_model = None
_explainer = None
_regressor = None


# ── Model loading ─────────────────────────────────────────────────────────

def load_model():
    """
    Load XGBoost model + SHAP explainer from disk.
    Called ONCE at application startup via main.py @app.on_event("startup").
    """
    global _model, _explainer, _regressor

    model_dir = Path(settings.MODEL_DIR)
    classifier_path = model_dir / "delay_classifier.json"
    regressor_path   = model_dir / "delay_regressor.json"
    explainer_path   = model_dir / "shap_explainer.pkl"

    if not classifier_path.exists():
        logger.info(f" No model found at {classifier_path} -- using rule-based fallback")
        return

    try:
        import xgboost as xgb
        import joblib

        _model = xgb.XGBClassifier()
        _model.load_model(str(classifier_path))

        if regressor_path.exists():
            _regressor = xgb.XGBRegressor()
            _regressor.load_model(str(regressor_path))

        if explainer_path.exists():
            _explainer = joblib.load(str(explainer_path))

        logger.info("AI model loaded at startup (XGBoost + SHAP)")
    except Exception as e:
        logger.warning(f" Model loading failed: {e} -- switching to rule-based fallback")
        _model = None


def _extract_features(features_obj) -> np.ndarray:
    """Extract feature array from SQLAlchemy model or dict."""
    if isinstance(features_obj, dict):
        values = [float(features_obj.get(col, 0)) for col in FEATURE_COLUMNS]
    else:
        values = [float(getattr(features_obj, col, 0)) for col in FEATURE_COLUMNS]
    return np.array([values])


def _cache_key(features: np.ndarray) -> str:
    """Stable hash of feature vector for cache lookup."""
    return hashlib.md5(features.tobytes()).hexdigest()


# ── Rule-based fallback ───────────────────────────────────────────────────

def _rule_based_prediction(features: np.ndarray) -> tuple[float, int, dict]:
    f = features[0]
    fd = dict(zip(FEATURE_COLUMNS, f))

    weather_sev = float(fd["weather_severity"])
    congestion  = float(fd["congestion_level"])
    reliability = float(fd["airline_reliability"])
    hist_rate   = float(fd["historical_delay_rate"])

    risk = (
        3.0
        + weather_sev * 28.0
        + congestion  * 15.0
        + (1.0 - reliability) * 18.0
        + hist_rate * 10.0
    )
    risk = min(max(risk, 0), 100)

    predicted_delay = 0
    if risk > 40:
        mix = weather_sev * 0.5 + congestion * 0.3 + (1 - reliability) * 0.2
        predicted_delay = int(15 + mix * 100)

    contributions = {
        "Weather Severity":   round(weather_sev * 28.0, 2),
        "Airport Congestion": round(congestion * 15.0, 2),
        "Airline Reliability":round((1.0 - reliability) * 18.0, 2),
        "Route History":      round(hist_rate * 10.0, 2),
        "Time of Day":        round(float(fd["hour_of_day"]) / 24.0 * 5.0, 2),
    }
    return risk, predicted_delay, contributions


# ── ML-based prediction ───────────────────────────────────────────────────

def _ml_prediction(features: np.ndarray) -> tuple[float, int, dict]:
    proba = _model.predict_proba(features)[0]
    risk_score = float(proba[1]) * 100

    predicted_delay = (
        max(0, int(_regressor.predict(features)[0]))
        if _regressor is not None
        else int(risk_score * 1.5)
    )

    contributions: dict = {}
    if _explainer is not None:
        try:
            shap_values = _explainer.shap_values(features)
            sv = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]
            for i, col in enumerate(FEATURE_COLUMNS):
                label = FEATURE_LABELS.get(col, col)
                contributions[label] = round(float(sv[i]), 4)
        except Exception as e:
            logger.warning(f"  SHAP explanation failed: {e}")
    else:
        importances = _model.feature_importances_
        for i, col in enumerate(FEATURE_COLUMNS):
            label = FEATURE_LABELS.get(col, col)
            contributions[label] = round(float(importances[i] * features[0][i]), 4)

    return risk_score, predicted_delay, contributions


# ── Public API ────────────────────────────────────────────────────────────

def _run_prediction(features: np.ndarray, source: str = "ml") -> PredictionOut:
    """Run prediction with caching."""
    key = _cache_key(features)

    if key in _prediction_cache:
        logger.debug(f" prediction key={key[:8]}")
        return _prediction_cache[key]

    if _model is not None:
        risk, delay, explanation = _ml_prediction(features)
        version = "xgboost-v1"
    else:
        risk, delay, explanation = _rule_based_prediction(features)
        version = "rule-based-v1"

    sorted_exp = dict(sorted(explanation.items(), key=lambda x: abs(x[1]), reverse=True))

    result = PredictionOut(
        risk_score=round(risk, 2),
        predicted_delay_min=delay,
        confidence=round(min(risk / 100, 1.0), 3),
        shap_explanation=sorted_exp,
        model_version=version,
    )

    _prediction_cache[key] = result
    return result


def predict_flight(features_obj) -> PredictionOut:
    """Generate prediction from a FlightFeature ORM object."""
    return _run_prediction(_extract_features(features_obj))


def predict_from_dict(features_dict: dict) -> PredictionOut:
    """Generate prediction from a dictionary of features."""
    return _run_prediction(_extract_features(features_dict))
