from app.database import SessionLocal
from app.models.models import User
from app.routers.auth import hash_password

def create_user():
    db = SessionLocal()
    try:
        # Check if user already exists
        existing = db.query(User).filter(User.email == "admin@example.com").first()
        if existing:
            print("User already exists!")
            return

        new_user = User(
            email="admin@example.com",
            password_hash=hash_password("AdminPassword123!"),
            full_name="super Admin",
            role="super_admin",
            is_active=1,
            must_change_password=0
        )
        db.add(new_user)
        db.commit()
        print("Admin user created successfully!")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_user()
