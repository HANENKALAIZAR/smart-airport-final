import sys
from app.database import SessionLocal
from app.services.data_cleaner import run_data_cleaner

print("Connecting to DB...", flush=True)
db = SessionLocal()
print("Running data cleaner...", flush=True)
try:
    metrics = run_data_cleaner(db)
    print("FINISHED!", flush=True)
    print(metrics, flush=True)
except Exception as e:
    import traceback
    traceback.print_exc()
