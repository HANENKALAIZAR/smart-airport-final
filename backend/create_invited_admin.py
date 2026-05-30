from app.database import SessionLocal
from app.models.models import User
from app.routers.auth import hash_password

def create_invited_admin():
    db = SessionLocal()
    email = "invited_test@smartairport.tn"
    try:
        # Clean up existing test admin if any
        db.query(User).filter(User.email == email).delete()
        db.commit()

        new_user = User(
            email=email,
            password_hash=hash_password("Temporary123!"),
            full_name="Invited Operational Admin",
            role="admin",
            is_active=1,
            must_change_password=1,
            profile_complete=0,
            id_document_status=None
        )
        db.add(new_user)
        db.commit()
        print(f"Invited admin created successfully!")
        print(f"Email: {email}")
        print(f"Temporary Password: Temporary123!")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_invited_admin()
