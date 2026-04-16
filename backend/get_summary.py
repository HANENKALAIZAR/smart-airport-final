import asyncio
import httpx

from app.database import SessionLocal
from test_ml_endpoints import create_super_admin_and_token

async def fetch_summary():
    db = SessionLocal()
    token = create_super_admin_and_token(db)
    db.close()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=15) as client:
        resp = await client.get("/api/ml/data-quality", headers=headers)
        print("Data Quality Response:", resp.status_code)
        import pprint
        pprint.pprint(resp.json())

if __name__ == "__main__":
    asyncio.run(fetch_summary())
