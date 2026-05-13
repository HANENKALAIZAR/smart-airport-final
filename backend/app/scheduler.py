"""
APScheduler Setup (v10)
========================
Defines and starts background data collection, feature engineering,
and prediction jobs. Integrated into FastAPI lifespan.

Jobs:
  collect_weather     — Every 30 min: OpenWeatherMap for all 8 airports
  collect_flights     — Every N hours (COLLECTION_INTERVAL_HOURS): AviationStack
  run_features        — After each flight collection run
  batch_predictions   — Every 30 min: predict upcoming flights with features

No persistent job store — in-memory only. Jobs fire at next calculated
interval after restart (acceptable for this system: see implementation_plan §5).
"""

import logging
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings

logger = logging.getLogger(__name__)

# ── Supported airports ────────────────────────────────────────────────────
AIRPORTS = ["TUN", "MIR"]  # Temporarily restricted to respect API limits

# ── Scheduler instance ────────────────────────────────────────────────────
_scheduler: Optional[AsyncIOScheduler] = None


# ── Job functions ─────────────────────────────────────────────────────────

async def _job_collect_weather():
    """Fetch and store current weather for all 8 airports."""
    from app.api_clients.weather_client import fetch_and_store_weather
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        for iata in AIRPORTS:
            try:
                await fetch_and_store_weather(iata, db)
            except Exception as e:
                logger.error(f"Weather job failed for {iata}: {e}")
    finally:
        db.close()


async def _job_collect_flights():
    """
    Fetch and store flights from AviationStack for all airports.
    Triggers feature pipeline afterwards.
    """
    from app.api_clients.aviationstack_client import fetch_and_store_flights
    from app.api_clients import aviationstack_client
    from app.database import SessionLocal

    db = SessionLocal()
    total = {"fetched": 0, "upserted": 0, "skipped": 0, "errors": 0}
    try:
        for iata in AIRPORTS:
            for direction in ("departure", "arrival"):
                try:
                    stats = await fetch_and_store_flights(iata, direction, db=db)
                    for k in total:
                        total[k] += stats.get(k, 0)
                except Exception as e:
                    logger.error(f"Flight job failed for {iata}/{direction}: {e}")
    finally:
        db.close()

    # Immediately run data cleaning and feature engineering after flights are updated
    db2 = SessionLocal()
    clean_metrics = {}
    try:
        from app.services.data_cleaner import run_data_cleaner
        clean_metrics = run_data_cleaner(db2)
    except Exception as e:
        logger.error(f"Data cleaner job failed: {e}")
    finally:
        db2.close()

    logger.info(f"=== PIPELINE CYCLE COMPLETE ===")
    logger.info(f"API requests made: {getattr(aviationstack_client, 'API_REQUESTS_MADE', 'N/A')}")
    logger.info(f"Total fetched flights: {total['fetched']}")
    logger.info(f"Total stored flights: {total['upserted']}")
    logger.info(f"Total valid flights after cleaning: {clean_metrics.get('total_valid_flights_after', 0)}")
    logger.info(f"===============================")

    await _job_run_features()


async def _job_ae_ingest():
    """
    Smart Aviation Edge ingestion — runs every 8 minutes.
    Only calls the AE API for airports whose cache is actually stale (> 10 min old).
    Airports with fresh data are skipped entirely — no wasted API calls.
    """
    from app.services.flight_cache_service import (
        is_cache_fresh, MONITORED_AIRPORTS, CACHE_TTL_MINUTES,
    )
    from app.services.ae_ingestion_service import ingest_airport
    from app.database import SessionLocal

    db = SessionLocal()
    skipped = 0
    refreshed = 0
    errors = 0
    try:
        for iata in MONITORED_AIRPORTS:
            for direction in ("departure", "arrival"):
                try:
                    if is_cache_fresh(iata, direction, db):
                        skipped += 1
                        continue
                    stats = await ingest_airport(iata, direction, db)
                    refreshed += 1
                    logger.info(
                        f"[AE Ingest Job] {iata}/{direction}: "
                        f"fetched={stats.fetched} stored={stats.snapshots_upserted}"
                    )
                except Exception as e:
                    errors += 1
                    logger.error(f"[AE Ingest Job] {iata}/{direction} error: {e}")
    finally:
        db.close()

    logger.info(
        f"[AE Ingest Job] Done — refreshed={refreshed} skipped={skipped} errors={errors} "
        f"(TTL={CACHE_TTL_MINUTES}min)"
    )


async def _job_run_features():
    """Run the DB-backed feature engineering pipeline."""
    from app.services.feature_pipeline import run_feature_pipeline
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        stats = run_feature_pipeline(db, batch_size=1000)
        logger.info(f"Feature pipeline job: {stats}")
    except Exception as e:
        logger.error(f"Feature pipeline job failed: {e}")
    finally:
        db.close()


async def _job_batch_predictions():
    """Generate predictions for upcoming flights with features but no recent prediction."""
    from app.services.prediction_service import run_batch_predictions
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        count = run_batch_predictions(db)
        if count > 0:
            logger.info(f"Batch prediction job: {count} predictions generated")
    except Exception as e:
        logger.error(f"Batch prediction job failed: {e}")
    finally:
        db.close()


# ── Lifecycle ─────────────────────────────────────────────────────────────

def start_scheduler():
    """Create and start the APScheduler instance. Called from FastAPI lifespan."""
    global _scheduler

    _scheduler = AsyncIOScheduler(timezone="UTC")
    interval_hours = settings.COLLECTION_INTERVAL_HOURS

    _scheduler.add_job(
        _job_collect_weather,
        trigger=IntervalTrigger(minutes=30),
        id="collect_weather",
        name="Collect airport weather (OpenWeatherMap)",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=120,
    )

    _scheduler.add_job(
        _job_collect_flights,
        trigger=IntervalTrigger(hours=interval_hours),
        id="collect_flights",
        name=f"Collect AviationStack flights (every {interval_hours}h)",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300,
    )

    _scheduler.add_job(
        _job_batch_predictions,
        trigger=IntervalTrigger(minutes=30),
        id="batch_predictions",
        name="Batch predict upcoming flights",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=120,
    )

    _scheduler.add_job(
        _job_ae_ingest,
        trigger=IntervalTrigger(minutes=8),
        id="ae_ingest",
        name="Smart AE ingestion — stale airports only (every 8 min)",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=60,
    )

    _scheduler.start()
    logger.info(
        f"APScheduler started — "
        f"weather=30min | flights={interval_hours}h | predictions=30min | ae_ingest=8min(stale-only)"
    )


def stop_scheduler():
    """Gracefully stop the scheduler. Called from FastAPI lifespan on shutdown."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")


def get_scheduler_status() -> list[dict]:
    """Return next-run info for all scheduled jobs (used by /api/ml/scheduler-status)."""
    if _scheduler is None or not _scheduler.running:
        return [{"error": "Scheduler not running"}]
    jobs = []
    for job in _scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id":       job.id,
            "name":     job.name,
            "next_run": next_run.isoformat() if next_run else None,
        })
    return jobs
