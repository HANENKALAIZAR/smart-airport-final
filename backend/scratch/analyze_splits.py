import pandas as pd
from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error

def main():
    db = SessionLocal()
    try:
        # Load usable rows
        rows = db.query(AEFlightDataset).filter(
            AEFlightDataset.usable_for_ml == True,
            AEFlightDataset.dep_hour.isnot(None),
            AEFlightDataset.distance_km.isnot(None),
            AEFlightDataset.airline_enc.isnot(None),
        ).order_by(AEFlightDataset.flight_date.asc()).all()
        
        df = pd.DataFrame([{
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
        
        sizes = [7931, 8481, 8851, 9077, 9637, 9856, 10509, 10774]
        for size in sizes:
            sub_df = df.iloc[:size].copy()
            cutoff_idx = int(len(sub_df) * 0.8)
            train = sub_df.iloc[:cutoff_idx]
            test = sub_df.iloc[cutoff_idx:]
            
            X_train = train[features].values
            y_train = train[target].values
            X_test = test[features].values
            y_test = test[target].values
            
            model = Pipeline([
                ("scaler", StandardScaler()),
                ("regressor", RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1))
            ])
            model.fit(X_train, y_train)
            
            train_preds = model.predict(X_train)
            test_preds = model.predict(X_test)
            
            train_r2 = r2_score(y_train, train_preds)
            test_r2 = r2_score(y_test, test_preds)
            
            print(f"Size {size:5d} | Train R2: {train_r2:6.4f} | Test R2: {test_r2:6.4f} | "
                  f"Test Mean: {y_test.mean():5.2f} | Test Std: {y_test.std():5.2f}")
                  
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
