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
        # Check if a user with email admin@example.com already exists
        existing_target = db.query(User).filter(User.email == "admin@example.com").first()
        
        # Check the existing super admin in the database
        existing_sa = db.query(User).filter(User.role == "super_admin").first()
        
        if existing_sa:
            print(f"FOUND EXISTING SUPER ADMIN: ID={existing_sa.id} | Email={existing_sa.email}")
            
            # If the super admin is not already admin@example.com
            if existing_sa.email != "admin@example.com":
                # If there's already another user with email 'admin@example.com', let's delete it or demote/re-key it first to avoid duplicate email errors
                if existing_target:
                    print("Removing conflicting standard admin@example.com record...")
                    db.delete(existing_target)
                    db.commit()
                
                # Now update the super admin slot to admin@example.com
                existing_sa.email = "admin@example.com"
            
            # Update password and details
            existing_sa.password_hash = hash_password("AdminPassword123!")
            existing_sa.full_name = "super Admin"
            existing_sa.is_active = 1
            existing_sa.must_change_password = 0
            
            db.commit()
            print("Successfully updated the Super Admin account to 'admin@example.com' with password 'AdminPassword123!'!")
            
        else:
            # If no super admin exists, check if 'admin@example.com' exists and convert it
            if existing_target:
                print("Converting existing admin@example.com to super_admin...")
                existing_target.role = "super_admin"
                existing_target.password_hash = hash_password("AdminPassword123!")
                existing_target.full_name = "super Admin"
                existing_target.is_active = 1
                existing_target.must_change_password = 0
                db.commit()
                print("Successfully upgraded 'admin@example.com' to Super Admin!")
            else:
                # Create a brand new super admin
                print("Creating brand new super_admin account for admin@example.com...")
                new_sa = User(
                    email="admin@example.com",
                    password_hash=hash_password("AdminPassword123!"),
                    full_name="super Admin",
                    role="super_admin",
                    is_active=1,
                    must_change_password=0
                )
                db.add(new_sa)
                db.commit()
                print("Successfully created 'admin@example.com' as Super Admin!")
                
    except Exception as e:
        db.rollback()
        print(f"Error during super admin reconfiguration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
