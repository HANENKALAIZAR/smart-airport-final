import pandas as pd
from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
from sqlalchemy import func
import numpy as np

def main():
    db = SessionLocal()
    try:
        # Load usable rows
        rows = db.query(AEFlightDataset).filter(
            AEFlightDataset.usable_for_ml == True,
            AEFlightDataset.dep_hour.isnot(None),
            AEFlightDataset.distance_km.isnot(None),
            AEFlightDataset.airline_enc.isnot(None),
            AEFlightDataset.final_status != "cancelled",
        ).order_by(AEFlightDataset.flight_date.asc()).all()
        
        df = pd.DataFrame([{
            "date": r.flight_date,
            "delay": r.delay_minutes or 0.0
        } for r in rows])
        
        print(f"Total usable flights loaded: {len(df)}")
        
        # Analyze R2 variance over different chronological cutoffs
        sizes = [7931, 8481, 8851, 9077, 9637, 9856, 10509, 10774]
        for size in sizes:
            sub_df = df.iloc[:size].copy()
            cutoff_idx = int(len(sub_df) * 0.8)
            train = sub_df.iloc[:cutoff_idx]
            test = sub_df.iloc[cutoff_idx:]
            
            y_train = train["delay"]
            y_test = test["delay"]
            
            # Grand mean baseline R2 (always 0 by definition on the test set if predicting test mean, 
            # but here predicting train mean onto test set)
            train_mean = y_train.mean()
            ss_tot = np.sum((y_test - y_test.mean()) ** 2)
            ss_res_global_mean = np.sum((y_test - train_mean) ** 2)
            r2_global_mean = 1.0 - (ss_res_global_mean / ss_tot) if ss_tot > 0 else 0
            
            print(f"Dataset Size {size:5d}: "
                  f"Train Mean: {train_mean:5.2f} | "
                  f"Test Mean: {y_test.mean():5.2f} | "
                  f"Test Std: {y_test.std():5.2f} | "
                  f"Global Mean R2 on Test: {r2_global_mean:6.3f}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
