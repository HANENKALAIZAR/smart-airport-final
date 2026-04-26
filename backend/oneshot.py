import asyncio
import logging
from dotenv import load_dotenv
load_dotenv()

from app.api_clients.weather_client import fetch_and_store_weather
from app.api_clients.aviationstack_client import fetch_and_store_flights
from app.services.feature_pipeline import run_feature_pipeline
from app.database import SessionLocal
from app.scheduler import AIRPORTS
from sqlalchemy import func
from app.models.models import Flight, FlightFeature, WeatherCondition

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

async def main():
    db = SessionLocal()
    try:
        print("\n=== 1. Fetching Weather Data ===")
        for iata in AIRPORTS:
            res = await fetch_and_store_weather(iata, db)
            print(f" [Weather] {iata}: {res if res else 'No Key / Error'}")

        print("\n=== 2. Fetching Flights Data ===")
        for iata in AIRPORTS:
            for d in ("departure", "arrival"):
                stats = await fetch_and_store_flights(iata, d, db=db, limit=100)
                print(f" [Flights] {iata} ({d}): {stats}")
        
        print("\n=== 3. Running Feature generation ===")
        f_stats = run_feature_pipeline(db, batch_size=1000)
        print(f" [Features] Processed features: {f_stats}")

        print("\n=== 4. Final Data Summary ===")
        total_flights = db.query(func.count(Flight.id)).scalar() or 0
        weather_records = db.query(func.count(WeatherCondition.id)).scalar() or 0
        labelled_feats = db.query(func.count(FlightFeature.id)).filter(FlightFeature.is_delayed.isnot(None)).scalar() or 0
        v2_feats = db.query(func.count(FlightFeature.id)).filter(FlightFeature.feature_version == "v2").scalar() or 0
        print(f" -> Total flights in DB: {total_flights}")
        print(f" -> Total weather records: {weather_records}")
        print(f" -> Total labelled features: {labelled_feats}")
        print(f" -> v2 features computed: {v2_feats}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
