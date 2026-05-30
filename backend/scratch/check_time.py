import datetime
import os
import sys

sys.path.append(os.path.abspath("backend"))

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("Python utcnow:", datetime.datetime.now(datetime.timezone.utc))
    print("Python local:", datetime.datetime.now())
    # Query database current time
    db_now = db.execute(text("SELECT NOW()")).scalar()
    print("Database NOW():", db_now)
finally:
    db.close()
