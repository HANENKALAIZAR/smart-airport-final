import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import User, InAppNotification
from app.services.in_app_notify import notify_airport_admin, notify_all_super_admins

logger = logging.getLogger(__name__)


def run_rejection_reminder_sweep(db: Session):
    logger.info("[Rejection Reminder Sweep] Starting sweep...")
    now = datetime.now(timezone.utc)

    # Query active admins with rejected profile (expired_verification handled separately — skip them)
    rejected_admins = (
        db.query(User)
        .filter(
            User.role == "admin",
            User.id_document_status == "rejected",
            User.is_active == 1,
        )
        .all()
    )

    logger.info(f"[Rejection Reminder Sweep] Found {len(rejected_admins)} rejected admins to check")

    for admin in rejected_admins:
        if not admin.updated_at:
            continue

        updated_at = admin.updated_at
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)

        delta = now - updated_at
        days = delta.days

        logger.info(f"[Rejection Reminder Sweep] Admin {admin.email} rejected {days} days ago")

        # ── Threshold: 30 days ─────────────────────────────────────────────────
        # DO NOT deactivate the account. DO NOT set is_active = 0.
        # Instead, mark as expired_verification so the admin cannot proceed
        # until a Super Admin takes deliberate action (reopen / archive / permanently reject).
        if days >= 30:
            # Dedup guard: skip if we already fired the expiry notification
            already_notified = (
                db.query(InAppNotification)
                .filter(
                    InAppNotification.recipient_user_id == admin.id,
                    InAppNotification.kind == "verification_expired",
                    InAppNotification.created_at >= admin.updated_at,
                )
                .first()
            ) is not None

            if already_notified:
                logger.info(
                    f"[Rejection Reminder Sweep] Admin {admin.email} already notified of expiry — skipping."
                )
                continue

            logger.warning(
                f"[Rejection Reminder Sweep] Admin {admin.email} correction overdue (>= 30 days). "
                "Setting id_document_status = 'expired_verification'."
            )

            # Mark as expired — account remains active (is_active untouched)
            admin.id_document_status = "expired_verification"
            admin.id_document_rejection_reason = (
                "Your verification request has expired due to inactivity (30 days without correction). "
                "Please contact the Super Admin."
            )
            try:
                db.commit()
            except Exception as e:
                logger.error(f"Failed to commit expired_verification for admin {admin.email}: {e}")
                db.rollback()
                continue

            # Notify the admin
            try:
                notify_airport_admin(
                    db,
                    admin_id=admin.id,
                    kind="verification_expired",
                    body=(
                        "Your verification request has expired due to inactivity. "
                        "Please contact the Super Admin."
                    ),
                )
                db.commit()
            except Exception as e:
                logger.error(f"Failed to notify admin {admin.email} of verification expiry: {e}")
                db.rollback()

            # Notify all super admins to take action
            try:
                notify_all_super_admins(
                    db,
                    kind="admin_verification_expired",
                    body=(
                        f"Airport Admin {admin.full_name} ({admin.email}) has not corrected their "
                        "rejected profile for 30 days. Their verification is now expired. "
                        "Please reopen, archive, or permanently reject their account."
                    ),
                )
                db.commit()
            except Exception as e:
                logger.error(f"Failed to notify super admins of verification expiry for {admin.email}: {e}")
                db.rollback()

            continue

        # ── Threshold: 14 days ─────────────────────────────────────────────────
        elif days >= 14:
            sent_14 = (
                db.query(InAppNotification)
                .filter(
                    InAppNotification.recipient_user_id == admin.id,
                    InAppNotification.kind == "rejection_reminder_14",
                    InAppNotification.created_at >= admin.updated_at,
                )
                .first()
            ) is not None

            if not sent_14:
                logger.info(
                    f"[Rejection Reminder Sweep] Sending 14-day reminder to admin {admin.email} and notifying super admins."
                )
                try:
                    notify_airport_admin(
                        db,
                        admin_id=admin.id,
                        kind="rejection_reminder_14",
                        body=(
                            "Action required: Please correct your profile immediately. "
                            "This is your second reminder. "
                            "Your verification will expire if not corrected within 30 days of rejection."
                        ),
                    )
                    notify_all_super_admins(
                        db,
                        kind="admin_correction_warning_14",
                        body=(
                            f"Airport Admin {admin.full_name} ({admin.email}) has not corrected "
                            "their rejected profile fields for 14 days."
                        ),
                    )
                    db.commit()
                except Exception as e:
                    logger.error(f"Failed to send 14-day reminders: {e}")
                    db.rollback()

        # ── Threshold: 7 days ──────────────────────────────────────────────────
        elif days >= 7:
            sent_7 = (
                db.query(InAppNotification)
                .filter(
                    InAppNotification.recipient_user_id == admin.id,
                    InAppNotification.kind == "rejection_reminder_7",
                    InAppNotification.created_at >= admin.updated_at,
                )
                .first()
            ) is not None

            if not sent_7:
                logger.info(f"[Rejection Reminder Sweep] Sending 7-day reminder to admin {admin.email}.")
                try:
                    notify_airport_admin(
                        db,
                        admin_id=admin.id,
                        kind="rejection_reminder_7",
                        body=(
                            "Action required: Please correct and resubmit your rejected profile fields "
                            "to maintain airport network access."
                        ),
                    )
                    db.commit()
                except Exception as e:
                    logger.error(f"Failed to send 7-day reminder: {e}")
                    db.rollback()

    logger.info("[Rejection Reminder Sweep] Sweep complete.")
