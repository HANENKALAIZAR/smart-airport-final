import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(str(Path("c:/Users/gzhan/Downloads/smart-airport-postgres-feature-cleaned-up-the-chaos/backend").resolve()))

from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
from sqlalchemy import func, or_

def main():
    db = SessionLocal()
    try:
        total = db.query(func.count(AEFlightDataset.id)).filter(AEFlightDataset.is_delayed == 1).scalar()
        
        incomplete = db.query(func.count(AEFlightDataset.id)).filter(
            AEFlightDataset.is_delayed == 1, 
            or_(
                AEFlightDataset.dep_hour.is_(None),
                AEFlightDataset.duration_min.is_(None),
                AEFlightDataset.distance_km.is_(None)
            )
        ).scalar()
        
        print(f"Total delayed: {total}")
        print(f"Incomplete metadata: {incomplete}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
