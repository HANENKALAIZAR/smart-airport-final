import sys
from pathlib import Path
sys.path.insert(0, str(Path(r"c:\Users\gzhan\Downloads\smart-airport-postgres-feature-cleaned-up-the-chaos\backend")))

from app.database import SessionLocal
from app.models.ae_models import AEAviationStats

db = SessionLocal()
try:
    print("--- AEAviationStats records for airport ---")
    stats = db.query(AEAviationStats).filter(AEAviationStats.stat_type == "airport").all()
    for s in stats:
        print(f"Airport: {s.entity_key}, total_flights: {s.total_flights}, on_time_rate: {s.on_time_rate}, reliability: {s.reliability_score}, delay_rate: {s.delay_rate}")
        
    print("\n--- Simulating API Response ---")
    from app.routers.intelligence import get_airport_kpis
    # We can invoke it directly or mock dependencies
    kpis = get_airport_kpis(db, _user=None)
    import json
    print(json.dumps(kpis, indent=2))
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
