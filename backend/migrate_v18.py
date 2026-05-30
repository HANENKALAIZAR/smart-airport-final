"""
migrate_v18.py — Create PassengerMessageReadState table in production PostgreSQL database.
=============================================================================================
Run: python migrate_v18.py
"""

from app.database import Base, engine
# Import models to ensure they are registered on Base.metadata
from app.models.models import PassengerMessage, PassengerMessageThread, PassengerMessageReadState

def run():
    print("Starting migration v18...")
    try:
        # Create tables defined in SQLAlchemy models if they do not exist
        Base.metadata.create_all(bind=engine)
        print("SUCCESS: passenger_message_read_states table verified/created successfully.")
    except Exception as exc:
        print(f"FATAL ERROR: Table creation failed: {exc}")

if __name__ == "__main__":
    run()
