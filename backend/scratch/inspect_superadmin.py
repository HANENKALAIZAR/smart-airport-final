import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.models import User

def main():
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.role == "super_admin").all()
        if users:
            print("FOUND SUPER ADMINS:")
            for u in users:
                print(f"ID: {u.id} | Email: {u.email} | Is Active: {u.is_active} | Must Change Password: {u.must_change_password}")
        else:
            print("NO SUPER ADMINS FOUND!")
    finally:
        db.close()

if __name__ == "__main__":
    main()
