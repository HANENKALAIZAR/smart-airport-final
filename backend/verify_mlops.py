import sys
import io

# Force UTF-8 output for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from app.database import SessionLocal
from app.ai.mlops_controller import check_retraining_policy, get_dashboard_metrics
from app.models.ae_models import AEModelVersion, AEFlightDataset, AEPredictionLog
from sqlalchemy import func
import json

def verify():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("  smart-airport MLOPs Verification Tool")
        print("=" * 60)
        
        # 1. Total rows summary
        total_ae_flights = db.query(func.count(AEFlightDataset.id)).scalar() or 0
        real_ae_flights = db.query(func.count(AEFlightDataset.id)).filter(
            AEFlightDataset.usable_for_ml == True,
            AEFlightDataset.data_source == "aviation_edge"
        ).scalar() or 0
        total_predictions = db.query(func.count(AEPredictionLog.id)).scalar() or 0
        reconciled_predictions = db.query(func.count(AEPredictionLog.id)).filter(
            AEPredictionLog.reconciled_at.isnot(None)
        ).scalar() or 0
        
        print(f"Total rows in AEFlightDataset: {total_ae_flights}")
        print(f"Real (usable) Aviation Edge flights: {real_ae_flights}")
        print(f"Total prediction logs: {total_predictions}")
        print(f"Reconciled prediction logs: {reconciled_predictions}")
        print("-" * 60)
        
        # 2. AEModelVersion history
        versions = db.query(AEModelVersion).order_by(AEModelVersion.trained_at.desc()).all()
        print(f"Found {len(versions)} registered model versions:")
        for v in versions:
            print(f" - Version: {v.model_version}")
            print(f"   Trained at: {v.trained_at}")
            print(f"   Active: {v.is_active}")
            print(f"   MAE: {v.mae} | RMSE: {v.rmse} | R2: {v.r2_score}")
            print(f"   Dataset size: {v.dataset_size}")
            print(f"   Drift severity: {v.drift_severity}")
            
            rejection_reason = str(v.rejection_reason or "").encode('ascii', 'replace').decode('ascii')
            promotion_reason = str(v.promotion_reason or "").encode('ascii', 'replace').decode('ascii')
            print(f"   Rejection reason: {rejection_reason}")
            print(f"   Promotion reason: {promotion_reason}")
        print("-" * 60)
        
        # 3. Retraining Policy Check
        print("Evaluating Retraining Policy:")
        policy = check_retraining_policy(db)
        # Convert any unicode in dict
        policy_str = json.dumps(policy, indent=2, default=str)
        print(policy_str.encode('ascii', 'replace').decode('ascii'))
        print("-" * 60)
        
        # 4. MLOps Dashboard Metrics
        print("MLOps Dashboard Metrics:")
        metrics = get_dashboard_metrics(db)
        metrics_str = json.dumps(metrics, indent=2, default=str)
        print(metrics_str.encode('ascii', 'replace').decode('ascii'))
        print("-" * 60)
        
    except Exception as e:
        print(f"Verification failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    verify()
