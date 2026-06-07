import pandas as pd
from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
from sqlalchemy import func
import numpy as np

def main():
    db = SessionLocal()
    try:
        # 1. Total rows
        total_rows = db.query(func.count(AEFlightDataset.id)).scalar()
        print(f"1. Total rows in AEFlightDataset: {total_rows}\n")
        
        # 2. Count and percentage by data_source
        rows = db.query(AEFlightDataset.data_source, func.count(AEFlightDataset.id)).group_by(AEFlightDataset.data_source).all()
        print("2. Count and percentage by data_source:")
        for source, count in rows:
            pct = (count / total_rows) * 100
            print(f"   - {source}: {count} ({pct:.2f}%)")
        print()
        
        # 3. Earliest and latest dates for each source
        print("3. Earliest and latest dates for each source:")
        for source, _ in rows:
            min_date = db.query(func.min(AEFlightDataset.flight_date)).filter(AEFlightDataset.data_source == source).scalar()
            max_date = db.query(func.max(AEFlightDataset.flight_date)).filter(AEFlightDataset.data_source == source).scalar()
            print(f"   - {source}: Earliest = {min_date} | Latest = {max_date}")
        print()
        
        # 4. Check for mock/seed indicator fields or patterns
        # Let's inspect the first 5 rows and search for specific flight numbers or comment keys
        print("4. Inspecting flight number prefixes and other metadata:")
        prefixes = db.query(func.substring(AEFlightDataset.flight_number, 1, 2), func.count(AEFlightDataset.id)).group_by(func.substring(AEFlightDataset.flight_number, 1, 2)).limit(10).all()
        for pref, count in prefixes:
            print(f"   - Prefix {pref}: {count} rows")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
