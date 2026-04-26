"""
Smart Airport Operations — Train from PostgreSQL (v10)
=======================================================
Replaces the CSV-based train_model.py.

Loads features from the flight_features table, performs a time-based
train/validation split, trains XGBoost classifier + regressor,
computes SHAP explainer, archives previous artifacts, and records
metrics in model_metrics.

Usage:
    cd backend
    python -m app.ai.train_from_db

Or via API:
    POST /api/ml/train  (super_admin JWT required)
"""

import json
import logging
import os
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
import shap
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix,
    mean_absolute_error, mean_squared_error, r2_score,
)
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────
MODEL_DIR    = Path(__file__).resolve().parent / "model"
ARCHIVE_DIR  = MODEL_DIR / "archive"

CLASSIFIER_PATH  = MODEL_DIR / "delay_classifier.json"
REGRESSOR_PATH   = MODEL_DIR / "delay_regressor.json"
EXPLAINER_PATH   = MODEL_DIR / "shap_explainer.pkl"
FEAT_COLS_PATH   = MODEL_DIR / "feature_columns.json"

from app.ai.ml_config import FEATURE_COLUMNS, CLASSIFIER_PARAMS, REGRESSOR_PARAMS

TARGET_CLASS = "is_delayed"
TARGET_REG   = "delay_minutes"

# Thread-lock — prevents concurrent training runs
_train_lock = threading.Lock()


# ── Data loading ──────────────────────────────────────────────────────────

def _load_from_db(db: Session) -> pd.DataFrame:
    """Load all labelled flight_features rows as a DataFrame."""
    from app.models.models import FlightFeature
    rows = (
        db.query(FlightFeature)
        .filter(FlightFeature.is_delayed.isnot(None))
        .order_by(FlightFeature.created_at.asc())
        .all()
    )
    records = []
    for r in rows:
        records.append({col: getattr(r, col, None) for col in FEATURE_COLUMNS + [TARGET_CLASS, TARGET_REG, "created_at"]})
    return pd.DataFrame(records)


# ── Time-based split ──────────────────────────────────────────────────────

def _time_split(df: pd.DataFrame, val_fraction: float = 0.20):
    """
    Split by time — training = earliest (1-val_fraction), validation = latest val_fraction.
    No shuffling — prevents temporal leakage.
    """
    df = df.sort_values("created_at").reset_index(drop=True)
    cutoff_idx = int(len(df) * (1 - val_fraction))
    cutoff_date = df.iloc[cutoff_idx]["created_at"]
    train = df.iloc[:cutoff_idx]
    val   = df.iloc[cutoff_idx:]
    return train, val, cutoff_date


# ── Training ──────────────────────────────────────────────────────────────

def _train_classifier(X_train, X_val, y_train, y_val):
    pos = int(y_train.sum())
    neg = len(y_train) - pos
    scale = max(neg / max(pos, 1), 1)

    model = xgb.XGBClassifier(
        **CLASSIFIER_PARAMS,
        scale_pos_weight=scale,
        use_label_encoder=False,
        enable_categorical=False,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    return model


def _train_regressor(X_train, X_val, y_train, y_val):
    mask_tr = y_train > 0
    mask_va = y_val   > 0
    if mask_tr.sum() < 10:
        logger.warning("Not enough delayed flights for regressor training — skipping")
        return None

    model = xgb.XGBRegressor(**REGRESSOR_PARAMS)
    model.fit(
        X_train[mask_tr], y_train[mask_tr],
        eval_set=[(X_val[mask_va], y_val[mask_va])] if mask_va.sum() > 0 else None,
        verbose=False,
    )
    return model


# ── Atomic save ───────────────────────────────────────────────────────────

def _atomic_save(src_path: Path, data, kind: str):
    """Write to .tmp then os.replace() for atomic swap."""
    tmp = src_path.with_suffix(".tmp")
    if kind == "xgb":
        data.save_model(str(tmp))
    elif kind == "pkl":
        joblib.dump(data, str(tmp))
    elif kind == "json":
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(src_path))


# ── Archive previous artifacts ────────────────────────────────────────────

