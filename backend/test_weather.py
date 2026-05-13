import asyncio
from app.database import SessionLocal
from app.api_clients.weather_client import fetch_and_store_weather

async def test():
    db = SessionLocal()
    try:
        print("Testing weather fetch for TUN...")
        res = await fetch_and_store_weather("TUN", db)
        print(f"Result: {res}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test())
