import pandas as pd
from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score

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
            "dep_hour": r.dep_hour,
            "is_weekend": r.is_weekend,
            "distance_km": r.distance_km,
            "duration_min": r.duration_min,
            "airline_enc": r.airline_enc,
            "dep_airport_enc": r.dep_airport_enc,
            "arr_airport_enc": r.arr_airport_enc,
            "delay": r.delay_minutes or 0.0
        } for r in rows])
        
        features = ["dep_hour", "is_weekend", "distance_km", "duration_min", "airline_enc", "dep_airport_enc", "arr_airport_enc"]
        target = "delay"
        
        size = 10774
        sub_df = df.iloc[:size].copy()
        cutoff_idx = int(len(sub_df) * 0.8)
        train = sub_df.iloc[:cutoff_idx]
        test = sub_df.iloc[cutoff_idx:].copy()
        
        model = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1))
        ])
        model.fit(train[features].values, train[target].values)
        test["pred"] = model.predict(test[features].values)
        
        print("=== R2 Score and Variance by Day in Test Split ===")
        test["date"] = pd.to_datetime(test["date"])
        for d, grp in test.groupby(test["date"].dt.date):
            y_t = grp[target].values
            y_p = grp["pred"].values
            r2 = r2_score(y_t, y_p) if len(y_t) > 1 else 0
            print(f"Date: {d} | Flights: {len(grp):3d} | Actual Mean: {y_t.mean():5.2f} | Pred Mean: {y_p.mean():5.2f} | Actual Std: {y_t.std():5.2f} | R2: {r2:6.3f}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
