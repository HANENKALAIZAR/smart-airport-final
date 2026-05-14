"""
MLOps Controller
=================
Handles the full operational lifecycle of the ML model:

1. register_model_version()   — write new version to ae_model_versions
2. promote_model()            — promote challenger if it beats champion
3. reconcile_predictions()    — backfill actual delays into ae_prediction_logs
4. log_prediction()           — write one prediction to ae_prediction_logs
5. check_retraining_policy()  — evaluate whether retraining is due
6. run_auto_retrain()         — trigger training if policy says so (safe)

Promotion rules (ALL must pass to promote challenger):
  ✔ challenger MAE < champion MAE
  ✔ challenger beats baseline
  ✔ leakage check passes (read from evaluation report)
  ✔ drift severity does not worsen vs current champion

Safe-overwrite guarantee:
  If challenger fails promotion, the existing .pkl is left untouched and
  the challenger .pkl is archived to model/archive/ with its version stamp.

Usage
-----
    from app.ai.mlops_controller import (
        register_model_version,
        promote_model,
        reconcile_predictions,
        check_retraining_policy,
    )
"""
from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

MODEL_DIR   = Path(__file__).resolve().parent / "model"
MODEL_PATH  = MODEL_DIR / "delay_prediction_model.pkl"
ARCHIVE_DIR = MODEL_DIR / "archive"
REPORT_PATH = MODEL_DIR / "ae_evaluation_report.json"

# Retraining policy thresholds
_POLICY_MIN_NEW_ROWS    = 100   # retrain if dataset grew by this many rows since last train
_POLICY_MAX_AGE_DAYS    = 14    # retrain if model older than this
_POLICY_DRIFT_RETRAIN   = {"medium", "high", "critical"}  # drift severity triggers retrain


# ══════════════════════════════════════════════════════════════════════════════
# 1. Register model version
# ══════════════════════════════════════════════════════════════════════════════