def _archive_previous(version: str):
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    archive = ARCHIVE_DIR / version
    archive.mkdir(exist_ok=True)
    for path in [CLASSIFIER_PATH, REGRESSOR_PATH, EXPLAINER_PATH, FEAT_COLS_PATH]:
        if path.exists():
            shutil.copy2(str(path), str(archive / path.name))
    logger.info(f"Previous artifacts archived to {archive}")


# ── Metrics persistence ───────────────────────────────────────────────────

def _next_version(db: Session) -> str:
    from app.models.models import ModelMetrics
    count = db.query(ModelMetrics).count()
    date  = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"xgboost-v{count + 1}-{date}"


def _persist_metrics(db: Session, version: str, metrics: dict, notes: str):
    from app.models.models import ModelMetrics
    # Deactivate all previous
    db.query(ModelMetrics).filter(ModelMetrics.is_active == 1).update({"is_active": 0})
    row = ModelMetrics(
        model_version     = version,
        trained_at        = datetime.now(timezone.utc).replace(tzinfo=None),
        n_train_samples   = metrics.get("n_train"),
        n_test_samples    = metrics.get("n_val"),
        train_cutoff_date = metrics.get("cutoff_date"),
        accuracy          = metrics.get("accuracy"),
        precision_score   = metrics.get("precision"),
        recall            = metrics.get("recall"),
        f1                = metrics.get("f1"),
        roc_auc           = metrics.get("roc_auc"),
        mae_minutes       = metrics.get("mae"),
        rmse_minutes      = metrics.get("rmse"),
        r2_score          = metrics.get("r2"),
        feature_columns   = FEATURE_COLUMNS,
        hyperparams       = metrics.get("hyperparams"),
        notes             = notes or "",
        is_active         = 1,
    )
    db.add(row)
    db.commit()
    logger.info(f"Model metrics persisted for version: {version}")


# ── Main entry point ──────────────────────────────────────────────────────

