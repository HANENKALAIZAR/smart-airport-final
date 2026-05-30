"""
backup_users.py — Safely back up the current users table.
"""

import sys
import os
import json
from sqlalchemy import text
from app.database import SessionLocal

def backup():
    db = SessionLocal()
    try:
        print("Backing up users table...")
        
        # Query all users
        result = db.execute(text("SELECT * FROM users"))
        keys = result.keys()
        users = []
        for row in result:
            user_dict = {}
            for key, val in zip(keys, row):
                # Try to serialize or convert to string if not JSON serializable
                try:
                    json.dumps(val)
                    user_dict[key] = val
                except TypeError:
                    user_dict[key] = str(val)
            users.append(user_dict)
            
        backup_path = r"C:\Users\gzhan\.gemini\antigravity\brain\ab4258ff-0ced-41eb-ac20-d152308c3dab\scratch\users_backup.json"
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(backup_path), exist_ok=True)
        
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
            
        print(f"SUCCESS: Backed up {len(users)} users to {backup_path}")
    except Exception as e:
        print(f"ERROR backing up users: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    backup()
