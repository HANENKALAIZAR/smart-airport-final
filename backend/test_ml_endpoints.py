import asyncio
import httpx
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.models import User
from app.config import settings
from jose import jwt
from datetime import datetime, timedelta, timezone

def create_super_admin_and_token(db: Session):
    user = db.query(User).filter(User.email == "test_super@example.com").first()
    if not user:
        user = User(
            email="test_super@example.com",
            password_hash="fake",
            role="super_admin",
            full_name="Super Admin",
            airport_iata=None,
            is_active=1
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    to_encode = {"sub": str(user.id)}
    expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token

async def test_endpoints():
    db = SessionLocal()
    try:
        token = create_super_admin_and_token(db)
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=15.0) as client:
        print("1. Testing /api/ml/scheduler-status")
        resp = await client.get("/api/ml/scheduler-status", headers=headers)
        print("Status:", resp.status_code)
        print("JSON:", resp.json())
        print("-" * 50)
        
        print("2. Testing /api/ml/train (Background Task)")
        resp = await client.post("/api/ml/train?notes=test", headers=headers)
        print("Status:", resp.status_code)
        print("JSON:", resp.json())
        print("-" * 50)
        
        # Testing live prediction requires flight number, we'll try TU302 or wait if it fails
        # since AviationStack might not have it today, but let's test it
        print("3. Testing /api/aviationstack/predict/TU302")
        try:
            resp = await client.get("/api/aviationstack/predict/TU302", headers=headers)
            print("Status:", resp.status_code)
            try:
                print("JSON:", resp.json())
            except Exception:
                print("Text:", resp.text)
        except Exception as e:
            print("Error making request:", e)

if __name__ == "__main__":
    asyncio.run(test_endpoints())
