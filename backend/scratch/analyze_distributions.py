import pandas as pd
from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
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
        
        size = 10774
        sub_df = df.iloc[:size].copy()
        cutoff_idx = int(len(sub_df) * 0.8)
        train = sub_df.iloc[:cutoff_idx]
        test = sub_df.iloc[cutoff_idx:]
        
        for name, split in [("Train", train), ("Test", test)]:
            delays = split["delay"]
            zeros_pct = (delays == 0).mean() * 100
            print(f"=== {name} Split ===")
            print(f"Count: {len(split)}")
            print(f"Mean delay: {delays.mean():.2f} min")
            print(f"Std delay: {delays.std():.2f} min")
            print(f"Zeros percentage: {zeros_pct:.1f}%")
            print(f"Percentiles:")
            for p in [25, 50, 75, 90, 95, 99]:
                print(f"  {p}th: {np.percentile(delays, p):.2f}")
            print()
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
