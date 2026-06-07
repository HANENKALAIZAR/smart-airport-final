from app.database import SessionLocal
from app.models.ae_models import AEFlightSnapshot
from sqlalchemy import func

db = SessionLocal()
try:
    total = db.query(AEFlightSnapshot).count()
    max_date = db.query(func.max(AEFlightSnapshot.snapshot_date)).scalar()
    min_date = db.query(func.min(AEFlightSnapshot.snapshot_date)).scalar()
    print(f"Total snapshots: {total}")
    print(f"Min snapshot date: {min_date}")
    print(f"Max snapshot date: {max_date}")
    
    if total > 0:
        print("Sample snapshots:")
        sample = db.query(AEFlightSnapshot).order_by(AEFlightSnapshot.snapshot_date.desc()).limit(5).all()
        for s in sample:
            print(f"Flight: {s.flight_number}, date: {s.snapshot_date}, dep: {s.dep_iata}, arr: {s.arr_iata}, status: {s.status}")
finally:
    db.close()
