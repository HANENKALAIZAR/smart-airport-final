import logging
import json
import sys

# Force UTF-8 output
import io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from app.database import SessionLocal
from app.ai.mlops_controller import run_auto_retrain, check_retraining_policy

def main():
    db = SessionLocal()
    try:
        print("Checking retraining policy...")
        policy = check_retraining_policy(db)
        print(f"Policy Should Retrain: {policy['should_retrain']}")
        print(f"Triggers: {policy['triggers']}")
        
        print("\nRunning auto-retrain...")
        res = run_auto_retrain(db)
        
        # Clean training results for printing (evaluation_path is removed in run_auto_retrain already)
        res_str = json.dumps(res, indent=2, default=str)
        print("\nResult:")
        print(res_str)
    except Exception as e:
        print(f"Error during retrain: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
