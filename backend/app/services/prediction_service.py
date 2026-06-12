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
import math
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
from cachetools import TTLCache

from app.config import settings
from app.schemas.schemas import PredictionOut

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
_MODEL_DIR        = Path(settings.MODEL_DIR)
_CLASSIFIER_PATH  = _MODEL_DIR / "delay_classifier.json"
_REGRESSOR_PATH   = _MODEL_DIR / "delay_regressor.json"
_EXPLAINER_PATH   = _MODEL_DIR / "shap_explainer.pkl"
# V2 sidecar takes priority; fall back to legacy V1 sidecar
_FEAT_COLS_PATH   = (
    _MODEL_DIR / "feature_columns_v2.json"   # written by train_v2.py
    if (_MODEL_DIR / "feature_columns_v2.json").exists()
    else _MODEL_DIR / "feature_columns.json"  # legacy V1
)
# Clip from P99 of training target — replaces hardcoded 300.0
_P99_CLIP_PATH = _MODEL_DIR / "target_clip_p99.json"
if _P99_CLIP_PATH.exists():
    import json
    _P99_CLIP = json.load(open(_P99_CLIP_PATH))["target_clip_p99"]
else:
    _P99_CLIP = 300.0

# ── Default feature columns ────────────────────────────────────────────────────
# Used only when feature_columns_v2.json sidecar is absent.
# Must match ALL_FEATURES in train_v2.py (V2.1: 16 features).
_DEFAULT_FEATURE_COLUMNS = [
    "dep_hour", "is_weekend", "is_peak_hour",
    "distance_km", "duration_min",
    "airline_enc", "dep_airport_enc", "arr_airport_enc",
    "route_avg_delay_hist", "airline_avg_delay_hist", "hour_avg_delay_hist",
    "route_flight_count", "airline_flight_count", "airport_departure_count",
    "dep_month", "dep_day_of_week",
]

