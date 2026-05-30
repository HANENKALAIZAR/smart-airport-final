import sys
from pathlib import Path
sys.path.insert(0, str(Path(r"c:\Users\gzhan\Downloads\smart-airport-postgres-feature-cleaned-up-the-chaos\backend")))

from app.database import SessionLocal
from app.models.ae_models import AEModelVersion
from app.models.models import ModelMetrics

db = SessionLocal()
try:
    print("--- AEModelVersion records ---")
    versions = db.query(AEModelVersion).all()
    for v in versions:
        print(f"Version: {v.model_version}, Active: {v.is_active}, MAE: {v.mae}, RMSE: {v.rmse}, R2: {v.r2_score}, Baseline Route MAE: {v.baseline_route_mae}, Baseline Airline MAE: {v.baseline_airline_mae}, Improvement: {v.improvement_pct}%")
        
    print("\n--- ModelMetrics records ---")
    metrics = db.query(ModelMetrics).all()
    for m in metrics:
        print(f"Version: {m.model_version}, Active: {m.is_active}, MAE: {m.mae_minutes}, RMSE: {m.rmse_minutes}, R2: {m.r2_score}")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