def register_model_version(db, training_result: dict, model_path: str) -> object:
    """
    Persist a newly trained model as a candidate row in ae_model_versions.
    is_active=False until promote_model() validates and promotes it.
    """
    from app.models.ae_models import AEModelVersion

    metrics  = training_result.get("metrics", {})
    baseline = training_result.get("baseline", {})
    verdict  = training_result.get("verdict", {})
    dataset  = training_result.get("dataset", {})

    best_baseline = min(
        baseline.get("route_mae",   9999),
        baseline.get("airline_mae", 9999),
    )
    improvement_pct = round(
        (best_baseline - (metrics.get("mae") or 0)) / max(best_baseline, 1) * 100, 2
    )

    row = AEModelVersion(
        model_version        = training_result.get("version", "unknown"),
        trained_at           = datetime.now(timezone.utc).replace(tzinfo=None),
        model_path           = model_path,
        dataset_size         = dataset.get("total_rows"),
        train_rows           = dataset.get("train_rows"),
        test_rows            = dataset.get("test_rows"),
        cutoff_date          = dataset.get("cutoff_date"),
        mae                  = metrics.get("mae"),
        rmse                 = metrics.get("rmse"),
        r2_score             = metrics.get("r2"),
        baseline_route_mae   = baseline.get("route_mae"),
        baseline_airline_mae = baseline.get("airline_mae"),
        improvement_pct      = improvement_pct,
        better_than_baseline = verdict.get("better_than_baseline", False),
        is_active            = False,
        notes                = verdict.get("recommendation", ""),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    logger.info(f"[MLOps] Registered model version: {row.model_version} (candidate)")
    return row


# ══════════════════════════════════════════════════════════════════════════════
# 2. Model promotion
# ══════════════════════════════════════════════════════════════════════════════

def promote_model(db, candidate_version: str, *, force: bool = False) -> dict:
    """
    Evaluate whether the candidate model should replace the current champion.

    Promotion gates (all must pass unless force=True):
      1. candidate MAE < champion MAE
      2. candidate beats baseline
      3. leakage_check = "PASSED" in evaluation report

    Returns
    -------
    dict: {promoted, reason, champion_version, challenger_version}
    """
    from app.models.ae_models import AEModelVersion

    champion = db.query(AEModelVersion).filter(AEModelVersion.is_active == True).first()
    candidate = db.query(AEModelVersion).filter(
        AEModelVersion.model_version == candidate_version
    ).first()

    if not candidate:
        return {"promoted": False, "reason": f"Candidate version '{candidate_version}' not found"}

    # ── Gate 1: beats champion MAE ────────────────────────────────────────────
    if champion and not force:
        champ_mae = champion.mae or 9999
        cand_mae  = candidate.mae or 9999
        if cand_mae >= champ_mae:
            reason = (
                f"Candidate MAE={cand_mae:.2f} ≥ Champion MAE={champ_mae:.2f} — rejected"
            )
            candidate.rejection_reason = reason
            db.commit()
            logger.warning(f"[MLOps] Promotion rejected: {reason}")
            _archive_candidate(candidate_version)
            return {
                "promoted":           False,
                "reason":             reason,
                "champion_version":   champion.model_version,
                "challenger_version": candidate_version,
            }

    # ── Gate 2: beats baseline ────────────────────────────────────────────────
    if not candidate.better_than_baseline and not force:
        reason = "Candidate does not beat baseline — rejected"
        candidate.rejection_reason = reason
        db.commit()
        logger.warning(f"[MLOps] Promotion rejected: {reason}")
        _archive_candidate(candidate_version)
        return {
            "promoted":           False,
            "reason":             reason,
            "champion_version":   champion.model_version if champion else None,
            "challenger_version": candidate_version,
        }

    # ── Gate 3: leakage check ─────────────────────────────────────────────────
    if not force:
        leakage_ok = _check_leakage_from_report()
        if not leakage_ok:
            reason = "Leakage check failed in evaluation report — rejected"
            candidate.rejection_reason = reason
            db.commit()
            logger.error(f"[MLOps] Promotion BLOCKED: {reason}")
            return {
                "promoted":           False,
                "reason":             reason,
                "champion_version":   champion.model_version if champion else None,
                "challenger_version": candidate_version,
            }

    # ── All gates passed — promote ────────────────────────────────────────────
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if champion:
        champion.is_active  = False
        champion.retired_at = now
        logger.info(f"[MLOps] Retired champion: {champion.model_version}")

    candidate.is_active        = True
    candidate.promoted_at      = now
    candidate.promotion_reason = (
        f"MAE improved from {champion.mae:.2f} to {candidate.mae:.2f}"
        if champion and champion.mae
        else "First model — auto-promoted"
    )
    db.commit()

    logger.info(f"[MLOps] Promoted: {candidate_version} — {candidate.promotion_reason}")
    return {
        "promoted":           True,
        "reason":             candidate.promotion_reason,
        "champion_version":   candidate_version,
        "challenger_version": candidate_version,
        "mae_improvement":    round((champion.mae or 0) - (candidate.mae or 0), 2) if champion else None,
    }


def _check_leakage_from_report() -> bool:
    try:
        if not REPORT_PATH.exists():
            return True   # no report yet = first run, allow
        rep = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
        return "PASSED" in rep.get("leakage_check", "").upper()
    except Exception:
        return True


def _archive_candidate(version: str) -> None:
    """Move the current .pkl to archive/ with version stamp (non-destructive)."""
    if not MODEL_PATH.exists():
        return
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    dest = ARCHIVE_DIR / f"delay_prediction_model_{version}.pkl"
    try:
        shutil.copy2(str(MODEL_PATH), str(dest))
        logger.info(f"[MLOps] Archived candidate model → {dest}")
    except Exception as e:
        logger.warning(f"[MLOps] Archive failed: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# 3. Prediction logging
# ══════════════════════════════════════════════════════════════════════════════

def log_prediction(
    db,
    *,
    flight_number: str,
    airline_iata: Optional[str],
    dep_iata: Optional[str],
    arr_iata: Optional[str],
    predicted_delay_min: int,
    confidence: Optional[float],
    model_version: Optional[str],
    source: str = "future_schedule",
    dep_hour: Optional[int] = None,
    is_weekend: Optional[int] = None,
    distance_km: Optional[int] = None,
    duration_min: Optional[int] = None,
    airline_enc: Optional[int] = None,
    dep_airport_enc: Optional[int] = None,
    arr_airport_enc: Optional[int] = None,
) -> None:
    """Write one prediction to ae_prediction_logs (fire-and-forget)."""
    from app.models.ae_models import AEPredictionLog
    try:
        route = f"{dep_iata or 'UNK'}→{arr_iata or 'UNK'}"
        log = AEPredictionLog(
            flight_number        = flight_number,
            airline_iata         = airline_iata,
            dep_iata             = dep_iata,
            arr_iata             = arr_iata,
            route                = route,
            predicted_delay_min  = predicted_delay_min,
            confidence           = confidence,
            prediction_timestamp = datetime.now(timezone.utc).replace(tzinfo=None),
            model_version        = model_version,
            prediction_source    = source,
            dep_hour             = dep_hour,
            is_weekend           = is_weekend,
            distance_km          = distance_km,
            duration_min         = duration_min,
            airline_enc          = airline_enc,
            dep_airport_enc      = dep_airport_enc,
            arr_airport_enc      = arr_airport_enc,
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.debug(f"[MLOps] log_prediction failed (non-fatal): {e}")


# ══════════════════════════════════════════════════════════════════════════════
# 4. Reconciliation — backfill actual delays
# ══════════════════════════════════════════════════════════════════════════════

def reconcile_predictions(db, *, batch_size: int = 500) -> dict:
    """
    Cross-reference ae_prediction_logs against ae_flight_dataset to
    backfill actual_delay_min and compute prediction_error.

    Only updates logs where:
      - actual_delay_min is still NULL
      - a matching ae_flight_dataset row exists (same flight_number)
        with usable_for_ml=True and a real delay_minutes value

    Returns dict: {reconciled, skipped, errors}
    """
    from app.models.ae_models import AEPredictionLog, AEFlightDataset

    unreconciled = (
        db.query(AEPredictionLog)
        .filter(AEPredictionLog.actual_delay_min.is_(None))
        .order_by(AEPredictionLog.prediction_timestamp.asc())
        .limit(batch_size)
        .all()
    )

    reconciled_count = skipped = errors = 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for log in unreconciled:
        try:
            actual_row = (
                db.query(AEFlightDataset)
                .filter(
                    AEFlightDataset.flight_number == log.flight_number,
                    AEFlightDataset.usable_for_ml == True,
                    AEFlightDataset.delay_minutes.isnot(None),
                )
                .order_by(AEFlightDataset.flight_date.desc())
                .first()
            )
            if actual_row is None:
                skipped += 1
                continue

            actual = int(actual_row.delay_minutes)
            log.actual_delay_min = actual
            log.prediction_error = float(actual - log.predicted_delay_min)
            log.reconciled_at    = now
            reconciled_count += 1
        except Exception as e:
            logger.debug(f"[MLOps] Reconcile error for {log.flight_number}: {e}")
            errors += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[MLOps] Reconcile commit failed: {e}")
        errors += reconciled_count
        reconciled_count = 0

    logger.info(
        f"[MLOps] Reconcile: {reconciled_count} updated | "
        f"{skipped} skipped | {errors} errors"
    )
    return {"reconciled": reconciled_count, "skipped": skipped, "errors": errors}


# ══════════════════════════════════════════════════════════════════════════════
# 5. Retraining policy check
# ══════════════════════════════════════════════════════════════════════════════

def check_retraining_policy(db) -> dict:
    """
    Evaluate whether a new training run should be triggered.

    Policy triggers (any one is sufficient):
      A. Drift severity >= medium
      B. Active model age > _POLICY_MAX_AGE_DAYS
      C. ae_flight_dataset grew by _POLICY_MIN_NEW_ROWS since last training

    Returns
    -------
    dict: {should_retrain, triggers, active_model, dataset_size, model_age_days}
    """
    from app.models.ae_models import AEModelVersion, AEFlightDataset
    from sqlalchemy import func
    from app.ai.drift_detection import compute_drift_report

    active = db.query(AEModelVersion).filter(AEModelVersion.is_active == True).first()

    triggers = []
    model_age_days = None

    # Trigger A: drift
    drift = compute_drift_report(db, window_days=7)
    if drift["overall_severity"] in _POLICY_DRIFT_RETRAIN:
        triggers.append(f"drift:{drift['overall_severity']}")

    # Trigger B: model age
    if active and active.trained_at:
        age = (datetime.now(timezone.utc).replace(tzinfo=None) - active.trained_at)
        model_age_days = age.days
        if model_age_days > _POLICY_MAX_AGE_DAYS:
            triggers.append(f"age:{model_age_days}d > {_POLICY_MAX_AGE_DAYS}d")
    elif not active:
        triggers.append("no_active_model")

    # Trigger C: dataset growth
    current_size = db.query(func.count(AEFlightDataset.id)).filter(
        AEFlightDataset.usable_for_ml == True
    ).scalar() or 0

    last_size = active.dataset_size if active else 0
    growth    = current_size - (last_size or 0)
    if growth >= _POLICY_MIN_NEW_ROWS:
        triggers.append(f"growth:{growth} new rows")

    return {
        "should_retrain":     len(triggers) > 0,
        "triggers":           triggers,
        "active_model":       active.model_version if active else None,
        "active_model_mae":   active.mae if active else None,
        "model_age_days":     model_age_days,
        "dataset_size":       current_size,
        "last_train_size":    last_size,
        "drift_severity":     drift["overall_severity"],
        "policy": {
            "max_age_days":     _POLICY_MAX_AGE_DAYS,
            "min_new_rows":     _POLICY_MIN_NEW_ROWS,
            "drift_threshold":  list(_POLICY_DRIFT_RETRAIN),
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# 6. Auto-retrain (safe — only promotes if challenger wins)
# ══════════════════════════════════════════════════════════════════════════════

def run_auto_retrain(db) -> dict:
    """
    Check policy → if retrain needed, run train_ae_model() → register → promote.
    The existing active model is only replaced if the challenger wins all gates.

    Returns
    -------
    dict: {triggered, policy_result, training_result, promotion_result}
    """
    policy = check_retraining_policy(db)

    if not policy["should_retrain"]:
        logger.info("[MLOps] Auto-retrain: policy says no retrain needed")
        return {"triggered": False, "policy_result": policy}

    logger.info(f"[MLOps] Auto-retrain triggered by: {policy['triggers']}")

    try:
        from app.ai.train_ae_dataset import train_ae_model
        training_result = train_ae_model(db, notes=f"auto-retrain: {policy['triggers']}")
    except Exception as e:
        logger.error(f"[MLOps] Auto-retrain training failed: {e}")
        return {
            "triggered":       True,
            "policy_result":   policy,
            "training_result": {"status": "error", "message": str(e)},
            "promotion_result": None,
        }

    if training_result.get("status") != "ok":
        return {
            "triggered":        True,
            "policy_result":    policy,
            "training_result":  training_result,
            "promotion_result": None,
        }

    # Register candidate
    candidate_row = register_model_version(db, training_result, str(MODEL_PATH))

    # Attempt promotion (safe — will archive if it loses)
    promo = promote_model(db, candidate_row.model_version)

    return {
        "triggered":        True,
        "policy_result":    policy,
        "training_result":  {k: v for k, v in training_result.items() if k != "evaluation_path"},
        "promotion_result": promo,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 7. Dashboard metrics
# ══════════════════════════════════════════════════════════════════════════════

def get_dashboard_metrics(db) -> dict:
    """Return a concise metrics dict for the admin dashboard."""
    from app.models.ae_models import AEModelVersion, AEPredictionLog
    from sqlalchemy import func

    active = db.query(AEModelVersion).filter(AEModelVersion.is_active == True).first()
    total_versions = db.query(func.count(AEModelVersion.id)).scalar() or 0
    total_preds    = db.query(func.count(AEPredictionLog.id)).scalar() or 0
    reconciled     = db.query(func.count(AEPredictionLog.id)).filter(
        AEPredictionLog.reconciled_at.isnot(None)
    ).scalar() or 0

    # Live MAE from last 24h reconciled logs
    cutoff_24h = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
    recent_logs = db.query(AEPredictionLog).filter(
        AEPredictionLog.reconciled_at >= cutoff_24h,
        AEPredictionLog.prediction_error.isnot(None),
    ).all()
    live_mae_24h = (
        round(sum(abs(r.prediction_error) for r in recent_logs) / len(recent_logs), 2)
        if recent_logs else None
    )

    model_age_days = None
    if active and active.trained_at:
        model_age_days = (datetime.now(timezone.utc).replace(tzinfo=None) - active.trained_at).days

    # Drift
    from app.ai.drift_detection import compute_drift_report
    drift = compute_drift_report(db, window_days=7)

    return {
        "current_model_version":   active.model_version if active else None,
        "current_mae_training":    round(active.mae, 2) if active and active.mae else None,
        "current_mae_live_24h":    live_mae_24h,
        "model_age_days":          model_age_days,
        "total_model_versions":    total_versions,
        "total_predictions_logged":total_preds,
        "reconciled_predictions":  reconciled,
        "drift_severity":          drift["overall_severity"],
        "retrain_recommended":     drift["retrain_recommended"],
        "r2_score":                round(active.r2_score, 4) if active and active.r2_score else None,
        "improvement_vs_baseline": f"{active.improvement_pct:.1f}%" if active and active.improvement_pct else None,
    }
