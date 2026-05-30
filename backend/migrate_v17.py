"""
migrate_v17.py — Create PassengerMessage and PassengerMessageThread tables in production PostgreSQL database.
=============================================================================================
Run: python migrate_v17.py
"""

from app.database import Base, engine
# Import models to ensure they are registered on Base.metadata
from app.models.models import PassengerMessage, PassengerMessageThread

def run():
    print("Starting migration v17...")
    try:
        # Create tables defined in SQLAlchemy models if they do not exist
        Base.metadata.create_all(bind=engine)
        print("SUCCESS: passenger_messages and passenger_message_threads tables verified/created successfully.")
    except Exception as exc:
        print(f"FATAL ERROR: Table creation failed: {exc}")

if __name__ == "__main__":
    run()
