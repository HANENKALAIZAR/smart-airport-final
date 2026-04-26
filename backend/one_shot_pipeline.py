import asyncio
import logging
import sys
from app.scheduler import _job_collect_flights, _job_collect_weather
from app.database import SessionLocal
from app.services.data_cleaner import run_data_cleaner
from app.services.feature_pipeline import run_feature_pipeline
from app.api_clients import aviationstack_client

# Configure logging to see the output in real-time
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)]
)

async def run_now():
    print("\n--- STARTING ONE-SHOT DATA PIPELINE ---", flush=True)
    
    # 1. Weather Collection
    print("\n[1/4] Collecting Weather Data...", flush=True)
    await _job_collect_weather()
    
    # 2. Flight Collection (includes historical logic, pagination, and API limits)
    print("\n[2/4] Collecting Flight Data (including historical/pagination)...", flush=True)
    await _job_collect_flights()
    
    # 3. Data Cleaning (already triggered by _job_collect_flights, but we log it separately for clarity)
    # The _job_collect_flights function in scheduler already calls run_data_cleaner.
    
    # 4. Feature Engineering (already triggered by _job_collect_flights)
    
    print("\n[4/4] Pipeline Run Complete.", flush=True)
    
    # Summary of Metrics
    db = SessionLocal()
    try:
        from app.models.models import Flight, FlightFeature
        total_flights = db.query(Flight).count()
        total_features = db.query(FlightFeature).count()
        print(f"\n--- FINAL DB SUMMARY ---")
        print(f"Total Flights in DB: {total_flights}")
        print(f"Total Features generated: {total_features}")
        print(f"Total API Requests made this session: {aviationstack_client.API_REQUESTS_MADE}")
        print(f"--------------------------\n")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_now())
