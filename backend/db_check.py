from app.database import SessionLocal
from sqlalchemy import text

def check():
    print("Connecting to DB...")
    db = SessionLocal()
    try:
        res = db.execute(text("SELECT 1")).fetchone()
        print(f"DB OK: {res}")
    except Exception as e:
        print(f"DB ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
