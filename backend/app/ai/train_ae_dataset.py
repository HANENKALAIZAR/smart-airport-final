"""
AE Dataset Training Pipeline (Production-Grade)
================================================
Trains a flight delay regression model from ae_flight_dataset using the
7 engineered features produced by feature_engineering.py.

Guarantees
----------
* Time-based split only — no random shuffle (prevents temporal leakage).
* delay_minutes used ONLY as label — never as input feature.
* Baseline (route-mean, airline-mean) computed before ML and compared.
* Model saved to app/ai/model/delay_prediction_model.pkl via sklearn Pipeline.
* Per-airline and per-route error breakdown written to evaluation report.
* Leakage guard raises ValueError if any forbidden column is in feature set.

Usage
-----
    cd backend
    python -m app.ai.train_ae_dataset          # CLI
    POST /api/ml/train-ae                       # API (super_admin JWT)
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

logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
MODEL_DIR   = Path(__file__).resolve().parent / "model"
MODEL_PATH  = MODEL_DIR / "delay_prediction_model.pkl"
REPORT_PATH = MODEL_DIR / "ae_evaluation_report.json"

# ── Feature / label definitions (matches feature_engineering.py) ───────────────
AE_FEATURE_COLUMNS = [
    "dep_hour",
    "is_weekend",
    "distance_km",
    "duration_min",
    "airline_enc",
    "dep_airport_enc",
    "arr_airport_enc",
]
TARGET = "delay_minutes"

# Columns that must NEVER appear in the feature set
_FORBIDDEN_LEAKAGE = {
    "delay_minutes", "is_delayed", "dep_delay_min", "arr_delay_min",
    "dep_estimated", "arr_estimated", "dep_actual", "arr_actual",
    "final_status", "status_enc",
}

# Validation split size
VAL_FRACTION = 0.20

# Concurrency guard
_train_lock = threading.Lock()


# ══════════════════════════════════════════════════════════════════════════════
# Leakage guard
# ══════════════════════════════════════════════════════════════════════════════

def _assert_no_leakage(feature_cols: list[str]) -> None:
    leaked = set(feature_cols) & _FORBIDDEN_LEAKAGE
    if leaked:
        raise ValueError(
            f"LEAKAGE DETECTED — forbidden columns in feature set: {leaked}. "
            "Remove them before training."
        )


# ══════════════════════════════════════════════════════════════════════════════
# Data loading
# ══════════════════════════════════════════════════════════════════════════════

def _load_ae_dataset(db) -> pd.DataFrame:
    """Load usable ae_flight_dataset rows as a DataFrame."""
    from app.models.ae_models import AEFlightDataset

    rows = (
        db.query(AEFlightDataset)
        .filter(
            AEFlightDataset.usable_for_ml == True,
            AEFlightDataset.dep_hour.isnot(None),
            AEFlightDataset.distance_km.isnot(None),
            AEFlightDataset.airline_enc.isnot(None),
        )
        .order_by(AEFlightDataset.flight_date.asc())
        .all()
    )

    records = []
    for r in rows:
        records.append({
            # Features
            "dep_hour":        r.dep_hour,
            "is_weekend":      r.is_weekend,
            "distance_km":     r.distance_km,
            "duration_min":    r.duration_min,
            "airline_enc":     r.airline_enc,
            "dep_airport_enc": r.dep_airport_enc,
            "arr_airport_enc": r.arr_airport_enc,
            # Label
            TARGET:            r.delay_minutes,
            # Metadata for evaluation (NOT used as features)
            "_id":             r.id,
            "_flight_number":  r.flight_number,
            "_flight_date":    r.flight_date,
            "_airline_iata":   r.airline_iata,
            "_dep_iata":       r.dep_iata,
            "_arr_iata":       r.arr_iata,
        })

    return pd.DataFrame(records)


# ══════════════════════════════════════════════════════════════════════════════
# Time-based split (NO random shuffle)
# ══════════════════════════════════════════════════════════════════════════════

def _time_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, object]:
    """Split by chronological order. Returns train_df, test_df, cutoff_date."""
    df = df.sort_values("_flight_date").reset_index(drop=True)
    cutoff_idx = int(len(df) * (1 - VAL_FRACTION))
    cutoff_date = df.iloc[cutoff_idx]["_flight_date"] if cutoff_idx < len(df) else None
    train = df.iloc[:cutoff_idx].copy()
    test  = df.iloc[cutoff_idx:].copy()
    return train, test, cutoff_date


# ══════════════════════════════════════════════════════════════════════════════
# Baselines
# ══════════════════════════════════════════════════════════════════════════════

def _compute_baselines(train_df: pd.DataFrame, test_df: pd.DataFrame) -> dict:
    """
    Two baselines computed from TRAINING data only, applied to test set:
      1. Route baseline   → mean delay per (dep_iata, arr_iata)
      2. Airline baseline → mean delay per airline_iata
      3. Global baseline  → grand mean (fallback)
    """
    global_mean = train_df[TARGET].mean()

    route_mean = (
        train_df.groupby(["_dep_iata", "_arr_iata"])[TARGET]
        .mean()
        .to_dict()
    )
    airline_mean = (
        train_df.groupby("_airline_iata")[TARGET]
        .mean()
        .to_dict()
    )

    def _route_pred(row):
        key = (row["_dep_iata"], row["_arr_iata"])
        return route_mean.get(key, global_mean)

    def _airline_pred(row):
        return airline_mean.get(row["_airline_iata"], global_mean)

    y_true = test_df[TARGET].values

    route_preds   = test_df.apply(_route_pred,   axis=1).values
    airline_preds = test_df.apply(_airline_pred, axis=1).values

    route_mae  = float(mean_absolute_error(y_true, route_preds))
    airline_mae = float(mean_absolute_error(y_true, airline_preds))

    return {
        "route_baseline_mae":   round(route_mae,   2),
        "airline_baseline_mae": round(airline_mae, 2),
        "global_mean_delay":    round(float(global_mean), 2),
        "_route_preds":         route_preds,
        "_airline_preds":       airline_preds,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Model training
# ══════════════════════════════════════════════════════════════════════════════

def _build_model() -> Pipeline:
    """Build sklearn Pipeline: StandardScaler → XGBRegressor."""
    try:
        import xgboost as xgb
        regressor = xgb.XGBRegressor(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=5,
            gamma=0.1,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            eval_metric="mae",
            early_stopping_rounds=None,
        )
    except ImportError:
        from sklearn.ensemble import RandomForestRegressor
        logger.warning("XGBoost not available — falling back to RandomForestRegressor")
        regressor = RandomForestRegressor(
            n_estimators=200, max_depth=8, random_state=42, n_jobs=-1
        )

    return Pipeline([
        ("scaler",    StandardScaler()),
        ("regressor", regressor),
    ])


def _train_model(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
) -> Pipeline:
    model = _build_model()
    regressor = model.named_steps["regressor"]

    # XGBoost supports eval_set natively; pass through if available
    try:
        import xgboost as xgb
        if isinstance(regressor, xgb.XGBRegressor):
            # Scaler must be fit first to transform eval set
            scaler = model.named_steps["scaler"]
            scaler.fit(X_train)
            X_tr_sc  = scaler.transform(X_train)
            X_val_sc = scaler.transform(X_val)
            regressor.fit(
                X_tr_sc, y_train,
                eval_set=[(X_val_sc, y_val)],
                verbose=False,
            )
            return model
    except Exception:
        pass

    model.fit(X_train, y_train)
    return model


# ══════════════════════════════════════════════════════════════════════════════
# Per-group error breakdown
# ══════════════════════════════════════════════════════════════════════════════

def _error_by_group(test_df: pd.DataFrame, y_pred: np.ndarray, group_col: str) -> list[dict]:
    tmp = test_df.copy()
    tmp["_pred"] = y_pred
    result = []
    for group_val, grp in tmp.groupby(group_col):
        y_t = grp[TARGET].values
        y_p = grp["_pred"].values
        result.append({
            "group":    str(group_val),
            "n":        int(len(y_t)),
            "mae":      round(float(mean_absolute_error(y_t, y_p)), 2),
            "mean_actual": round(float(y_t.mean()), 2),
            "mean_pred":   round(float(y_p.mean()), 2),
        })
    return sorted(result, key=lambda x: x["mae"], reverse=True)


# ══════════════════════════════════════════════════════════════════════════════
# Error histogram
# ══════════════════════════════════════════════════════════════════════════════

def _error_histogram(errors: np.ndarray, bins: int = 10) -> list[dict]:
    abs_errors = np.abs(errors)
    counts, edges = np.histogram(abs_errors, bins=bins)
    return [
        {
            "bin_start": round(float(edges[i]),   1),
            "bin_end":   round(float(edges[i+1]), 1),
            "count":     int(counts[i]),
        }
        for i in range(len(counts))
    ]


# ══════════════════════════════════════════════════════════════════════════════
# Main entry point
# ══════════════════════════════════════════════════════════════════════════════

def train_ae_model(db, notes: str = "") -> dict:
    """
    Full training run on ae_flight_dataset.

    Returns
    -------
    dict with keys:
        status, version, metrics, baseline, verdict, evaluation_path
    """
    from app.config import settings

    if not _train_lock.acquire(blocking=False):
        return {"status": "already_running", "message": "Training already in progress"}

    try:
        logger.info("=" * 60)
        logger.info("  AE Dataset Training Pipeline — starting")
        logger.info("=" * 60)

        # ── Step 1: Leakage guard ─────────────────────────────────────────────
        _assert_no_leakage(AE_FEATURE_COLUMNS)
        logger.info(f"Leakage check PASSED — features: {AE_FEATURE_COLUMNS}")

        # ── Step 2: Load dataset ──────────────────────────────────────────────
        df = _load_ae_dataset(db)
        logger.info(f"Loaded {len(df)} usable rows from ae_flight_dataset")

        if len(df) < 50:
            msg = (
                f"Insufficient data: {len(df)} rows. "
                "Run the ingestion pipeline to collect more flights, "
                "then POST /api/ae-dataset/rebuild-features before training."
            )
            logger.warning(msg)
            return {"status": "insufficient_data", "message": msg, "rows": len(df)}

        # ── Step 3: Prepare features (null-safe) ──────────────────────────────
        for col in AE_FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce").fillna(0)

        # Clip extreme delay outliers at 99th percentile
        p99 = float(df[TARGET].quantile(0.99))
        df[TARGET] = df[TARGET].clip(upper=p99)

        # ── Step 4: Time-based split ──────────────────────────────────────────
        train_df, test_df, cutoff_date = _time_split(df)
        logger.info(
            f"Split: train={len(train_df)} | test={len(test_df)} | "
            f"cutoff={cutoff_date}"
        )

        if len(test_df) < 5:
            msg = "Test set too small after time split — collect more recent flights."
            logger.warning(msg)
            return {"status": "insufficient_data", "message": msg}

        X_train = train_df[AE_FEATURE_COLUMNS].values.astype(np.float32)
        y_train = train_df[TARGET].values.astype(np.float32)
        X_test  = test_df[AE_FEATURE_COLUMNS].values.astype(np.float32)
        y_test  = test_df[TARGET].values.astype(np.float32)

        # ── Step 5: Baseline ──────────────────────────────────────────────────
        baseline = _compute_baselines(train_df, test_df)
        logger.info(
            f"Baseline MAE — route: {baseline['route_baseline_mae']} | "
            f"airline: {baseline['airline_baseline_mae']}"
        )

        # ── Step 6: Train ML model ────────────────────────────────────────────
        logger.info("Training XGBoost regression pipeline...")
        model = _train_model(X_train, y_train, X_test, y_test)

        # ── Step 7: Evaluate ──────────────────────────────────────────────────
        y_pred = np.maximum(model.predict(X_test), 0.0)

        mae  = float(mean_absolute_error(y_test, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        r2   = float(r2_score(y_test, y_pred))

        errors = y_pred - y_test  # signed errors
        logger.info(f"Eval → MAE={mae:.2f} RMSE={rmse:.2f} R²={r2:.4f}")

        # ── Step 8: Per-group breakdown ───────────────────────────────────────
        airline_errors = _error_by_group(test_df, y_pred, "_airline_iata")
        route_errors   = _error_by_group(
            test_df.assign(_route=test_df["_dep_iata"] + "→" + test_df["_arr_iata"]),
            y_pred, "_route"
        )
        error_hist = _error_histogram(errors)

        # ── Step 9: Real-world validation sample (first 100 test rows) ────────
        rw_sample = []
        sample_rows = test_df.head(100).reset_index(drop=True)
        sample_preds = y_pred[:len(sample_rows)]
        for idx, (_, row) in enumerate(sample_rows.iterrows()):
            pred   = float(sample_preds[idx]) if idx < len(sample_preds) else 0.0
            actual = float(row[TARGET])
            rw_sample.append({
                "flight_id":       str(row.get("_id", "")),
                "flight_number":   str(row.get("_flight_number", "")),
                "predicted_delay": round(pred, 1),
                "actual_delay":    round(actual, 1),
                "error":           round(abs(pred - actual), 1),
            })

        # ── Step 10: Verdict ──────────────────────────────────────────────────
        best_baseline_mae = min(
            baseline["route_baseline_mae"],
            baseline["airline_baseline_mae"],
        )
        better_than_baseline = mae < best_baseline_mae
        improvement_pct = round((best_baseline_mae - mae) / max(best_baseline_mae, 0.001) * 100, 1)

        weaknesses = []
        if r2 < 0.10:
            weaknesses.append("Low R² — model explains little variance; more features needed")
        if mae > 30:
            weaknesses.append("MAE > 30 min — predictions have high absolute error")
        if len(train_df) < 200:
            weaknesses.append("Small training set — collect more flights for better generalisation")
        worst_airlines = [e["group"] for e in airline_errors[:3] if e["mae"] > mae * 1.5]
        if worst_airlines:
            weaknesses.append(f"High error for airlines: {worst_airlines}")

        if better_than_baseline and r2 > 0.05 and mae < 40:
            recommendation = "deploy"
        elif better_than_baseline:
            recommendation = "retrain — collect more data"
        else:
            recommendation = "improve features — model below baseline"

        verdict = {
            "better_than_baseline":  better_than_baseline,
            "improvement_vs_baseline_pct": improvement_pct,
            "mae_interpretation":    _mae_label(mae),
            "weaknesses":            weaknesses,
            "recommendation":        recommendation,
        }

        # ── Step 11: Save model ───────────────────────────────────────────────
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        tmp_model = MODEL_PATH.with_suffix(".tmp")
        joblib.dump(model, str(tmp_model))
        os.replace(str(tmp_model), str(MODEL_PATH))
        logger.info(f"Model saved → {MODEL_PATH}")

        # ── Step 12: Save evaluation report ──────────────────────────────────
        version = datetime.now(timezone.utc).strftime("ae-v%Y%m%d-%H%M")
        report = {
            "version":         version,
            "trained_at":      datetime.now(timezone.utc).isoformat(),
            "notes":           notes,
            "dataset": {
                "total_rows":  len(df),
                "train_rows":  len(train_df),
                "test_rows":   len(test_df),
                "cutoff_date": str(cutoff_date),
                "feature_columns": AE_FEATURE_COLUMNS,
                "target":      TARGET,
            },
            "metrics": {
                "mae":  round(mae,  2),
                "rmse": round(rmse, 2),
                "r2":   round(r2,   4),
            },
            "baseline": {
                "route_mae":   baseline["route_baseline_mae"],
                "airline_mae": baseline["airline_baseline_mae"],
                "global_mean_delay": baseline["global_mean_delay"],
            },
            "verdict":         verdict,
            "airline_errors":  airline_errors[:20],
            "route_errors":    route_errors[:20],
            "error_histogram": error_hist,
            "sample_predictions": rw_sample,
            "leakage_check":   "PASSED — delay_minutes not in feature set",
            "split_method":    "time-based (no random shuffle)",
        }

        tmp_report = REPORT_PATH.with_suffix(".tmp")
        tmp_report.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        os.replace(str(tmp_report), str(REPORT_PATH))
        logger.info(f"Evaluation report saved → {REPORT_PATH}")

        # ── Step 13: Persist metrics to DB ────────────────────────────────────
        try:
            _persist_metrics(db, version, report["metrics"], report["baseline"], notes)
        except Exception as e:
            logger.warning(f"DB metrics persistence failed (non-fatal): {e}")

        logger.info("=" * 60)
        logger.info(f"  Training complete: {version}")
        logger.info(f"  MAE={mae:.2f} | Better than baseline: {better_than_baseline}")
        logger.info(f"  Verdict: {recommendation}")
        logger.info("=" * 60)

        return {
            "status":          "ok",
            "version":         version,
            "metrics":         report["metrics"],
            "baseline":        report["baseline"],
            "verdict":         verdict,
            "evaluation_path": str(REPORT_PATH),
        }

    except ValueError as e:
        logger.error(f"Training blocked: {e}")
        return {"status": "blocked", "message": str(e)}
    except Exception as e:
        logger.exception(f"Training failed: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        _train_lock.release()


def _mae_label(mae: float) -> str:
    if mae < 5:
        return "Excellent — predictions within 5 min on average"
    if mae < 15:
        return "Good — predictions within 15 min on average"
    if mae < 30:
        return "Acceptable — predictions within 30 min on average"
    return "Poor — average error exceeds 30 min; more features recommended"


def _persist_metrics(db, version: str, metrics: dict, baseline: dict, notes: str) -> None:
    from app.models.models import ModelMetrics
    db.query(ModelMetrics).filter(ModelMetrics.is_active == 1).update({"is_active": 0})
    row = ModelMetrics(
        model_version     = version,
        trained_at        = datetime.now(timezone.utc).replace(tzinfo=None),
        mae_minutes       = metrics.get("mae"),
        rmse_minutes      = metrics.get("rmse"),
        r2_score          = metrics.get("r2"),
        feature_columns   = AE_FEATURE_COLUMNS,
        hyperparams       = {"baseline": baseline},
        notes             = notes or "",
        is_active         = 1,
    )
    db.add(row)
    db.commit()
    logger.info(f"Model metrics persisted for version: {version}")


# ══════════════════════════════════════════════════════════════════════════════
# CLI entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    from app.database import SessionLocal
    _db = SessionLocal()
    try:
        result = train_ae_model(_db, notes="CLI run")
        safe_result = {k: v for k, v in result.items() if k != "evaluation_path"}
        print("\nResult:")
        print(json.dumps(safe_result, indent=2, default=str))
        if result.get("evaluation_path"):
            print(f"\nFull report: {result['evaluation_path']}")
    finally:
        _db.close()
