import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Find duplicate cin_numbers
    dupes = db.execute(text(
        "SELECT cin_number, COUNT(*) FROM users "
        "WHERE cin_number IS NOT NULL GROUP BY cin_number HAVING COUNT(*) > 1"
    )).fetchall()
    
    print(f"Found {len(dupes)} duplicate CIN numbers.")
    for cin, count in dupes:
        print(f"CIN: {cin}, count: {count}")
        # Let's find all users with this CIN
        users = db.execute(text(
            "SELECT id, email FROM users WHERE cin_number = :cin ORDER BY id"
        ), {"cin": cin}).fetchall()
        
        # Keep the first one, update the rest to append _dup1, _dup2...
        for idx, row in enumerate(users[1:], start=1):
            user_id = row[0]
            email = row[1]
            new_cin = f"{cin}_dup{idx}"
            db.execute(text(
                "UPDATE users SET cin_number = :new_cin WHERE id = :user_id"
            ), {"new_cin": new_cin, "user_id": user_id})
            print(f"  Updated user {email} (ID: {user_id}) CIN to {new_cin}")
            
    db.commit()
    print("Database CIN cleanup committed successfully.")
finally:
    db.close()
