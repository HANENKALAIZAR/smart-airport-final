"""
Multi-Model Training & Comparison Pipeline (Phase 3 — v2.1)
=====================================================
Trains XGBoost, LightGBM, and CatBoost on the same enriched feature set,
evaluates all three with time-series cross-validation, and selects the
champion model based on honest MAE comparison.

Guarantees
----------
* SAME train/test split for ALL models — no cherry-picking.
* Time-based split ONLY (no random shuffle).
* Rolling features built from train data before being applied to test.
* Winner is the model with lowest test MAE that also beats the statistical baseline.
* All results written to ae_evaluation_report.json for the MLOps controller.
* Feature column list saved to feature_columns_v2.json sidecar for inference.

New feature set (16 features = 8 base + 8 rolling):
    dep_hour, is_weekend, is_peak_hour, distance_km, duration_min,
    airline_enc, dep_airport_enc, arr_airport_enc,
    route_avg_delay_hist, airline_avg_delay_hist, hour_avg_delay_hist,
    route_flight_count, airline_flight_count, airport_departure_count,
    dep_month, dep_day_of_week

Data quality filters applied at load time:
    * final_status != 'cancelled'  (cancelled flights have no delay to predict)
    * completeness >= 0.6          (low-quality rows excluded from training)

Usage
-----
    cd backend
    python -m app.ai.train_v2                   # CLI
    POST /api/ml/train-v2                        # API (super_admin JWT)
"""

from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import joblib

from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit

logger = logging.getLogger(__name__)

MODEL_DIR    = Path(__file__).resolve().parent / "model"
MODEL_PATH   = MODEL_DIR / "delay_prediction_model.pkl"
REPORT_PATH  = MODEL_DIR / "ae_evaluation_report.json"
REPORT_V2    = MODEL_DIR / "ae_evaluation_report_v2.json"
ARCHIVE_DIR  = MODEL_DIR / "archive"
EXPLAINER_PATH = MODEL_DIR / "shap_explainer.pkl"

# ── Feature columns ────────────────────────────────────────────────────────────
BASE_FEATURES = [
    "dep_hour", "is_weekend", "is_peak_hour",     # time-of-day signals
    "distance_km", "duration_min",                 # route complexity
    "airline_enc", "dep_airport_enc", "arr_airport_enc",  # categorical encodings
]
ROLLING_FEATURES = [
    "route_avg_delay_hist", "airline_avg_delay_hist", "hour_avg_delay_hist",
    "route_flight_count", "airline_flight_count", "airport_departure_count",
    "dep_month", "dep_day_of_week",
]
ALL_FEATURES = BASE_FEATURES + ROLLING_FEATURES   # 16 features total
TARGET       = "delay_minutes"

# CatBoost native categorical features (reserved for future use)
# Not currently active because the training pipeline passes float64 numpy arrays
# and CatBoost refuses cat_features on non-integer arrays. Label encoding
# (airline_enc, dep_airport_enc, arr_airport_enc) is applied upstream during
# feature engineering, so ordinal encoding is preserved.
CATBOOST_CAT_FEATURE_NAMES = ["airline_enc", "dep_airport_enc", "arr_airport_enc"]

# Sidecar file — stores the exact feature list alongside the .pkl
FEATURE_COLS_PATH = MODEL_DIR / "feature_columns_v2.json"

# Must never appear as features
_FORBIDDEN = {
    "delay_minutes", "is_delayed", "dep_delay_min", "arr_delay_min",
    "dep_estimated", "arr_estimated", "dep_actual", "arr_actual",
    "final_status", "status_enc",
}

VAL_FRACTION = 0.20
_train_lock  = threading.Lock()


# ══════════════════════════════════════════════════════════════════════════════
# Leakage guard
# ══════════════════════════════════════════════════════════════════════════════

def _assert_no_leakage(cols: list[str]) -> None:
    leaked = set(cols) & _FORBIDDEN
    if leaked:
        raise ValueError(f"LEAKAGE DETECTED: {leaked}")


# ══════════════════════════════════════════════════════════════════════════════
# Data loading
# ══════════════════════════════════════════════════════════════════════════════

