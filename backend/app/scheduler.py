"""
APScheduler Setup (v11)
========================
Defines and starts background data collection, feature engineering,
prediction jobs, and automatic ML retraining.

Jobs:
  collect_weather     — Every 30 min : OpenWeatherMap for all airports
  ae_ingest           — Every 8 min  : Aviation Edge stale-only ingestion
  run_features        — After each flight collection run
  batch_predictions   — Every 30 min : predict upcoming flights with features
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
_ae_ingest_running = False



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


async def _job_ae_ingest():
    """
    Smart Aviation Edge ingestion — runs every 2 minutes.
    Only calls the AE API for airports whose cache is actually stale.
    Airports with fresh data are skipped entirely — no wasted API calls.
    Triggers data cleaner and feature engineering on updates.
    """
    global _ae_ingest_running
    if _ae_ingest_running:
        logger.warning("[AE Ingest Job] Previous ingestion cycle is still running. Skipping this execution to avoid overlap.")
        return
    _ae_ingest_running = True

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

        # Periodic background sweep for stale active flights
        try:
            from app.services.flight_reconciliation_service import reconcile_stale_flight_status
            from app.models.ae_models import AEFlightSnapshot
            
            # Query all active snapshots currently in database
            active_snaps = db.query(AEFlightSnapshot).filter(
                AEFlightSnapshot.status.in_(["in_air", "active", "departed", "boarding", "taxiing"])
            ).all()
            
            swept_count = 0
            for snap in active_snaps:
                if reconcile_stale_flight_status(snap, db):
                    swept_count += 1
            
            if swept_count > 0:
                db.commit()
                logger.info(f"[Stale Reconcile Sweep] Successfully swept and auto-reconciled {swept_count} stale flights.")
        except Exception as sweep_err:
            logger.error(f"[Stale Reconcile Sweep] Sweep failed: {sweep_err}")

    finally:
        db.close()
        _ae_ingest_running = False


    logger.info(
        f"[AE Ingest Job] Done — refreshed={refreshed} skipped={skipped} errors={errors} "
        f"(TTL={CACHE_TTL_MINUTES}min)"
    )

    if refreshed > 0:
        logger.info("[AE Ingest Job] New flights ingested. Triggering data cleaning and feature pipeline...")
        db2 = SessionLocal()
        try:
            from app.services.data_cleaner import run_data_cleaner
            clean_metrics = run_data_cleaner(db2)
            logger.info(f"[AE Ingest Job] Data quality cleaner complete. Valid flights: {clean_metrics.get('total_valid_flights_after', 0)}")
        except Exception as e:
            logger.error(f"[AE Ingest Job] Data cleaner failed: {e}")
        finally:
            db2.close()

        await _job_run_features()


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
    """
    Generate predictions for upcoming flights (Aviation Edge future schedules).
    Uses the official delay_prediction_model.pkl (Aviation Edge model).
    """
    from app.ai.future_predictions import predict_future_flights
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        res = predict_future_flights(db, horizon_hours=72)
        status = res.get("status", "error")
        pred_count = res.get("predicted", 0)
        if pred_count > 0 or status == "ok":
            logger.info(
                f"[AE Prediction Job] Batch complete: predicted={pred_count} "
                f"skipped={res.get('skipped', 0)} errors={res.get('errors', 0)}"
            )
    except Exception as e:
        logger.error(f"[AE Prediction Job] Failed: {e}")
    finally:
        db.close()


async def _job_reconcile_predictions():
    """
    Reconcile completed predictions with real actual flight delays.
    Matches prediction logs with actual outcome data (Aviation Edge flight dataset)
    and computes error metrics (MAE/drift).
    """
    from app.ai.mlops_controller import reconcile_predictions
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        res = reconcile_predictions(db, batch_size=500)
        reconciled = res.get("reconciled", 0)
        if reconciled > 0:
            logger.info(
                f"[MLOps Reconcile Job] Complete: reconciled={reconciled} "
                f"skipped={res.get('skipped', 0)} errors={res.get('errors', 0)}"
            )
    except Exception as e:
        logger.error(f"[MLOps Reconcile Job] Failed: {e}")
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
            .filter(
                PassengerAlertSubscription.is_active == True,
                PassengerAlertSubscription.status.in_(["ACTIVE", "pending"])
            )
            .all()
        )

        for sub in subscriptions:
            now_ts = _now_utc() if hasattr(__builtins__, '_now_utc') else __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
            sub.last_checked_at = now_ts
            db.commit()

            # Auto-expire subscriptions for flights scheduled more than 36 hours ago
            if sub.scheduled_departure:
                from datetime import timezone
                dep_time = sub.scheduled_departure
                if dep_time.tzinfo is None:
                    dep_time = dep_time.replace(tzinfo=timezone.utc)
                if (now_ts - dep_time).total_seconds() > 36 * 3600:
                    sub.status = "EXPIRED"
                    sub.is_active = False
                    sub.completed_at = now_ts
                    sub.completion_reason = "expired"
                    logger.info(f"[PassengerAlerts] Subscription auto-expired (scheduled departure was >36h ago) → {sub.email} / {sub.flight_number}")
                    db.commit()
                    continue

            fn = sub.flight_number
            from app.utils.flight_number import get_flight_alias_filter
            alias_filter = get_flight_alias_filter(AEFlightSnapshot, fn)
            snap = (
                db.query(AEFlightSnapshot)
                .filter(
                    alias_filter
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

            last_state = {}
            if last_log is None:
                # Never sent any update — send initial status if flight is delayed/boarding/cancelled/landed
                if current_status in ("delayed", "boarding", "cancelled", "landed"):
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

            is_final = current_status.lower() in ("landed", "cancelled", "arrived", "completed", "departed")

            if is_final:
                last_st = last_state.get("status") if last_log else "unknown"
                if last_st != current_status and not any(e[0] == "status_change" for e in events) and not any(e[0] == current_status for e in events):
                    events.append(("status_change", last_st, current_status))

            if not events and not is_final:
                continue

            import json
            new_state = json.dumps({
                "status":   current_status,
                "gate":     current_gate,
                "terminal": current_terminal,
                "delay":    current_delay,
            })

            if events:
                # Build and send update email
                event_labels = {
                    "status_change": f"Status changed to {current_status.upper()}",
                    "gate_change":   f"Gate updated to {current_gate}",
                    "delay":         f"Delay: {current_delay} minutes",
                    "boarding":      "Boarding has started",
                    "delayed":       f"Flight delayed by {current_delay} minutes",
                    "cancelled":     "Flight has been cancelled",
                    "landed":        "Flight has landed",
                }
                lines = [event_labels.get(e[0], e[0]) for e in events]
                if is_final:
                    lines.append("Alert subscription automatically closed because flight reached a final status.")
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

            now_ts = _now_utc() if hasattr(__builtins__, '_now_utc') else __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
            if events:
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
                    logger.info(f"[PassengerAlerts] Update sent → {sub.email} / {fn}: {[e[0] for e in events]}")

                except Exception as exc:
                    logger.error(f"[PassengerAlerts] Notification dispatch failed for {sub.email}/{fn}: {exc}")

            sub.last_notified_status = current_status
            if is_final:
                sub.status = "COMPLETED"
                sub.is_active = False
                sub.completed_at = now_ts
                sub.completion_reason = f"flight_{current_status.lower()}"
                logger.info(f"[PassengerAlerts] Subscription closed → {sub.email} / {fn}: Final status {current_status}")

            db.commit()

    except Exception as exc:
        logger.error(f"[PassengerAlerts] Job error: {exc}")
    finally:
        db.close()


# ── Lifecycle ─────────────────────────────────────────────────────────────

async def _job_flightaware_enrich():
    """
    FlightAware live-status enrichment job — runs every 15 minutes.

    Algorithm:
      1. Skip entirely if FlightAware is disabled or circuit is OPEN.
      2. Query AEFlightSnapshot for enrichable candidates:
           - status IN ('scheduled', 'delayed', 'unknown')
           - today's snapshot_date
           - dep_scheduled or arr_scheduled in the active window
           - LIMIT 50 (hard cap — never process more per cycle)
      3. For each candidate:
           a. Double-check should_enrich() filter.
           b. Build ident candidates (ICAO preferred, IATA fallback).
           c. For each ident: check TTL cache, then call FA.
           d. On FA hit: reconcile and update DB.
           e. On miss: try next ident. Log total miss at end.
      4. Commit once after all updates.
      5. Log summary counters.
    """
    from app.config import settings as _settings
    from app.api_clients.flightaware_client import (
        is_enabled, fetch_flight_by_ident, get_ident_candidates,
    )
    from app.services.flight_reconciliation_service import should_enrich, reconcile_snapshot
    from app.services.provider_health import health_registry
    from app.models.ae_models import AEFlightSnapshot
    from app.database import SessionLocal
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import or_, and_

    # ── 0. Guard: disabled or circuit open ────────────────────────
    if not is_enabled():
        logger.debug("[FA DISABLED] FlightAware enrichment skipped — key not configured or disabled")
        return

    if await health_registry.is_circuit_open("flightaware"):
        stats = await health_registry.get_stats("flightaware")
        logger.warning(
            f"[FA DISABLED] FlightAware enrichment skipped — circuit is OPEN "
            f"(closes at {stats.get('circuit_closes_at', 'unknown')})"
        )
        return

    now = datetime.now(timezone.utc)
    past_limit   = now - timedelta(hours=_settings.FLIGHTAWARE_WINDOW_PAST_HOURS)
    future_limit = now + timedelta(hours=_settings.FLIGHTAWARE_WINDOW_FUTURE_HOURS)
    today = now.date()

    db = SessionLocal()
    checked = enriched = misses = errors = 0

    try:
        # ── 1. Query enrichable candidates (smart filter + hard LIMIT) ───────
        candidates = (
            db.query(AEFlightSnapshot)
            .filter(
                AEFlightSnapshot.snapshot_date == today,
                AEFlightSnapshot.status.in_(["scheduled", "delayed", "unknown"]),
                or_(
                    and_(
                        AEFlightSnapshot.dep_scheduled >= past_limit,
                        AEFlightSnapshot.dep_scheduled <= future_limit,
                    ),
                    and_(
                        AEFlightSnapshot.arr_scheduled >= past_limit,
                        AEFlightSnapshot.arr_scheduled <= future_limit,
                    ),
                ),
            )
            .order_by(AEFlightSnapshot.dep_scheduled.asc())
            .limit(50)   # hard cap — never process more per cycle
            .all()
        )

        logger.info(
            f"[FA Enrich Job] Starting — {len(candidates)} candidates in window "
            f"[{past_limit.strftime('%H:%M')} – {future_limit.strftime('%H:%M')} UTC]"
        )

        # ── 2. Process each candidate ─────────────────────────────────
        for snap in candidates:
            checked += 1

            # Double-check (service layer filter is authoritative)
            if not should_enrich(snap, now_utc=now):
                continue

            idents = get_ident_candidates(
                snap.flight_number,
                snap.airline_iata,
                snap.airline_icao,
            )

            flight_enriched = False
            for ident in idents:
                try:
                    fa_data = await fetch_flight_by_ident(ident)
                except Exception as exc:
                    logger.error(
                        f"[FA ERROR] flight={snap.flight_number} ident={ident}: {exc}"
                    )
                    await health_registry.record_failure("flightaware")
                    errors += 1
                    break

                if fa_data is None:
                    # Miss or disabled — try next ident
                    continue

                # FA hit — reconcile
                try:
                    result = reconcile_snapshot(snap, fa_data, db)
                    if result["was_enriched"]:
                        enriched += 1
                    flight_enriched = True
                    break
                except Exception as exc:
                    logger.error(
                        f"[FA ERROR] reconcile failed for {snap.flight_number}/{ident}: {exc}"
                    )
                    errors += 1
                    break

            if not flight_enriched:
                misses += 1
                logger.debug(f"[FA MISS] flight={snap.flight_number} — no FA match for idents={idents}")

        # ── 3. Commit all enriched rows ──────────────────────────────
        if enriched > 0:
            db.commit()

    except Exception as exc:
        logger.error(f"[FA Enrich Job] Fatal error: {exc}")
        db.rollback()
    finally:
        db.close()

    fa_stats = await health_registry.get_stats("flightaware")
    logger.info(
        f"[FA Enrich Job] Done — checked={checked} enriched={enriched} "
        f"misses={misses} errors={errors} | "
        f"circuit={fa_stats['circuit_state']} "
        f"total_enrichments={fa_stats['total_enrichments']} "
        f"total_failures={fa_stats['total_failures']}"
    )


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
        _job_batch_predictions,
        trigger=IntervalTrigger(minutes=30),
        id="batch_predictions",
        name="Batch predict upcoming flights",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=120,
    )

    _scheduler.add_job(
        _job_reconcile_predictions,
        trigger=IntervalTrigger(minutes=30),
        id="reconcile_predictions",
        name="Reconcile predictions with actual outcomes (every 30 min)",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=120,
    )

    _scheduler.add_job(
        _job_ae_ingest,
        trigger=IntervalTrigger(minutes=2),
        id="ae_ingest",
        name="Smart AE ingestion — stale airports only (every 2 min)",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=60,
    )


    _scheduler.add_job(
        _job_auto_retrain,
        trigger=IntervalTrigger(hours=6),
        id="auto_retrain",
        name="Automatic ML retraining — policy-gated (every 6 hours)",
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

    _scheduler.add_job(
        _job_flightaware_enrich,
        trigger=IntervalTrigger(minutes=settings.FLIGHTAWARE_ENRICH_INTERVAL_MINUTES),
        id="fa_enrich",
        name=f"FlightAware live status enrichment (every {settings.FLIGHTAWARE_ENRICH_INTERVAL_MINUTES} min)",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=120,
    )

    _scheduler.start()
    logger.info(
        f"APScheduler started — "
        f"weather=30min | predictions=30min | reconciliation=30min | ae_ingest=2min | "
        f"passenger_alerts=5min | auto_retrain=6hours | "
        f"fa_enrich={settings.FLIGHTAWARE_ENRICH_INTERVAL_MINUTES}min"
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