def train_from_db(db: Session, notes: str = "") -> dict:
    """
    Full training run: load → split → train → SHAP → archive → save → metrics.

    Returns:
        dict with 'version', 'metrics', 'status'
    """
    from app.config import settings

    if not _train_lock.acquire(blocking=False):
        msg = "Training already in progress — skipping concurrent request"
        logger.warning(msg)
        return {"status": "already_running", "message": msg}

    try:
        logger.info("=" * 55)
        logger.info("  Train from DB — starting")
        logger.info("=" * 55)

        # ── Load ──────────────────────────────────────────────
        df = _load_from_db(db)
        logger.info(f"Loaded {len(df)} labelled rows from flight_features")

        if len(df) < settings.MIN_TRAIN_SAMPLES:
            msg = (f"Insufficient data: {len(df)} rows < MIN_TRAIN_SAMPLES={settings.MIN_TRAIN_SAMPLES}. "
                   f"Collect more flights before training.")
            logger.warning(msg)
            return {"status": "insufficient_data", "message": msg, "rows": len(df)}

        # ── Prepare features ──────────────────────────────────
        # Fill NaN for new weather columns (flights collected before OWM integration)
        for col in FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # Clip extreme delay outliers at 99th pct
        p99 = df[TARGET_REG].quantile(0.99)
        df[TARGET_REG] = df[TARGET_REG].clip(upper=p99)

        X = df[FEATURE_COLUMNS].values.astype(np.float32)
        y_cls = df[TARGET_CLASS].values.astype(int)
        y_reg = df[TARGET_REG].values.astype(np.float32)

        # ── Time-based split ──────────────────────────────────
        train_df, val_df, cutoff = _time_split(df)
        cutoff_idx = len(train_df)

        X_tr, X_va   = X[:cutoff_idx],    X[cutoff_idx:]
        y_cls_tr, y_cls_va = y_cls[:cutoff_idx], y_cls[cutoff_idx:]
        y_reg_tr, y_reg_va = y_reg[:cutoff_idx], y_reg[cutoff_idx:]

        logger.info(
            f"Split: train={len(X_tr)} ({y_cls_tr.mean()*100:.1f}% delayed) | "
            f"val={len(X_va)} ({y_cls_va.mean()*100:.1f}% delayed)"
        )

        # ── Train ─────────────────────────────────────────────
        classifier = _train_classifier(X_tr, X_va, y_cls_tr, y_cls_va)
        regressor  = _train_regressor(X_tr, X_va, y_reg_tr, y_reg_va)

        # ── Evaluate ──────────────────────────────────────────
        y_pred     = classifier.predict(X_va)
        y_proba    = classifier.predict_proba(X_va)[:, 1]

        cm = confusion_matrix(y_cls_va, y_pred).tolist()
        metrics = {
            "n_train":    len(X_tr),
            "n_val":      len(X_va),
            "cutoff_date": cutoff.date() if hasattr(cutoff, "date") else None,
            "accuracy":   round(accuracy_score(y_cls_va, y_pred), 4),
            "precision":  round(precision_score(y_cls_va, y_pred, zero_division=0), 4),
            "recall":     round(recall_score(y_cls_va, y_pred, zero_division=0), 4),
            "f1":         round(f1_score(y_cls_va, y_pred, zero_division=0), 4),
            "roc_auc":    round(roc_auc_score(y_cls_va, y_proba) if len(set(y_cls_va)) > 1 else 0.5, 4),
            "hyperparams": {"confusion_matrix": cm},
        }

        if regressor is not None:
            mask_va = y_reg_va > 0
            if mask_va.sum() > 0:
                y_reg_pred = np.maximum(regressor.predict(X_va[mask_va]), 0)
                metrics.update({
                    "mae":  round(float(mean_absolute_error(y_reg_va[mask_va], y_reg_pred)), 2),
                    "rmse": round(float(np.sqrt(mean_squared_error(y_reg_va[mask_va], y_reg_pred))), 2),
                    "r2":   round(float(r2_score(y_reg_va[mask_va], y_reg_pred)), 4),
                })

        logger.info(
            f"Eval → acc={metrics['accuracy']} prec={metrics['precision']} "
            f"rec={metrics['recall']} f1={metrics['f1']} auc={metrics['roc_auc']}"
        )

        # ── SHAP ──────────────────────────────────────────────
        logger.info("Building SHAP explainer...")
        explainer = shap.TreeExplainer(classifier)

        # ── Archive & save ────────────────────────────────────
        version = _next_version(db)
        _archive_previous(version)
        MODEL_DIR.mkdir(parents=True, exist_ok=True)

        _atomic_save(CLASSIFIER_PATH, classifier, "xgb")
        logger.info(f"Classifier saved: {CLASSIFIER_PATH}")

        if regressor is not None:
            _atomic_save(REGRESSOR_PATH, regressor, "xgb")
            logger.info(f"Regressor saved: {REGRESSOR_PATH}")

        _atomic_save(EXPLAINER_PATH, explainer, "pkl")
        logger.info(f"SHAP explainer saved: {EXPLAINER_PATH}")

        _atomic_save(FEAT_COLS_PATH, FEATURE_COLUMNS, "json")
        logger.info(f"Feature columns saved: {FEAT_COLS_PATH}")

        # ── Persist metrics ───────────────────────────────────
        _persist_metrics(db, version, metrics, notes)

        # ── Hot-reload prediction service ─────────────────────
        try:
            from app.services.prediction_service import load_model
            load_model()
            logger.info("Prediction service hot-reloaded with new model")
        except Exception as e:
            logger.warning(f"Hot-reload failed (server will use old model until restart): {e}")

        logger.info("=" * 55)
        logger.info(f"  Training complete: {version}")
        logger.info("=" * 55)

        return {"status": "ok", "version": version, "metrics": metrics}

    except Exception as e:
        logger.exception(f"Training failed: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        _train_lock.release()


# ── CLI entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    from app.database import SessionLocal
    _db = SessionLocal()
    try:
        result = train_from_db(_db, notes="CLI run")
        print("\nResult:", json.dumps(result, indent=2, default=str))
    finally:
        _db.close()
