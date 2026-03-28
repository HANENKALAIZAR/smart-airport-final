from app.routers.auth import verify_password
from app.database import SessionLocal
from app.models.models import User

def test_login():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "admin@example.com").first()
        if not user:
            print("User not found!")
            return
        
        is_correct = verify_password("AdminPassword123!", user.password_hash)
        print(f"Login Success: {is_correct}")
        print(f"User Role: {user.role}")
    finally:
        db.close()

if __name__ == "__main__":
    test_login()
