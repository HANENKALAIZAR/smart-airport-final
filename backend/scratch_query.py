import sys
from app.database import SessionLocal
from app.models.ae_models import AEFutureSchedule

db = SessionLocal()
try:
    count = db.query(AEFutureSchedule).count()
    predicted_count = db.query(AEFutureSchedule).filter(AEFutureSchedule.predicted_at.isnot(None)).count()
    print(f"Total future schedules: {count}")
    print(f"Predicted schedules: {predicted_count}")
    if predicted_count > 0:
        sample = db.query(AEFutureSchedule).filter(AEFutureSchedule.predicted_at.isnot(None)).limit(3).all()
        for s in sample:
            print(f"Flight: {s.flight_number}, airline_iata: {s.airline_iata}, airline_name: {s.airline_name}, dep: {s.dep_iata} ({s.dep_airport}), arr: {s.arr_iata} ({s.arr_airport}), dep_time: {s.scheduled_departure}, predicted_delay: {s.predicted_delay_min}, confidence: {s.confidence}")
finally:
    db.close()
