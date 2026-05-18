"""
APScheduler Setup (v11)
========================
Defines and starts background data collection, feature engineering,
prediction jobs, and automatic ML retraining.

Jobs:
  collect_weather     — Every 30 min : OpenWeatherMap for all airports
  collect_flights     — Every N hours : AviationStack flight sync
  run_features        — After each flight collection run
  batch_predictions   — Every 30 min : predict upcoming flights with features
  ae_ingest           — Every 8 min  : Aviation Edge stale-only ingestion
  auto_retrain        — Every 7 days : policy-gated automatic model retraining
                         (also triggered if drift/growth thresholds are met)

No persistent job store — in-memory only.
"""

import logging
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings

logger = logging.getLogger(__name__)

# ── Supported airports ────────────────────────────────────────────────────
AIRPORTS = ["TUN", "MIR", "NBE", "DJE"]  # Supported Tunisian airports (4 only)

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


async def _job_auto_retrain():
    """
    Automatic model retraining job.
    Checks the MLOps policy (drift, model age, dataset growth) and
    triggers train_v2 → register → promote if any threshold is met.
    The existing active model is only replaced if the challenger wins
    all quality gates — otherwise the current model is left untouched.
    """
    from app.database import SessionLocal
    from app.ai.mlops_controller import check_retraining_policy, run_auto_retrain

    db = SessionLocal()
    try:
        policy = check_retraining_policy(db)
        if not policy["should_retrain"]:
            logger.info(
                f"[AutoRetrain] Policy check passed — no retrain needed. "
                f"Model age: {policy.get('model_age_days', 'N/A')}d | "
                f"Drift: {policy.get('drift_severity', 'N/A')} | "
                f"Dataset growth since last train: {policy.get('dataset_size', 0) - policy.get('last_train_size', 0)} rows"
            )
            return

        logger.info(
            f"[AutoRetrain] Policy triggered retraining — reasons: {policy['triggers']}"
        )
        result = run_auto_retrain(db)
        triggered = result.get("triggered", False)
        promo     = result.get("promotion_result") or {}
        logger.info(
            f"[AutoRetrain] Done — triggered={triggered} | "
            f"promoted={promo.get('promoted', False)} | "
            f"winner={result.get('training_result', {}).get('winner', {}).get('name', 'n/a')}"
        )
    except Exception as e:
        logger.exception(f"[AutoRetrain] Job failed: {e}")
    finally:
        db.close()


