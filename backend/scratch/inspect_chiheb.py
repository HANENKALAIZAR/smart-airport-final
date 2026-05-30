import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.models import User

def main():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "chiheb.galaizar@dje-airport.tn").first()
        if user:
            print("FOUND USER:")
            print(f"ID: {user.id}")
            print(f"Email: {user.email}")
            print(f"Role: {user.role}")
            print(f"Must Change Password: {user.must_change_password}")
            print(f"Is Active: {user.is_active}")
            print(f"Profile Complete: {user.profile_complete}")
            print(f"ID Doc Status: {getattr(user, 'id_document_status', None)}")
        else:
            print("USER NOT FOUND")
    finally:
        db.close()

if __name__ == "__main__":
    main()
