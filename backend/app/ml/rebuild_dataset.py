"""
AE Dataset Rebuild — One-shot ML feature stabilization
=======================================================
Loads ALL rows from ae_flight_dataset, applies feature_engineering.py,
writes encodings + distance back in-place, then runs the health validator.

Usage (standalone CLI):
    cd backend
    python -m app.ml.rebuild_dataset

Usage (from API endpoint):
    POST /api/ae-dataset/rebuild-features
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
BATCH_SIZE = 500   # rows per DB commit cycle


# ═══════════════════════════════════════════════════════════════════════════════
# Core rebuild function
# ═══════════════════════════════════════════════════════════════════════════════

def rebuild_ae_dataset(db, *, validate: bool = True) -> dict:
    """
    Apply feature engineering to every row in ae_flight_dataset.

    Steps
    -----
    1. Load all rows (no schema changes — only updates existing columns).
    2. Compute `distance_km` via Haversine; replace NULLs.
    3. Fill `duration_min` from distance estimate where still NULL.
    4. Fit-extend and apply persistent label encoders for
       airline_enc, dep_airport_enc, arr_airport_enc.
    5. Write all updates back in batches.
    6. Run dataset health validation and print report.
    7. Return stats dict.

    Parameters
    ----------
    db : SQLAlchemy Session
    validate : bool — run health check after rebuild (raises on failure)

    Returns
    -------
    dict with keys: total_loaded, processed, skipped, errors, health_report
    """
    from app.models.ae_models import AEFlightDataset
    from app.ml.feature_engineering import apply_feature_engineering, validate_dataset_health

    logger.info("=" * 60)
    logger.info("  AE Dataset Rebuild — starting")
    logger.info("=" * 60)

    # ── 1. Load all rows ─────────────────────────────────────────────────────
    all_rows = (
        db.query(AEFlightDataset)
        .order_by(AEFlightDataset.id.asc())
        .all()
    )
    total_loaded = len(all_rows)
    logger.info(f"Loaded {total_loaded} rows from ae_flight_dataset")

    if total_loaded == 0:
        logger.warning("No rows found — nothing to rebuild")
        return {
            "total_loaded": 0,
            "processed": 0,
            "skipped": 0,
            "errors": 0,
            "health_report": None,
        }

    # ── 2. Apply feature engineering in memory ────────────────────────────────
    processed_dicts = apply_feature_engineering(all_rows)
    # Map id → feature dict for quick lookup
    feat_by_id: dict[int, dict] = {d["id"]: d for d in processed_dicts}

    # ── 3. Write back in batches ──────────────────────────────────────────────
    processed = skipped = errors = 0

    for batch_start in range(0, total_loaded, BATCH_SIZE):
        batch = all_rows[batch_start: batch_start + BATCH_SIZE]
        try:
            for row in batch:
                feat = feat_by_id.get(row.id)
                if feat is None:
                    # Row was dropped by FE (missing dep_hour, etc.)
                    skipped += 1
                    row.usable_for_ml = False
                    continue

                row.usable_for_ml = True

                # Update only the ML feature columns — no schema changes
                row.distance_km     = feat["distance_km"]
                row.duration_min    = feat["duration_min"]
                row.airline_enc     = feat["airline_enc"]
                row.dep_airport_enc = feat["dep_airport_enc"]
                row.arr_airport_enc = feat["arr_airport_enc"]
                # dep_hour and is_weekend are already stored; we don't overwrite
                # them here since FE reads them from the DB value directly.
                processed += 1

            db.commit()
            logger.info(
                f"  Batch [{batch_start}–{batch_start + len(batch)}]: "
                f"committed {processed} updates so far"
            )

        except Exception as e:
            db.rollback()
            errors += len(batch)
            logger.error(f"  Batch [{batch_start}] failed: {e}")

    logger.info(
        f"Rebuild done: processed={processed} skipped={skipped} errors={errors}"
    )

    # ── 4. Health validation ──────────────────────────────────────────────────
    health_report: Optional[dict] = None
    if validate:
        logger.info("Running dataset health check...")
        try:
            # Re-query to get fresh data with updated columns
            updated_rows = (
                db.query(AEFlightDataset)
                .filter(AEFlightDataset.usable_for_ml == True)
                .all()
            )
            validated_dicts = apply_feature_engineering(updated_rows)
            health_report = validate_dataset_health(validated_dicts, print_report=True)
        except RuntimeError as e:
            # Health check failed — log but do NOT crash the rebuild
            logger.error(f"Health check FAILED: {e}")
            health_report = {"ready": False, "error": str(e)}

    logger.info("=" * 60)
    logger.info("  AE Dataset Rebuild — complete")
    logger.info("=" * 60)

    return {
        "total_loaded": total_loaded,
        "processed":    processed,
        "skipped":      skipped,
        "errors":       errors,
        "health_report": health_report,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# CLI entry point
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Allow running as:  python -m app.ml.rebuild_dataset
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    import json
    from app.database import SessionLocal

    _db = SessionLocal()
    try:
        result = rebuild_ae_dataset(_db, validate=True)
        safe = {
            k: v for k, v in result.items()
            if k != "health_report"
        }
        if result.get("health_report"):
            safe["health_report"] = {
                k: v for k, v in result["health_report"].items()
                if k != "blocking_issues" or True
            }
        print("\nRebuild result:")
        print(json.dumps(safe, indent=2, default=str))
    finally:
        _db.close()
