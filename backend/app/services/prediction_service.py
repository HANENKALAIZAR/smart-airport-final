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

# Human-readable phrases for building explanation sentences
_HUMAN_PHRASES: dict[str, str] = {
    "Weather Severity":               "adverse weather conditions",
    "Origin Weather":                  "poor weather at the departure airport",
    "Destination Weather":             "poor weather at the destination airport",
    "Time of Day":                     "the time of day (peak hours)",
    "Day of Week":                     "the day of the week",
    "Month":                           "seasonal patterns",
    "Weekend":                         "weekend travel patterns",
    "Congestion Level":                "air traffic congestion",
    "Origin Airport Congestion":       "congestion at the departure airport",
    "Destination Airport Congestion":  "congestion at the destination airport",
    "Airline Reliability":             "the airline's historical reliability",
    "Flight Distance":                 "the flight distance",
    "Route History":                   "historical delay patterns on this route",
    # Rule-based fallback labels
    "Weather Conditions":              "weather conditions",
    "Airport Congestion":              "airport congestion",
    "Airline Reliability":             "the airline's historical reliability",
    "Route History":                   "historical delay patterns on this route",
}


def generate_explanation_text(shap_explanation: dict, predicted_delay_min: int, risk_score: float) -> str:
    """
    Convert top SHAP features into a natural-language sentence.
    Returns a human-readable explanation for the prediction.
    """
    if not shap_explanation:
        return "No detailed explanation is available for this prediction."

    # Only consider features that increase delay risk (positive SHAP = more delay)
    positive = {k: v for k, v in shap_explanation.items() if v > 0}
    # Fall back to all features if none are positive (edge case)
    source = positive if positive else shap_explanation

    # Sort by absolute contribution, pick top 3
    top = sorted(source.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
    phrases = [_HUMAN_PHRASES.get(feat, feat.lower()) for feat, _ in top]

    if not phrases:
        return "No detailed explanation is available for this prediction."

    # Build sentence
    if risk_score < 30:
        prefix = "This flight has a low delay risk."
        if phrases:
            prefix += f" Minor contributing factors include {phrases[0]}."
        return prefix

    if len(phrases) == 1:
        factors_str = phrases[0]
    elif len(phrases) == 2:
        factors_str = f"{phrases[0]} and {phrases[1]}"
    else:
        factors_str = f"{phrases[0]}, {phrases[1]}, and {phrases[2]}"

    if predicted_delay_min > 0:
        delay_str = f" of approximately {predicted_delay_min} minutes"
    else:
        delay_str = ""

    return (
        f"This flight is predicted to be delayed{delay_str} mainly due to "
        f"{factors_str}. "
        f"These factors were identified by the AI model as the strongest "
        f"contributors to the delay risk."
    )

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


def _compute_real_shap(model, vec, feature_names: list[str]) -> dict:
    """
    Compute SHAP explanations or fallback feature contributions for a prediction vector.
    Used by GET /api/intelligence/flight-predict/{id} to populate shap_explanation.
    Returns:
        dict: {"feature_contributions": {display_label: {"shap": shap_value, "value": raw_value}}}
    """
    # Custom display name mapping matching FlightAIModal.jsx FEATURE_LABEL_TRANS
    column_to_label = {
        "dep_hour": "Time of Day",
        "is_weekend": "Weekend Flight",
        "is_peak_hour": "Peak Hour Departure",
        "distance_km": "Flight Distance",
        "duration_min": "Flight Duration",
        "airline_enc": "Airline",
        "dep_airport_enc": "Origin Airport",
        "arr_airport_enc": "Destination Airport",
        "route_avg_delay_hist": "Route Historical Delay",
        "airline_avg_delay_hist": "Airline Historical Delay",
        "hour_avg_delay_hist": "Hour Historical Delay",
        "route_flight_count": "Route Traffic Volume",
        "airline_flight_count": "Airline Traffic Volume",
        "airport_departure_count": "Airport Departure Load",
        "dep_month": "Month",
        "dep_day_of_week": "Day of Week",
    }

    feature_contributions = {}
    
    # 1. Scale feature vector if standard scaler is present in the pipeline
    vec_scaled = vec
    if hasattr(model, "named_steps") and "scaler" in model.named_steps:
        try:
            vec_scaled = model.named_steps["scaler"].transform(vec)
        except Exception as e:
            logger.warning(f"[SHAP] Scaler transform failed: {e}")
            
    # 2. Try loading shap explainer from disk
    import joblib
    
    explainer = None
    try:
        from app.core.config import settings
        model_dir = Path(settings.MODEL_DIR)
    except Exception:
        model_dir = Path(__file__).resolve().parent.parent / "ai" / "model"
        
    explainer_path = model_dir / "shap_explainer.pkl"
    
    if explainer_path.exists():
        try:
            explainer = joblib.load(str(explainer_path))
        except Exception as e:
            logger.warning(f"[SHAP] Failed to load explainer from {explainer_path}: {e}")
            
    # 3. Calculate SHAP values or fall back to feature importances
    shap_calculated = False
    if explainer is not None:
        try:
            import shap
            shap_values = explainer.shap_values(vec_scaled)
            # TreeExplainer returns a list of classes for classifier, or a single array for regressor
            sv = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]
            
            for i, col in enumerate(feature_names):
                label = column_to_label.get(col, col)
                raw_val = float(vec[0][i])
                shap_val = round(float(sv[i]), 4)
                feature_contributions[label] = {
                    "shap": shap_val,
                    "value": raw_val
                }
            shap_calculated = True
        except Exception as e:
            logger.warning(f"[SHAP] explainer.shap_values failed: {e}")

    # Fallback to feature importances or model-derived values if SHAP explainer is missing/fails
    if not shap_calculated:
        try:
            # Extract regressor/classifier step from pipeline if it is a Pipeline
            estimator = model.named_steps["regressor"] if hasattr(model, "named_steps") and "regressor" in model.named_steps else model
            
            if hasattr(estimator, "feature_importances_"):
                importances = estimator.feature_importances_
                for i, col in enumerate(feature_names):
                    label = column_to_label.get(col, col)
                    raw_val = float(vec[0][i])
                    # Approximate contribution using feature importance * scaled value (sign matched)
                    scaled_val = float(vec_scaled[0][i])
                    shap_val = round(float(importances[i] * scaled_val * 10.0), 4) # Scale by 10 for visibility
                    feature_contributions[label] = {
                        "shap": shap_val,
                        "value": raw_val
                    }
            else:
                # Fallback to simple values
                for i, col in enumerate(feature_names):
                    label = column_to_label.get(col, col)
                    raw_val = float(vec[0][i])
                    feature_contributions[label] = {
                        "shap": 0.0,
                        "value": raw_val
                    }
        except Exception as e:
            logger.warning(f"[SHAP] Feature importance fallback failed: {e}")
            # Absolute fallback
            for i, col in enumerate(feature_names):
                label = column_to_label.get(col, col)
                raw_val = float(vec[0][i]) if i < len(vec[0]) else 0.0
                feature_contributions[label] = {
                    "shap": 0.0,
                    "value": raw_val
                }

    return {"feature_contributions": feature_contributions}


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
    human_text = generate_explanation_text(sorted_exp, delay, risk)

    result = PredictionOut(
        risk_score=round(risk, 2),
        predicted_delay_min=delay,
        confidence=round(min(risk / 100, 1.0), 3),
        shap_explanation=sorted_exp,
        explanation_text=human_text,
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
