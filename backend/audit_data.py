import sys
from pathlib import Path

sys.path.append(str(Path("c:/Users/gzhan/Downloads/smart-airport-postgres-feature-cleaned-up-the-chaos/backend").resolve()))

from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
from sqlalchemy import func

def main():
    db = SessionLocal()
    try:
        # Check distribution of final_status
        statuses = db.query(AEFlightDataset.final_status, func.count(AEFlightDataset.id)).group_by(AEFlightDataset.final_status).all()
        print("Final Status Distribution:")
        for s in statuses:
            print(f"  {s[0]}: {s[1]}")
            
        # Check delay minutes for delayed vs non-delayed
        delayed_stats = db.query(AEFlightDataset.is_delayed, func.count(AEFlightDataset.id), func.avg(AEFlightDataset.delay_minutes)).group_by(AEFlightDataset.is_delayed).all()
        print("\nis_delayed Distribution (is_delayed, count, avg_delay):")
        for d in delayed_stats:
            print(f"  {d[0]}: {d[1]}, {d[2]}")
            
        # Count flights with delay > 15
        delay_15 = db.query(func.count(AEFlightDataset.id)).filter(AEFlightDataset.delay_minutes > 15).scalar()
        print(f"\nFlights with delay_minutes > 15: {delay_15}")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
