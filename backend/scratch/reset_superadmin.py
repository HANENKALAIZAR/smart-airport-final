import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.models import User
import bcrypt

def hash_password(password: str) -> str:
    p_bytes = password.encode("utf-8")
    if len(p_bytes) > 72:
        p_bytes = p_bytes[:72]
    return bcrypt.hashpw(p_bytes, bcrypt.gensalt()).decode("utf-8")

def main():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "superadmin@smartairport.tn").first()
        if user:
            print(f"FOUND USER: {user.email}")
            print(f"OLD HASH: {user.password_hash}")
            user.password_hash = hash_password("Admin@2024")
            user.must_change_password = 0
            user.is_active = 1
            db.commit()
            print("PASSWORD SUCCESSFULLY RESET TO 'Admin@2024'!")
            print(f"NEW HASH: {user.password_hash}")
        else:
            print("Super Admin user not found!")
    finally:
        db.close()

if __name__ == "__main__":
    main()
