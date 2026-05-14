"""
Drift Detection Engine
=======================
Monitors the active ML model's prediction quality over time using
ae_prediction_logs (the long-term monitoring dataset).

Detection strategies
--------------------
1. MAE Drift       — rolling MAE on reconciled logs > 20% above training MAE
2. Distribution    — mean/std of predicted delays shift vs training baseline
3. Route Drift     — per-route MAE worsens vs ae_aviation_stats baseline
4. Airline Drift   — per-airline error rate grows vs training stats
5. Volume Drop     — prediction frequency drops (missing predictions alert)

Severity levels: none → low → medium → high → critical
Retraining recommended at: medium+ drift for >2 consecutive windows

Usage
-----
    from app.ai.drift_detection import compute_drift_report
    report = compute_drift_report(db)
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# ── Thresholds ─────────────────────────────────────────────────────────────────
_MAE_DRIFT_THRESHOLD   = 0.20   # 20% MAE degradation → medium drift
_MAE_CRITICAL          = 0.50   # 50% → critical
_DIST_SHIFT_THRESHOLD  = 0.25   # 25% mean prediction shift
_MIN_RECONCILED_SAMPLE = 10     # minimum logs needed to compute drift
_WINDOW_DAYS           = 7      # rolling window (days)
_ROUTE_DRIFT_THRESHOLD = 0.30   # 30% route MAE increase → flag


def _severity(ratio: float) -> str:
    """Convert a drift ratio to a severity label."""
    if ratio <= 0:
        return "none"
    if ratio < 0.10:
        return "low"
    if ratio < 0.20:
        return "medium"
    if ratio < 0.50:
        return "high"
    return "critical"


def _get_active_model(db) -> Optional[object]:
    from app.models.ae_models import AEModelVersion
    return (
        db.query(AEModelVersion)
        .filter(AEModelVersion.is_active == True)
        .first()
    )


# ══════════════════════════════════════════════════════════════════════════════
# 1. MAE Drift
# ══════════════════════════════════════════════════════════════════════════════

def _mae_drift(db, training_mae: float, window_days: int) -> dict:
    from app.models.ae_models import AEPredictionLog
    from sqlalchemy import func

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=window_days)

    reconciled = (
        db.query(AEPredictionLog)
        .filter(
            AEPredictionLog.reconciled_at.isnot(None),
            AEPredictionLog.reconciled_at >= cutoff,
            AEPredictionLog.prediction_error.isnot(None),
        )
        .all()
    )

    if len(reconciled) < _MIN_RECONCILED_SAMPLE:
        return {
            "type":       "mae_drift",
            "severity":   "none",
            "detail":     f"Insufficient reconciled logs: {len(reconciled)} < {_MIN_RECONCILED_SAMPLE}",
            "live_mae":   None,
            "training_mae": training_mae,
            "drift_ratio": None,
            "sample_n":   len(reconciled),
        }

    errors = [abs(r.prediction_error) for r in reconciled]
    live_mae = sum(errors) / len(errors)
    ratio = (live_mae - training_mae) / max(training_mae, 1.0)
    sev   = _severity(ratio)

    return {
        "type":         "mae_drift",
        "severity":     sev,
        "live_mae":     round(live_mae, 2),
        "training_mae": round(training_mae, 2),
        "drift_ratio":  round(ratio, 4),
        "sample_n":     len(reconciled),
        "window_days":  window_days,
        "detail":       f"Live MAE={live_mae:.2f} vs training MAE={training_mae:.2f} ({ratio*100:+.1f}%)",
    }


# ══════════════════════════════════════════════════════════════════════════════
# 2. Prediction Distribution Shift
# ══════════════════════════════════════════════════════════════════════════════

def _distribution_drift(db, training_global_mean: float, window_days: int) -> dict:
    from app.models.ae_models import AEPredictionLog
    from sqlalchemy import func

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=window_days)
    rows = (
        db.query(AEPredictionLog)
        .filter(AEPredictionLog.prediction_timestamp >= cutoff)
        .all()
    )

    if len(rows) < _MIN_RECONCILED_SAMPLE:
        return {
            "type": "distribution_drift", "severity": "none",
            "detail": f"Insufficient logs: {len(rows)}", "sample_n": len(rows),
        }

    preds = [r.predicted_delay_min for r in rows]
    live_mean = sum(preds) / len(preds)
    live_std  = math.sqrt(sum((p - live_mean) ** 2 for p in preds) / len(preds))
    ratio = abs(live_mean - training_global_mean) / max(training_global_mean, 1.0)
    sev   = _severity(ratio)

    return {
        "type":           "distribution_drift",
        "severity":       sev,
        "live_mean_pred": round(live_mean, 2),
        "training_mean":  round(training_global_mean, 2),
        "live_std":       round(live_std, 2),
        "drift_ratio":    round(ratio, 4),
        "sample_n":       len(rows),
        "window_days":    window_days,
        "detail": (
            f"Live mean prediction={live_mean:.1f} min vs "
            f"training mean={training_global_mean:.1f} min ({ratio*100:+.1f}%)"
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# 3. Route Drift
# ══════════════════════════════════════════════════════════════════════════════

def _route_drift(db, window_days: int) -> dict:
    from app.models.ae_models import AEPredictionLog, AEAviationStats

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=window_days)

    # Load historical route baselines
    stats = {
        s.entity_key: s.avg_delay_min
        for s in db.query(AEAviationStats).filter(AEAviationStats.stat_type == "route").all()
    }

    if not stats:
        return {"type": "route_drift", "severity": "none", "detail": "No route stats computed yet"}

    # Group recent reconciled logs by route
    logs = (
        db.query(AEPredictionLog)
        .filter(
            AEPredictionLog.reconciled_at.isnot(None),
            AEPredictionLog.reconciled_at >= cutoff,
            AEPredictionLog.route.isnot(None),
            AEPredictionLog.prediction_error.isnot(None),
        )
        .all()
    )

    route_errors: dict[str, list[float]] = {}
    for log in logs:
        route_errors.setdefault(log.route, []).append(abs(log.prediction_error))

    drifted_routes = []
    for route, errors in route_errors.items():
        if len(errors) < 3:
            continue
        live_mae  = sum(errors) / len(errors)
        hist_mean = stats.get(route)
        if hist_mean is None or hist_mean <= 0:
            continue
        ratio = (live_mae - hist_mean) / hist_mean
        if ratio > _ROUTE_DRIFT_THRESHOLD:
            drifted_routes.append({
                "route":     route,
                "live_mae":  round(live_mae, 2),
                "hist_mean": round(hist_mean, 2),
                "drift_pct": round(ratio * 100, 1),
                "n":         len(errors),
            })

    sev = "critical" if len(drifted_routes) > 5 else \
          "high"     if len(drifted_routes) > 2 else \
          "medium"   if len(drifted_routes) > 0 else "none"

    return {
        "type":           "route_drift",
        "severity":       sev,
        "drifted_routes": sorted(drifted_routes, key=lambda x: x["drift_pct"], reverse=True)[:10],
        "total_drifted":  len(drifted_routes),
        "routes_checked": len(route_errors),
        "window_days":    window_days,
        "detail":         f"{len(drifted_routes)} routes drifted > {_ROUTE_DRIFT_THRESHOLD*100:.0f}%",
    }


# ══════════════════════════════════════════════════════════════════════════════
# 4. Volume / Prediction Gap Alert
# ══════════════════════════════════════════════════════════════════════════════

def _volume_check(db, window_days: int) -> dict:
    from app.models.ae_models import AEPredictionLog
    from sqlalchemy import func

    now    = datetime.now(timezone.utc).replace(tzinfo=None)
    recent = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=window_days)
    older  = recent - timedelta(days=window_days)

    recent_count = db.query(func.count(AEPredictionLog.id)).filter(
        AEPredictionLog.prediction_timestamp >= recent,
        AEPredictionLog.prediction_timestamp <= now,
    ).scalar() or 0

    older_count = db.query(func.count(AEPredictionLog.id)).filter(
        AEPredictionLog.prediction_timestamp >= older,
        AEPredictionLog.prediction_timestamp < recent,
    ).scalar() or 0

    if older_count == 0:
        return {
            "type": "volume_check", "severity": "none",
            "detail": "No older window data for comparison",
            "recent_count": recent_count, "older_count": older_count,
        }

    ratio = (older_count - recent_count) / max(older_count, 1)
    sev   = "critical" if ratio > 0.70 else \
            "high"     if ratio > 0.50 else \
            "medium"   if ratio > 0.30 else \
            "low"      if ratio > 0.10 else "none"

    return {
        "type":          "volume_check",
        "severity":      sev,
        "recent_count":  recent_count,
        "older_count":   older_count,
        "drop_pct":      round(ratio * 100, 1),
        "window_days":   window_days,
        "detail":        f"Prediction volume: {recent_count} (recent) vs {older_count} (previous window)",
    }


# ══════════════════════════════════════════════════════════════════════════════
# 5. Airline Reliability Drift
# ══════════════════════════════════════════════════════════════════════════════

def _airline_drift(db, window_days: int) -> dict:
    from app.models.ae_models import AEPredictionLog, AEAviationStats

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=window_days)

    stats = {
        s.entity_key: s.delay_rate
        for s in db.query(AEAviationStats).filter(AEAviationStats.stat_type == "airline").all()
    }
    if not stats:
        return {"type": "airline_drift", "severity": "none", "detail": "No airline stats computed yet"}

    logs = (
        db.query(AEPredictionLog)
        .filter(
            AEPredictionLog.reconciled_at.isnot(None),
            AEPredictionLog.reconciled_at >= cutoff,
            AEPredictionLog.airline_iata.isnot(None),
            AEPredictionLog.actual_delay_min.isnot(None),
        )
        .all()
    )

    airline_actuals: dict[str, list[int]] = {}
    for log in logs:
        airline_actuals.setdefault(log.airline_iata, []).append(log.actual_delay_min or 0)

    drifted_airlines = []
    for al, delays in airline_actuals.items():
        if len(delays) < 3:
            continue
        live_delay_rate = sum(1 for d in delays if d > 15) / len(delays)
        hist_rate = stats.get(al)
        if hist_rate is None:
            continue
        delta = abs(live_delay_rate - hist_rate)
        if delta > 0.15:  # >15pp shift in delay rate
            drifted_airlines.append({
                "airline":          al,
                "live_delay_rate":  round(live_delay_rate, 3),
                "hist_delay_rate":  round(hist_rate, 3),
                "delta":            round(delta, 3),
                "n":                len(delays),
            })

    sev = "high"   if len(drifted_airlines) > 3 else \
          "medium" if len(drifted_airlines) > 1 else \
          "low"    if len(drifted_airlines) > 0 else "none"

    return {
        "type":             "airline_drift",
        "severity":         sev,
        "drifted_airlines": sorted(drifted_airlines, key=lambda x: x["delta"], reverse=True),
        "total_drifted":    len(drifted_airlines),
        "window_days":      window_days,
        "detail":           f"{len(drifted_airlines)} airlines with delay rate shift > 15pp",
    }


# ══════════════════════════════════════════════════════════════════════════════
# Full drift report
# ══════════════════════════════════════════════════════════════════════════════

_SEVERITY_ORDER = {"none": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def compute_drift_report(db, window_days: int = 7) -> dict:
    """
    Run all 5 drift detectors and return a consolidated report.

    Returns
    -------
    dict with keys:
        overall_severity, retrain_recommended, checks, computed_at,
        active_model_version, training_mae, sample_window_days
    """
    active = _get_active_model(db)
    training_mae  = float(active.mae or 0)  if active else 0.0
    training_mean = 0.0  # default; we pull from evaluation report if available

    # Try to get global mean from evaluation report
    try:
        import json
        from pathlib import Path
        report_path = Path(__file__).resolve().parent / "model" / "ae_evaluation_report.json"
        if report_path.exists():
            rep = json.loads(report_path.read_text(encoding="utf-8"))
            training_mean = float(rep.get("baseline", {}).get("global_mean_delay", 0))
            if training_mae == 0:
                training_mae = float(rep.get("metrics", {}).get("mae", 0))
    except Exception:
        pass

    checks = [
        _mae_drift(db, training_mae, window_days),
        _distribution_drift(db, training_mean, window_days),
        _route_drift(db, window_days),
        _airline_drift(db, window_days),
        _volume_check(db, window_days),
    ]

    # Overall severity = max across all checks
    max_sev = max(checks, key=lambda c: _SEVERITY_ORDER.get(c["severity"], 0))["severity"]
    retrain_recommended = _SEVERITY_ORDER.get(max_sev, 0) >= _SEVERITY_ORDER["medium"]

    return {
        "computed_at":           datetime.now(timezone.utc).isoformat(),
        "active_model_version":  active.model_version if active else None,
        "training_mae":          round(training_mae, 2),
        "sample_window_days":    window_days,
        "overall_severity":      max_sev,
        "retrain_recommended":   retrain_recommended,
        "checks":                checks,
        "summary": (
            f"Drift severity: {max_sev.upper()}. "
            + ("Retraining recommended." if retrain_recommended else "Model stable.")
        ),
    }