FEATURE_LABELS = {
    # V1 base features
    "dep_hour":        "Time of Day",
    "is_weekend":      "Weekend Flight",
    "is_peak_hour":    "Peak Hour Departure",   # V2.1
    "distance_km":     "Flight Distance",
    "duration_min":    "Flight Duration",
    "airline_enc":     "Airline",
    "dep_airport_enc": "Origin Airport",
    "arr_airport_enc": "Destination Airport",
    # V2 rolling features
    "route_avg_delay_hist":    "Route Historical Delay",
    "airline_avg_delay_hist":  "Airline Historical Delay",
    "hour_avg_delay_hist":     "Hour Historical Delay",
    "route_flight_count":      "Route Traffic Volume",
    "airline_flight_count":    "Airline Traffic Volume",
    "airport_departure_count": "Airport Departure Load",
    "dep_month":               "Month",
    "dep_day_of_week":         "Day of Week",
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
    delay_prediction_model.pkl — the model produced by train_v2.py.
    Also loads the feature column list from feature_columns_v2.json sidecar
    (falls back to feature_columns.json for legacy V1, then to _DEFAULT_FEATURE_COLUMNS).
    Thread-safe — called at startup and after training (hot-reload).
    """
    global _model, _explainer, _regressor, _feature_columns, _FEAT_COLS_PATH

    with _lock:
        # Priority 1: sklearn pipeline (V2 regression model)
        _PKL_PATH = _MODEL_DIR / "delay_prediction_model.pkl"
        if _PKL_PATH.exists():
            try:
                import joblib
                _model = joblib.load(str(_PKL_PATH))
                _regressor = _model
                logger.info(f"Sklearn pipeline loaded from {_PKL_PATH}")
            except Exception as e:
                logger.warning(f"sklearn pipeline loading failed: {e} — using rule-based")
                _model = None
                _regressor = None
        elif _CLASSIFIER_PATH.exists():
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

        # Feature column sidecar: prefer V2, fall back to V1, then hardcoded default
        v2_sidecar = _MODEL_DIR / "feature_columns_v2.json"
        v1_sidecar = _MODEL_DIR / "feature_columns.json"
        sidecar = v2_sidecar if v2_sidecar.exists() else (v1_sidecar if v1_sidecar.exists() else None)
        if sidecar:
            try:
                _feature_columns = json.loads(sidecar.read_text(encoding="utf-8"))
                logger.info(f"Feature columns loaded from sidecar: {sidecar.name} ({len(_feature_columns)} features)")
            except Exception as e:
                logger.warning(f"Sidecar load failed ({e}) — using default columns")
                _feature_columns = _DEFAULT_FEATURE_COLUMNS[:]
        else:
            _feature_columns = _DEFAULT_FEATURE_COLUMNS[:]

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
    """
    Rule-based fallback using V2 feature set.
    Triggered when ML model is unavailable.
    Returns a heuristic delay estimate.
    """
    fd = dict(zip(cols, features[0]))

    route_avg = float(fd.get("route_avg_delay_hist", 0.0) or 0.0)
    airline_avg = float(fd.get("airline_avg_delay_hist", 0.0) or 0.0)
    hour_avg = float(fd.get("hour_avg_delay_hist", 0.0) or 0.0)

    base_delay = 0.0
    if route_avg > 0 or airline_avg > 0 or hour_avg > 0:
        weights = [0.5, 0.3, 0.2]
        signals = [route_avg, airline_avg, hour_avg]
        base_delay = sum(w * s for w, s in zip(weights, signals))
    else:
        dep_hour = float(fd.get("dep_hour", 12) or 12)
        is_peak = float(fd.get("is_peak_hour", 0) or 0)
        is_weekend = float(fd.get("is_weekend", 0) or 0)
        base_delay = 22.0
        if is_peak:
            base_delay += 5.0
        if not is_weekend:
            base_delay += 2.0

    base_delay = max(0.0, min(_P99_CLIP, base_delay))
    risk = min(100.0, (base_delay / 60.0) * 100.0)
    predicted_delay = int(round(base_delay))

    contributions = {
        "Route Historical Delay": round(route_avg, 2),
        "Airline Historical Delay": round(airline_avg, 2),
        "Hour Historical Delay": round(hour_avg, 2),
        "Time of Day": round(float(fd.get("dep_hour", 0) or 0) / 24.0 * 5.0, 2),
    }

    return risk, predicted_delay, contributions


def _compute_real_shap(model, features: np.ndarray, cols: list) -> dict:
    """
    Compute real SHAP values using shap.TreeExplainer on the XGBoost regressor
    inside the sklearn Pipeline.

    Returns a dict: {
        "base_value": float,
        "feature_contributions": {
            "<Human Label>": {"shap": float, "value": float}
        },
        "narrative": str  (human-readable explanation for airport admins)
    }

    Falls back gracefully if shap is not installed or the model is not XGBoost.
    """
    import shap
    from sklearn.pipeline import Pipeline as SklearnPipeline

    result = {"base_value": None, "feature_contributions": {}, "narrative": ""}

    try:
        if not isinstance(model, SklearnPipeline):
            return result

        scaler    = model.named_steps.get("scaler")
        regressor = model.named_steps.get("regressor")
        if regressor is None or scaler is None:
            return result

        # Scale the input (SHAP must receive the same transformed input as the regressor)
        X_scaled = scaler.transform(features)

        # TreeExplainer works directly on tree models — no background data needed
        explainer  = shap.TreeExplainer(regressor)
        shap_vals  = explainer.shap_values(X_scaled)   # shape: (1, n_features)
        base_val   = float(explainer.expected_value)
        sv         = shap_vals[0]                       # shape: (n_features,)

        contributions = {}
        for i, col in enumerate(cols):
            label = FEATURE_LABELS.get(col, col)
            raw   = float(features[0][i]) if i < features.shape[1] else 0.0
            contributions[label] = {
                "shap":  round(float(sv[i]), 4),
                "value": round(raw, 4),
            }

        result["base_value"]            = round(base_val, 4)
        result["feature_contributions"] = contributions
        result["narrative"]             = _generate_narrative(contributions, base_val)

    except ImportError:
        logger.debug("[SHAP] shap library not installed — skipping real SHAP")
    except Exception as e:
        logger.warning(f"[SHAP] Real SHAP computation failed: {e}")

    return result


def _generate_narrative(contributions: dict, base_value: float) -> str:
    """
    Generate a human-readable explanation sentence from SHAP values.

    Example output:
        "This flight has elevated delay risk mainly because the route historically
         has frequent delays (+8.3 min) and the departure hour is usually congested
         (+5.1 min). The airline is performing well (-3.2 min baseline offset)."
    """
    # Sort by absolute SHAP impact, descending
    sorted_contrib = sorted(
        contributions.items(),
        key=lambda x: abs(x[1]["shap"]),
        reverse=True,
    )

    # Separate positive (delay-increasing) and negative (delay-reducing)
    drivers     = [(k, v) for k, v in sorted_contrib if v["shap"] > 0.5]
    mitigators  = [(k, v) for k, v in sorted_contrib if v["shap"] < -0.5]

    parts = []

    if drivers:
        top_drivers = drivers[:3]
        driver_text = ", ".join(
            f"{k} (+{v['shap']:.1f} min)" for k, v in top_drivers
        )
        parts.append(f"This flight has elevated delay risk mainly because: {driver_text}")
    else:
        parts.append("No strong delay risk factors were detected for this flight.")

    if mitigators:
        top_mit = mitigators[:2]
        mit_text = ", ".join(
            f"{k} ({v['shap']:.1f} min)" for k, v in top_mit
        )
        parts.append(f"Positive factors reducing delay risk: {mit_text}.")

    if base_value > 10:
        parts.append(
            f"The model's baseline average delay for this type of flight is {base_value:.1f} min."
        )

    return " ".join(parts)


def _ml_prediction(features: np.ndarray, cols: list) -> tuple[float, int, dict]:
    """
    Run the sklearn Pipeline or XGBoost model.
    The sklearn Pipeline (delay_prediction_model.pkl) predicts delay_minutes directly
    (regression). The risk score is derived from the delay estimate.
    Real SHAP is computed via shap.TreeExplainer for the regression path.
    """
    from sklearn.pipeline import Pipeline as SklearnPipeline

    if isinstance(_model, SklearnPipeline):
        # Regression pipeline: predicts delay_minutes
        delay_raw    = float(_model.predict(features)[0])
        if delay_raw is None or (isinstance(delay_raw, float) and math.isnan(delay_raw)):
            delay_raw = 0.0
        delay_raw    = max(0.0, min(_P99_CLIP, delay_raw))
        # Map delay minutes to a 0-100 risk score:
        # 0 min → 0%, 15 min → 30%, 30 min → 55%, 60+ min → 85%+
        risk_score   = min(100.0, delay_raw / 60.0 * 85.0 + (5.0 if delay_raw > 0 else 0))
        predicted_delay = int(round(delay_raw))

        # Real SHAP explanation (TreeExplainer on the XGBoost regressor)
        explanation = _compute_real_shap(_model, features, cols)

    else:
        # XGBoost classifier (legacy path — predict_proba)
        proba       = _model.predict_proba(features)[0]
        risk_score  = float(proba[1]) * 100
        predicted_delay = int(risk_score * 1.5)

        explanation = {"base_value": None, "feature_contributions": {}, "narrative": ""}
        if _explainer is not None:
            try:
                shap_vals = _explainer.shap_values(features)
                sv = shap_vals[1][0] if isinstance(shap_vals, list) else shap_vals[0]
                base_value = float(
                    _explainer.expected_value[1]
                    if isinstance(_explainer.expected_value, (list, np.ndarray))
                    else _explainer.expected_value
                )
                contributions = {}
                for i, col in enumerate(cols):
                    label = FEATURE_LABELS.get(col, col)
                    raw   = float(features[0][i]) if not np.isnan(features[0][i]) else None
                    contributions[label] = {
                        "shap":  round(float(sv[i]), 4),
                        "value": round(raw, 4) if raw is not None else None,
                    }
                explanation["base_value"]            = base_value
                explanation["feature_contributions"] = contributions
                explanation["narrative"]             = _generate_narrative(contributions, base_value)
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

    # ── Feature enrichment ────────────────────────────────────────────────
    # When the incoming dict comes from live_feature_builder (7 keys) but
    # the loaded model expects 16 features, we must enrich on the fly.
    if isinstance(features_obj, dict):
        enriched = dict(features_obj)

        # Add is_peak_hour if missing (computed from dep_hour)
        if "is_peak_hour" in cols and "is_peak_hour" not in enriched:
            h = int(enriched.get("dep_hour") or 0)
            enriched["is_peak_hour"] = 1 if (7 <= h <= 9 or 17 <= h <= 20) else 0

        # Add rolling features if any are missing and db is available
        rolling_needed = [c for c in cols if c not in enriched and c in (
            "route_avg_delay_hist", "airline_avg_delay_hist", "hour_avg_delay_hist",
            "route_flight_count", "airline_flight_count", "airport_departure_count",
            "dep_month", "dep_day_of_week",
        )]
        if rolling_needed and db is not None:
            try:
                from app.ml.rolling_features import get_rolling_features_for_inference
                from datetime import date
                dep_iata    = enriched.get("dep_iata") or enriched.get("dep_airport")
                arr_iata    = enriched.get("arr_iata") or enriched.get("arr_airport")
                airline_iata = enriched.get("airline_iata") or enriched.get("airline")
                dep_hour    = int(enriched.get("dep_hour") or 0)
                rolling = get_rolling_features_for_inference(
                    dep_iata=dep_iata, arr_iata=arr_iata,
                    airline_iata=airline_iata, dep_hour=dep_hour,
                    flight_date=date.today(), db=db,
                )
                for k, v in rolling.items():
                    if k not in enriched:
                        enriched[k] = v
            except Exception as enrich_err:
                logger.debug(f"[PredictionService] Rolling feature enrichment failed: {enrich_err}")
                # Fill missing rolling features with 0
                for c in rolling_needed:
                    enriched.setdefault(c, 0.0)

        features_obj = enriched
    # ──────────────────────────────────────────────────────────────────

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