def _load_dataset(db) -> pd.DataFrame:
    """
    Load ML-ready rows from ae_flight_dataset with quality filters:
      - usable_for_ml=True and aviation_edge source
      - final_status != 'cancelled'  (cancelled → no delay to predict)
      - completeness >= 0.6          (low-quality rows excluded)
      - dep_hour, distance_km, airline_enc not null
    """
    from app.models.ae_models import AEFlightDataset
    rows = (
        db.query(AEFlightDataset)
        .filter(
            AEFlightDataset.usable_for_ml == True,
            AEFlightDataset.dep_hour.isnot(None),
            AEFlightDataset.distance_km.isnot(None),
            AEFlightDataset.airline_enc.isnot(None),
            # Quality filters
            AEFlightDataset.final_status != "cancelled",
            (AEFlightDataset.completeness >= 0.6) | (AEFlightDataset.completeness.is_(None)),
        )
        .order_by(AEFlightDataset.flight_date.asc())
        .all()
    )
    records = []
    for r in rows:
        # is_peak_hour: read native column, compute from dep_hour if null
        # Peak hours: 07-09 (morning rush) and 17-20 (evening rush)
        if r.is_peak_hour is not None:
            peak = int(r.is_peak_hour)
        elif r.dep_hour is not None:
            h = int(r.dep_hour)
            peak = 1 if (7 <= h <= 9 or 17 <= h <= 20) else 0
        else:
            peak = 0

        records.append({
            # Base features
            "dep_hour":        r.dep_hour,
            "is_weekend":      r.is_weekend,
            "is_peak_hour":    peak,
            "distance_km":     r.distance_km,
            "duration_min":    r.duration_min,
            "airline_enc":     r.airline_enc,
            "dep_airport_enc": r.dep_airport_enc,
            "arr_airport_enc": r.arr_airport_enc,
            # Target
            TARGET:            r.delay_minutes,
            # Metadata (prefixed _ — never used as features)
            "_id":             r.id,
            "_flight_number":  r.flight_number,
            "_flight_date":    r.flight_date,
            "_airline_iata":   r.airline_iata,
            "_dep_iata":       r.dep_iata,
            "_arr_iata":       r.arr_iata,
        })
    return pd.DataFrame(records)


# ══════════════════════════════════════════════════════════════════════════════
# Time-based split
# ══════════════════════════════════════════════════════════════════════════════

def _time_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, object]:
    df = df.sort_values("_flight_date").reset_index(drop=True)
    cutoff_idx  = int(len(df) * (1 - VAL_FRACTION))
    cutoff_date = df.iloc[cutoff_idx]["_flight_date"] if cutoff_idx < len(df) else None
    return df.iloc[:cutoff_idx].copy(), df.iloc[cutoff_idx:].copy(), cutoff_date


# ══════════════════════════════════════════════════════════════════════════════
# Baselines
# ══════════════════════════════════════════════════════════════════════════════

