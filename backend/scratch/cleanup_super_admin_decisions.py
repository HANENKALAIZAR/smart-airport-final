"""
Cleanup: Remove AIAlert / AISuggestionDecision records where the acting
admin is a super_admin (invalid — only airport admins should approve/reject).
"""
from app.database import SessionLocal
from app.models.models import User, AISuggestionDecision, AIAlert


def run():
    db = SessionLocal()
    try:
        super_admin_ids = [
            u.id for u in db.query(User).filter(User.role == "super_admin").all()
        ]
        if not super_admin_ids:
            print("No super_admin users found. Nothing to clean up.")
            return

        # ── AISuggestionDecision ──────────────────────────────
        bad_decision_ids = (
            db.query(AISuggestionDecision)
            .filter(AISuggestionDecision.admin_user_id.in_(super_admin_ids))
            .all()
        )
        if bad_decision_ids:
            keys = [d.suggestion_key for d in bad_decision_ids]
            print(f"Deleting {len(bad_decision_ids)} AISuggestionDecision record(s):")
            for k in keys:
                safe_k = k.replace("→", "->").encode('ascii', errors='replace').decode('ascii')
                print(f"  {safe_k}")
            db.query(AISuggestionDecision).filter(
                AISuggestionDecision.id.in_([d.id for d in bad_decision_ids])
            ).delete(synchronize_session=False)
        else:
            print("No AISuggestionDecision records from super_admin found.")

        # ── AIAlert ────────────────────────────────────────────
        bad_alert_ids = (
            db.query(AIAlert)
            .filter(AIAlert.acted_by_admin_id.in_(super_admin_ids))
            .all()
        )
        if bad_alert_ids:
            print(f"Deleting {len(bad_alert_ids)} AIAlert record(s):")
            for a in bad_alert_ids:
                print(f"  {a.id} — flight {a.flight_number} at {a.airport_iata}")
            db.query(AIAlert).filter(
                AIAlert.id.in_([a.id for a in bad_alert_ids])
            ).delete(synchronize_session=False)
        else:
            print("No AIAlert records from super_admin found.")

        db.commit()
        print("Cleanup complete.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
