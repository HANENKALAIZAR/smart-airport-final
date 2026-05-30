import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.models import User
import bcrypt

def verify_password(plain: str, hashed: str) -> bool:
    try:
        p_bytes = plain.encode("utf-8")
        if len(p_bytes) > 72:
            p_bytes = p_bytes[:72]
        return bcrypt.checkpw(p_bytes, hashed.encode("utf-8"))
    except Exception:
        return False

def main():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "superadmin@smartairport.tn").first()
        if user:
            print(f"User: {user.email}")
            print(f"Hash: {user.password_hash}")
            is_match = verify_password("Admin@2024", user.password_hash)
            print(f"Does 'Admin@2024' match? {'YES' if is_match else 'NO'}")
        else:
            print("Super Admin user not found in database!")
    finally:
        db.close()

if __name__ == "__main__":
    main()
