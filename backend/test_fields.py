import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(str(Path("c:/Users/gzhan/Downloads/smart-airport-postgres-feature-cleaned-up-the-chaos/backend").resolve()))

from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
from sqlalchemy import func

def main():
    db = SessionLocal()
    try:
        total = db.query(func.count(AEFlightDataset.id)).filter(AEFlightDataset.is_delayed == 1).scalar()
        peak = db.query(func.count(AEFlightDataset.id)).filter(AEFlightDataset.is_delayed == 1, AEFlightDataset.is_peak_hour == 1).scalar()
        incomp = db.query(func.count(AEFlightDataset.id)).filter(AEFlightDataset.is_delayed == 1, AEFlightDataset.completeness < 0.9).scalar()
        print(f"Total delayed: {total}")
        print(f"Peak hour delays: {peak}")
        print(f"Incomplete metadata delays: {incomp}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
