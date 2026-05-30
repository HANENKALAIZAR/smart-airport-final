from app.database import SessionLocal
from app.models.models import User
from app.routers.auth import hash_password

def run():
    db = SessionLocal()
    try:
        # Find all super_admin users
        super_admins = db.query(User).filter(User.role == "super_admin").all()
        
        # If there is an existing super_admin, update it
        if super_admins:
            primary_sa = super_admins[0]
            primary_sa.email = "superadmin@smartairport.tn"
            primary_sa.password_hash = hash_password("Admin@2024")
            primary_sa.full_name = "Super Admin"
            primary_sa.is_active = 1
            primary_sa.must_change_password = 0
            print(f"Updated existing super_admin (ID {primary_sa.id}) to superadmin@smartairport.tn with password Admin@2024")
            
            # If there are other super_admins, demote them to avoid unique constraint violations
            for other_sa in super_admins[1:]:
                other_sa.role = "admin"
                print(f"Demoted duplicate super_admin (ID {other_sa.id}) to admin")
        else:
            # No super_admin exists at all, try to create one
            existing_user = db.query(User).filter(User.email == "superadmin@smartairport.tn").first()
            if existing_user:
                existing_user.role = "super_admin"
                existing_user.password_hash = hash_password("Admin@2024")
                existing_user.is_active = 1
                existing_user.must_change_password = 0
                print("Converted existing user to super_admin")
            else:
                new_sa = User(
                    email="superadmin@smartairport.tn",
                    password_hash=hash_password("Admin@2024"),
                    full_name="Super Admin",
                    role="super_admin",
                    is_active=1,
                    must_change_password=0
                )
                db.add(new_sa)
                print("Created new superadmin@smartairport.tn")

        # Also, check if 'admin@example.com' exists. If so, ensure it has 'admin' role and password 'AdminPassword123!'
        admin_ex = db.query(User).filter(User.email == "admin@example.com").first()
        if admin_ex:
            if admin_ex.email != "superadmin@smartairport.tn":
                admin_ex.role = "admin"
            admin_ex.password_hash = hash_password("AdminPassword123!")
            print("Ensured admin@example.com is 'admin' role with password 'AdminPassword123!'")
        else:
            # We can create admin@example.com as a standard admin
            new_admin = User(
                email="admin@example.com",
                password_hash=hash_password("AdminPassword123!"),
                full_name="Standard Admin",
                role="admin",
                is_active=1,
                must_change_password=0
            )
            db.add(new_admin)
            print("Created admin@example.com as standard admin")

        db.commit()
        print("Database seeded and super_admin configured!")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
