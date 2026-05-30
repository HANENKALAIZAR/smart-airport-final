import sys
import json
from pathlib import Path

# Add backend dir to path
sys.path.append(str(Path("c:/Users/gzhan/Downloads/smart-airport-postgres-feature-cleaned-up-the-chaos/backend").resolve()))

from app.database import SessionLocal
from app.routers.admin_analytics import get_full_analytics

def main():
    db = SessionLocal()
    try:
        # Call the function directly, bypassing auth
        result = get_full_analytics(days=7, airport_iata='TUN', db=db, _user=None)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