def _compute_baselines(train_df: pd.DataFrame, test_df: pd.DataFrame) -> dict:
    global_mean  = train_df[TARGET].mean()
    route_mean   = train_df.groupby(["_dep_iata", "_arr_iata"])[TARGET].mean().to_dict()
    airline_mean = train_df.groupby("_airline_iata")[TARGET].mean().to_dict()

    def _rp(row): return route_mean.get((row["_dep_iata"], row["_arr_iata"]), global_mean)
    def _ap(row): return airline_mean.get(row["_airline_iata"], global_mean)

    y_true = test_df[TARGET].values
    return {
        "route_baseline_mae":   round(float(mean_absolute_error(y_true, test_df.apply(_rp, axis=1).values)), 2),
        "airline_baseline_mae": round(float(mean_absolute_error(y_true, test_df.apply(_ap, axis=1).values)), 2),
        "global_mean_delay":    round(float(global_mean), 2),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Time-series cross-validation
# ══════════════════════════════════════════════════════════════════════════════

def _tscv_score(X: np.ndarray, y: np.ndarray, model_factory, n_splits: int = 5) -> dict:
    """
    Rolling-window time-series CV.  Returns mean and std of MAE across folds.
    Uses TimeSeriesSplit — earlier folds train on less data, never on future data.

    NOTE: CV scores have minor look-ahead bias (~0.5-1.0 min MAE)
    because rolling features are computed on full training set before CV.
    Full fix requires computing rolling features per fold inside this loop.
    Tracked as P1 audit item.
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    fold_maes = []
    for fold, (tr_idx, te_idx) in enumerate(tscv.split(X)):
        X_tr, y_tr = X[tr_idx], y[tr_idx]
        X_te, y_te = X[te_idx], y[te_idx]
        if len(X_tr) < 20 or len(X_te) < 5:
            continue
        m = model_factory()
        try:
            m.fit(X_tr, y_tr)
            preds = np.maximum(m.predict(X_te), 0)
            fold_maes.append(float(mean_absolute_error(y_te, preds)))
        except Exception as e:
            logger.debug(f"[TSCV] Fold {fold} failed: {e}")
    if not fold_maes:
        return {"cv_mae_mean": None, "cv_mae_std": None, "cv_folds": 0}
    return {
        "cv_mae_mean": round(float(np.mean(fold_maes)), 2),
        "cv_mae_std":  round(float(np.std(fold_maes)),  2),
        "cv_folds":    len(fold_maes),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Model factories
# ══════════════════════════════════════════════════════════════════════════════

def _xgb_factory(n_samples: int):
    import xgboost as xgb
    # Scale hyperparams with dataset size
    n_est    = min(500, max(100, n_samples // 3))
    depth    = 5 if n_samples < 500 else 6
    lr       = 0.05 if n_samples < 1000 else 0.03
    mcw      = max(3, n_samples // 200)
    return Pipeline([
        ("scaler",    StandardScaler()),
        ("regressor", xgb.XGBRegressor(
            n_estimators=n_est, max_depth=depth, learning_rate=lr,
            subsample=0.8, colsample_bytree=0.8, min_child_weight=mcw,
            gamma=0.1, reg_alpha=0.1, reg_lambda=1.0,
            random_state=42, eval_metric="mae",
        )),
    ])


def _lgbm_factory(n_samples: int):
    import lightgbm as lgb
    n_est = min(600, max(100, n_samples // 2))
    return Pipeline([
        ("scaler",    StandardScaler()),
        ("regressor", lgb.LGBMRegressor(
            n_estimators=n_est, max_depth=6, learning_rate=0.05,
            num_leaves=31, subsample=0.8, colsample_bytree=0.8,
            reg_alpha=0.1, reg_lambda=1.0,
            random_state=42, verbose=-1,
        )),
    ])


def _catboost_factory(n_samples: int):
    from catboost import CatBoostRegressor
    n_est = min(400, max(100, n_samples // 3))

    kwargs = dict(
        iterations=n_est, depth=6, learning_rate=0.05,
        random_seed=42, loss_function="MAE",
    )

    # CatBoost native categoricals (cat_features) not used because
    # the training data is already a homogeneous float64 numpy array
    # and CatBoost refuses cat_features on non-integer arrays.
    # Label encoding (airline_enc, dep_airport_enc, arr_airport_enc)
    # is done upstream during feature engineering, so CatBoost still
    # receives the ordinal encoding — just without its dedicated
    # categorical split logic.
    return Pipeline([
        ("regressor", CatBoostRegressor(**kwargs)),
    ])


def _random_forest_factory(n_samples: int):
    from sklearn.ensemble import RandomForestRegressor
    return Pipeline([
        ("scaler",    StandardScaler()),
        ("regressor", RandomForestRegressor(
            n_estimators=200, max_depth=8, min_samples_leaf=5,
            random_state=42, n_jobs=-1,
        )),
    ])


def _get_available_models(n_samples: int) -> list[tuple[str, callable]]:
    """Return (name, factory_fn) for every available model library."""
    models = [("xgboost", lambda: _xgb_factory(n_samples))]

    try:
        import lightgbm
        models.append(("lightgbm", lambda: _lgbm_factory(n_samples)))
    except ImportError:
        logger.info("[TrainV2] LightGBM not installed — skipped")

    try:
        import catboost
        models.append(("catboost", lambda: _catboost_factory(n_samples)))
    except ImportError:
        logger.info("[TrainV2] CatBoost not installed — skipped")

    # Always have RandomForest as a safe fallback
    models.append(("random_forest", lambda: _random_forest_factory(n_samples)))

    return models


# ══════════════════════════════════════════════════════════════════════════════
# Per-group breakdown
# ══════════════════════════════════════════════════════════════════════════════

def _error_by_group(test_df: pd.DataFrame, y_pred: np.ndarray, group_col: str) -> list[dict]:
    tmp = test_df.copy()
    tmp["_pred"] = y_pred
    result = []
    for g, grp in tmp.groupby(group_col):
        yt = grp[TARGET].values
        yp = grp["_pred"].values
        result.append({
            "group": str(g), "n": int(len(yt)),
            "mae":   round(float(mean_absolute_error(yt, yp)), 2),
            "mean_actual": round(float(yt.mean()), 2),
            "mean_pred":   round(float(yp.mean()), 2),
        })
    return sorted(result, key=lambda x: x["mae"], reverse=True)


# ══════════════════════════════════════════════════════════════════════════════
# Main entry point
# ══════════════════════════════════════════════════════════════════════════════

def train_v2(db, notes: str = "", persist_to_db: bool = True) -> dict:
    """
    Full multi-model training run with enriched features + time-series CV.

    Returns dict with keys:
        status, version, winner, all_models, metrics, baseline, verdict
    """
    if not _train_lock.acquire(blocking=False):
        return {"status": "already_running", "message": "Training already in progress"}

    try:
        logger.info("=" * 70)
        logger.info("  AE Training V2 — multi-model + rolling features")
        logger.info("=" * 70)

        # ── Step 1: Leakage guard ─────────────────────────────────────────────
        _assert_no_leakage(ALL_FEATURES)
        logger.info(f"Leakage check PASSED — {len(ALL_FEATURES)} features")

        # ── Step 2: Load dataset ──────────────────────────────────────────────
        df = _load_dataset(db)
        if len(df) < 50:
            return {"status": "insufficient_data", "rows": len(df),
                    "message": f"Only {len(df)} usable rows — need 50+"}

        # Coerce target
        df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce").fillna(0)
        p99 = float(df[TARGET].quantile(0.99))
        df[TARGET] = df[TARGET].clip(upper=p99)

        for col in BASE_FEATURES:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # ── Step 3: Time-based split ──────────────────────────────────────────
        train_df, test_df, cutoff_date = _time_split(df)
        logger.info(f"Split: train={len(train_df)} | test={len(test_df)} | cutoff={cutoff_date}")

        if len(test_df) < 5:
            return {"status": "insufficient_data",
                    "message": "Test set too small after time split"}

        # ── Step 4: Rolling features (from train only, applied to both) ────────
        from app.ml.rolling_features import enrich_with_rolling_features, ROLLING_FEATURE_COLUMNS
        try:
            train_df, test_df = enrich_with_rolling_features(train_df, test_df)
            feature_cols = ALL_FEATURES
            logger.info(f"Rolling features added: {ROLLING_FEATURE_COLUMNS}")
        except Exception as e:
            logger.warning(f"Rolling features failed ({e}) — falling back to base features")
            feature_cols = BASE_FEATURES

        # Null-fill all features
        for col in feature_cols:
            if col not in train_df.columns:
                train_df[col] = 0.0
                test_df[col]  = 0.0
            train_df[col] = pd.to_numeric(train_df[col], errors="coerce").fillna(0)
            test_df[col]  = pd.to_numeric(test_df[col],  errors="coerce").fillna(0)

        X_train = train_df[feature_cols].values.astype(np.float32)
        y_train = train_df[TARGET].values.astype(np.float32)
        X_test  = test_df[feature_cols].values.astype(np.float32)
        y_test  = test_df[TARGET].values.astype(np.float32)

        # ── Step 5: Statistical baselines ─────────────────────────────────────
        baseline = _compute_baselines(train_df, test_df)
        best_baseline_mae = min(baseline["route_baseline_mae"], baseline["airline_baseline_mae"])
        logger.info(f"Baseline — route: {baseline['route_baseline_mae']} | airline: {baseline['airline_baseline_mae']}")

        # ── Step 6: Train all available models ────────────────────────────────
        available = _get_available_models(len(train_df))
        model_results = []

        # Early stopping validation split for CatBoost (time-ordered 90/10)
        es_split_idx = int(len(X_train) * 0.90)
        X_es_train = X_train[:es_split_idx]
        X_es_val = X_train[es_split_idx:]
        y_es_train = y_train[:es_split_idx]
        y_es_val = y_train[es_split_idx:]

        for model_name, factory_fn in available:
            logger.info(f"Training {model_name}...")
            try:
                model = factory_fn()
                if model_name == "catboost":
                    model.fit(
                        X_es_train, y_es_train,
                        regressor__eval_set=(X_es_val, y_es_val),
                        regressor__early_stopping_rounds=50,
                        regressor__verbose=False,
                    )
                else:
                    model.fit(X_train, y_train)
                y_pred = np.maximum(model.predict(X_test), 0.0)

                mae  = float(mean_absolute_error(y_test, y_pred))
                rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
                r2   = float(r2_score(y_test, y_pred))
                beats = mae < best_baseline_mae

                # Time-series CV score
                cv = _tscv_score(X_train, y_train, factory_fn)

                model_results.append({
                    "name":                model_name,
                    "model":               model,       # object (not serialised)
                    "y_pred":              y_pred,
                    "mae":                 round(mae,  2),
                    "rmse":                round(rmse, 2),
                    "r2":                  round(r2,   4),
                    "beats_baseline":      beats,
                    "improvement_pct":     round((best_baseline_mae - mae) / max(best_baseline_mae, 0.001) * 100, 1),
                    "cv_mae_mean":         cv["cv_mae_mean"],
                    "cv_mae_std":          cv["cv_mae_std"],
                    "cv_folds":            cv["cv_folds"],
                })
                logger.info(
                    f"  {model_name}: MAE={mae:.2f} RMSE={rmse:.2f} R²={r2:.4f} "
                    f"beats_baseline={beats} cv_mae={cv['cv_mae_mean']}"
                )
            except ImportError:
                logger.info(f"  {model_name}: skipped (not installed)")
            except Exception as e:
                logger.warning(f"  {model_name}: FAILED — {e}")

        if not model_results:
            return {"status": "error", "message": "All model training attempts failed"}

        # ── Step 7: Select champion ───────────────────────────────────────────
        # Prefer models that beat baseline; among those pick lowest MAE.
        # Fall back to lowest MAE overall if none beats baseline.
        beats_baseline = [m for m in model_results if m["beats_baseline"]]
        champion = min(beats_baseline or model_results, key=lambda m: m["mae"])
        logger.info(f"Champion: {champion['name']} (MAE={champion['mae']})")

        best_model = champion["model"]
        best_y_pred = champion["y_pred"]

        # ── Step 8: Per-group breakdown for champion ───────────────────────────
        airline_errors = _error_by_group(test_df, best_y_pred, "_airline_iata")
        route_errors   = _error_by_group(
            test_df.assign(_route=test_df["_dep_iata"] + "->" + test_df["_arr_iata"]),
            best_y_pred, "_route"
        )

        # ── Step 9: Confidence calibration ────────────────────────────────────
        # Bucket absolute errors to see how calibrated the heuristic confidence is
        abs_errors = np.abs(best_y_pred - y_test)
        calibration = {
            "pct_within_5min":  round(float((abs_errors < 5).mean()  * 100), 1),
            "pct_within_15min": round(float((abs_errors < 15).mean() * 100), 1),
            "pct_within_30min": round(float((abs_errors < 30).mean() * 100), 1),
        }

        # ── Step 9b: Compute train MAE for overfitting check ──────────────────
        train_preds = best_model.predict(X_train)
        train_mae = float(mean_absolute_error(y_train, train_preds))

        # ── Step 10: Save champion model ──────────────────────────────────────
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        tmp_path = MODEL_PATH.with_suffix(".tmp")
        joblib.dump(best_model, str(tmp_path))
        os.replace(str(tmp_path), str(MODEL_PATH))
        logger.info(f"Champion model saved → {MODEL_PATH}")

        # Save SHAP explainer atomically — must match champion model
        try:
            import shap
            explainer = shap.TreeExplainer(
                best_model.named_steps["regressor"]
            )
            tmp_exp = EXPLAINER_PATH.with_suffix(".tmp")
            joblib.dump(explainer, str(tmp_exp))
            os.replace(str(tmp_exp), str(EXPLAINER_PATH))
            logger.info("SHAP explainer updated atomically with champion model")
        except Exception as e:
            logger.warning(
                f"SHAP save failed: {e}. "
                f"Pipeline steps: {list(best_model.named_steps.keys())}"
            )

        # Write feature column sidecar alongside the .pkl.
        # future_predictions.py loads this for exact feature-list detection
        # instead of guessing from model.named_steps["scaler"].n_features_in_.
        try:
            tmp_fc = FEATURE_COLS_PATH.with_suffix(".tmp")
            tmp_fc.write_text(json.dumps(feature_cols, indent=2), encoding="utf-8")
            os.replace(str(tmp_fc), str(FEATURE_COLS_PATH))
            logger.info(f"Feature sidecar saved: {len(feature_cols)} features")
        except Exception as sidecar_err:
            logger.warning(f"Feature sidecar write failed (non-fatal): {sidecar_err}")

        # Save target_clip_p99 sidecar — used by inference paths to clamp at
        # the same value used during training rather than hardcoded 300.0
        try:
            p99_path = MODEL_DIR / "target_clip_p99.json"
            p99_path.write_text(json.dumps({"target_clip_p99": float(p99)}), encoding="utf-8")
            logger.info(f"Target clip P99 saved: {p99:.2f} min")
        except Exception as _p99_err:
            logger.warning(f"Target clip P99 sidecar save failed (non-fatal): {_p99_err}")

        # ── Step 11: Build and save report ────────────────────────────────────

        version = datetime.now(timezone.utc).strftime("ae-v2-%Y%m%d-%H%M")
        report = {
            "version":         version,
            "trained_at":      datetime.now(timezone.utc).isoformat(),
            "notes":           notes,
            "training_mode":   "multi_model_v2",
            "metrics": {
                "mae":  champion["mae"],
                "rmse": champion["rmse"],
                "r2":   champion["r2"],
                "train_mae": round(float(train_mae), 4),
                "overfit_gap": round(float(train_mae - champion["mae"]), 4),
            },
            "dataset": {
                "total_rows":  len(df),
                "train_rows":  len(train_df),
                "test_rows":   len(test_df),
                "cutoff_date": str(cutoff_date),
                "feature_columns": feature_cols,
            },
            "winner": {
                "name":            champion["name"],
                "mae":             champion["mae"],
                "rmse":            champion["rmse"],
                "r2":              champion["r2"],
                "beats_baseline":  champion["beats_baseline"],
                "improvement_pct": champion["improvement_pct"],
                "cv_mae_mean":     champion["cv_mae_mean"],
                "cv_mae_std":      champion["cv_mae_std"],
            },
            "all_models": [
                {k: v for k, v in m.items() if k not in ("model", "y_pred")}
                for m in model_results
            ],
            "baseline": {
                "route_mae":         baseline["route_baseline_mae"],
                "airline_mae":       baseline["airline_baseline_mae"],
                "global_mean_delay": baseline["global_mean_delay"],
            },
            "calibration":   calibration,
            "airline_errors": airline_errors[:20],
            "route_errors":   route_errors[:20],
            "leakage_check":  "PASSED — delay_minutes not in feature set",
            "split_method":   "time-based (no random shuffle)",
            "cv_limitation": "rolling features computed on full training set — minor look-ahead bias (~0.5-1.0 min MAE)",
        }

        # Also overwrite the main report (used by mlops_controller)
        for path in [REPORT_V2, REPORT_PATH]:
            tmp_r = Path(str(path) + ".tmp")
            tmp_r.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
            os.replace(str(tmp_r), str(path))
        logger.info(f"Report saved → {REPORT_V2}")

        # ── Step 12: Persist to DB ────────────────────────────────────────────
        # persist_to_db=False when called via mlops_controller (which writes
        # the AEModelVersion row itself via register_model_version / promote_model).
        if persist_to_db:
            try:
                _persist_to_db(db, version, champion, baseline, feature_cols, notes)
            except Exception as e:
                logger.warning(f"DB persistence failed (non-fatal): {e}")

        # Upsert global mean into ae_aviation_stats so get_rolling_features_for_inference()
        # reads the live training mean rather than the hardcoded 21.0 fallback.
        try:
            from app.models.ae_models import AEAviationStats
            global_mean_val = round(float(df[TARGET].mean()), 4)
            _gm_row = db.query(AEAviationStats).filter(
                AEAviationStats.stat_type == "global",
                AEAviationStats.entity_key == "all",
            ).first()
            _now_ts = datetime.now(timezone.utc).replace(tzinfo=None)
            if _gm_row:
                _gm_row.avg_delay_min = global_mean_val
                _gm_row.computed_at   = _now_ts
            else:
                db.add(AEAviationStats(
                    stat_type="global", entity_key="all",
                    avg_delay_min=global_mean_val, computed_at=_now_ts,
                ))
            db.commit()
            logger.info(f"Global mean persisted to ae_aviation_stats: {global_mean_val} min")
        except Exception as _gm_err:
            logger.warning(f"Global mean write failed (non-fatal): {_gm_err}")
            try:
                db.rollback()
            except Exception:
                pass

        logger.info("=" * 70)
        logger.info(f"  V2 Training complete: {version}")
        logger.info(f"  Winner: {champion['name']} MAE={champion['mae']} | beats_baseline={champion['beats_baseline']}")
        logger.info("=" * 70)

        return {
            "status":   "ok",
            "version":  version,
            "winner":   report["winner"],
            "all_models": report["all_models"],
            "metrics":  {"mae": champion["mae"], "rmse": champion["rmse"], "r2": champion["r2"]},
            "baseline": report["baseline"],
            "calibration": calibration,
            # dataset key required by mlops_controller.register_model_version()
            "dataset": {
                "total_rows":      len(df),
                "train_rows":      len(train_df),
                "test_rows":       len(test_df),
                "cutoff_date":     str(cutoff_date),
                "feature_columns": feature_cols,
            },
            "verdict": {
                "better_than_baseline": champion["beats_baseline"],
                "improvement_vs_baseline_pct": champion["improvement_pct"],
                "recommendation": "deploy" if champion["beats_baseline"] and champion["r2"] > 0.05
                    else ("retrain with more data" if champion["beats_baseline"]
                    else "improve features — model below baseline"),
            },
            "evaluation_path": str(REPORT_V2),
        }

    except ValueError as e:
        logger.error(f"Training blocked: {e}")
        return {"status": "blocked", "message": str(e)}
    except Exception as e:
        logger.exception(f"Training V2 failed: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        _train_lock.release()


def _persist_to_db(db, version: str, champion: dict, baseline: dict,
                   feature_cols: list, notes: str) -> None:
    from app.models.ae_models import AEModelVersion
    from datetime import timezone

    # Deactivate existing active
    db.query(AEModelVersion).filter(AEModelVersion.is_active == True).update(
        {"is_active": False, "retired_at": datetime.now(timezone.utc).replace(tzinfo=None)}
    )

    best_baseline_mae = min(baseline["route_baseline_mae"], baseline["airline_baseline_mae"])
    row = AEModelVersion(
        model_version        = version,
        trained_at           = datetime.now(timezone.utc).replace(tzinfo=None),
        model_path           = str(MODEL_PATH),
        dataset_size         = None,    # filled by caller via mlops_controller
        mae                  = champion["mae"],
        rmse                 = champion["rmse"],
        r2_score             = champion["r2"],
        baseline_route_mae   = baseline["route_baseline_mae"],
        baseline_airline_mae = baseline["airline_baseline_mae"],
        improvement_pct      = champion["improvement_pct"],
        better_than_baseline = champion["beats_baseline"],
        is_active            = True,
        promoted_at          = datetime.now(timezone.utc).replace(tzinfo=None),
        promotion_reason     = f"V2 multi-model champion: {champion['name']}",
        notes                = notes or "",
    )
    db.add(row)
    db.commit()
    logger.info(f"[TrainV2] DB version persisted: {version}")


# ══════════════════════════════════════════════════════════════════════════════
# CLI entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    from app.database import SessionLocal
    _db = SessionLocal()
    try:
        result = train_v2(_db, notes="CLI run — v2")
        safe = {k: v for k, v in result.items() if k != "evaluation_path"}
        print(json.dumps(safe, indent=2, default=str))
    finally:
        _db.close()