async def _job_passenger_alerts():
    """
    Passenger alert notification job — runs every 5 minutes.
    For each active subscription:
      1. Fetch current flight state from AEFlightSnapshot.
      2. Compare to last-notified state from passenger_alert_logs.
      3. If status/gate/terminal/delay changed → send update email.
      4. Log the event to avoid duplicate notifications.
    """
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from datetime import date
    from app.database import SessionLocal
    from app.models.models import PassengerAlertSubscription, PassengerAlertLog
    from app.models.ae_models import AEFlightSnapshot

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return  # SMTP not configured — skip silently

    db = SessionLocal()
    try:
        today = date.today()
        subscriptions = (
            db.query(PassengerAlertSubscription)
            .filter(PassengerAlertSubscription.is_active == True)
            .all()
        )

        for sub in subscriptions:
            fn = sub.flight_number
            snap = (
                db.query(AEFlightSnapshot)
                .filter(
                    AEFlightSnapshot.flight_number == fn
                )
                .order_by(AEFlightSnapshot.collected_at.desc())
                .first()
            )

            if snap is None:
                continue  # Flight not in today's cache yet

            # Get last notification for this subscription
            last_log = (
                db.query(PassengerAlertLog)
                .filter(
                    PassengerAlertLog.subscription_id == sub.id,
                    PassengerAlertLog.email_sent == True,
                )
                .order_by(PassengerAlertLog.sent_at.desc())
                .first()
            )

            # Determine what changed
            events: list[tuple[str, str, str]] = []  # (event_type, old_value, new_value)

            current_status = snap.status or "unknown"
            current_gate   = snap.dep_gate or snap.arr_gate or "—"
            current_terminal = snap.dep_terminal or snap.arr_terminal or "—"
            current_delay  = str(snap.delay_minutes or 0)

            if last_log is None:
                # Never sent any update — send initial status if flight is delayed/boarding
                if current_status in ("delayed", "boarding", "cancelled"):
                    events.append((current_status, "", current_status))
            else:
                # Parse last known values from most recent log
                last_val = last_log.new_value or ""
                # We store state as JSON-like string in new_value for status logs
                import json
                try:
                    last_state = json.loads(last_val)
                except Exception:
                    last_state = {}

                if last_state.get("status") != current_status:
                    events.append(("status_change", last_state.get("status", ""), current_status))
                if last_state.get("gate") != current_gate and current_gate != "—":
                    events.append(("gate_change", last_state.get("gate", ""), current_gate))
                if last_state.get("delay") != current_delay and int(current_delay) > 0:
                    events.append(("delay", last_state.get("delay", "0"), current_delay))

            if not events:
                continue

            # Build and send update email
            import json
            new_state = json.dumps({
                "status":   current_status,
                "gate":     current_gate,
                "terminal": current_terminal,
                "delay":    current_delay,
            })

            event_labels = {
                "status_change": f"Status changed to {current_status.upper()}",
                "gate_change":   f"Gate updated to {current_gate}",
                "delay":         f"Delay: {current_delay} minutes",
                "boarding":      "Boarding has started",
                "delayed":       f"Flight delayed by {current_delay} minutes",
                "cancelled":     "Flight has been cancelled",
            }
            lines = [event_labels.get(e[0], e[0]) for e in events]
            body_text = "\n".join(f"• {l}" for l in lines)

            year = __import__('datetime').datetime.utcnow().year
            html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="background:#0F172A;font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:40px 16px;">
  <table width="600" style="background:#1E293B;border-radius:16px;margin:0 auto;overflow:hidden;
         border:1px solid rgba(255,255,255,0.08);">
    <tr><td style="background:linear-gradient(135deg,#1e3a5f,#0ea5e9);padding:28px 36px;">
      <div style="font-size:28px;">✈️</div>
      <h1 style="color:#fff;margin:6px 0 0;font-size:1.2rem;">Smart Airport · Flight Update</h1>
    </td></tr>
    <tr><td style="padding:28px 36px;">
      <p style="color:#94A3B8;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.1em;">Flight {fn}</p>
      <div style="font-size:1.6rem;font-weight:800;color:#fff;font-family:monospace;">{fn}</div>
      <div style="color:#94A3B8;font-size:0.85rem;margin-top:4px;">{sub.dep_iata or ''} → {sub.arr_iata or ''}</div>
      <div style="margin-top:20px;padding:16px;background:rgba(14,165,233,0.08);
                  border:1px solid rgba(14,165,233,0.25);border-radius:10px;">
        {''.join(f'<p style="color:#CBD5E1;margin:6px 0;">• {l}</p>' for l in lines)}
      </div>
      <p style="color:#64748B;font-size:0.78rem;margin-top:20px;">Reply STOP to unsubscribe.</p>
    </td></tr>
    <tr><td style="background:rgba(0,0,0,0.2);padding:14px 36px;text-align:center;">
      <p style="margin:0;color:#475569;font-size:0.7rem;">© {year} Smart Airport Operations</p>
    </td></tr>
  </table>
</body></html>"""

            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = f"✈ Update: Flight {fn} — {lines[0]}"
                msg["From"]    = f"Smart Airport Alerts <{settings.SMTP_USER}>"
                msg["To"]      = sub.email
                msg.attach(MIMEText(body_text, "plain"))
                msg.attach(MIMEText(html, "html"))

                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as srv:
                    srv.ehlo(); srv.starttls()
                    srv.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    srv.sendmail(settings.SMTP_USER, [sub.email], msg.as_string())

                now_ts = _now_utc() if hasattr(__builtins__, '_now_utc') else __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
                for ev in events:
                    log = PassengerAlertLog(
                        subscription_id = sub.id,
                        flight_number   = fn,
                        email           = sub.email,
                        event_type      = ev[0],
                        old_value       = ev[1],
                        new_value       = new_state,
                        email_sent      = True,
                        sent_at         = now_ts,
                    )
                    db.add(log)
                db.commit()
                logger.info(f"[PassengerAlerts] Update sent → {sub.email} / {fn}: {[e[0] for e in events]}")

            except Exception as exc:
                logger.error(f"[PassengerAlerts] Notification dispatch failed for {sub.email}/{fn}: {exc}")

    except Exception as exc:
        logger.error(f"[PassengerAlerts] Job error: {exc}")
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

    _scheduler.add_job(
        _job_auto_retrain,
        trigger=IntervalTrigger(weeks=1),
        id="auto_retrain",
        name="Automatic ML retraining — policy-gated (weekly + drift/growth triggers)",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600,  # 1 hour grace — retraining is heavy
    )

    _scheduler.add_job(
        _job_passenger_alerts,
        trigger=IntervalTrigger(minutes=5),
        id="passenger_alerts",
        name="Passenger alert emails — state-change detection (every 5 min)",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=60,
    )

    _scheduler.start()
    logger.info(
        f"APScheduler started — "
        f"weather=30min | flights={interval_hours}h | "
        f"predictions=30min | ae_ingest=8min | passenger_alerts=5min | auto_retrain=weekly"
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
