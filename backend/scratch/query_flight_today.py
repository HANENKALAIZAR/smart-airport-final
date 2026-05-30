import sys
import os
from datetime import date

sys.path.append(os.path.abspath("backend"))

from app.database import SessionLocal
from app.models.ae_models import AEFlightSnapshot

db = SessionLocal()
try:
    print("Querying today's AEFlightSnapshot for AC9277...")
    flights = db.query(AEFlightSnapshot).filter(
        AEFlightSnapshot.flight_number.like("%9277%"),
        AEFlightSnapshot.snapshot_date == date(2026, 5, 30)
    ).all()
    print(f"Found {len(flights)} flights matching 9277 on 2026-05-30:")
    for f in flights:
        print(f"Flight: {f.flight_number}")
        print(f"  Status: {f.status} (Raw status: {f.raw_status})")
        print(f"  Airport IATA: {f.airport_iata}, Direction: {f.direction}")
        print(f"  Snapshot Date: {f.snapshot_date}")
        print(f"  Collected At: {f.collected_at}")
        print(f"  Departure: Scheduled={f.dep_scheduled}, Estimated={f.dep_estimated}, Actual={f.dep_actual}")
        print(f"  Arrival: Scheduled={f.arr_scheduled}, Estimated={f.arr_estimated}, Actual={f.arr_actual}")
        print(f"  Latitude: {f.latitude}, Longitude: {f.longitude}")
        print(f"  Last Verified By: {f.last_verified_by}")
        print(f"  Provider Sources: {f.provider_sources}")
        print("-" * 50)
finally:
    db.close()
