import pandas as pd
from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.model_selection import train_test_split

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
        
        # 1. Chronological Time-based split on full dataset (10774 rows)
        sub_df = df.iloc[:10774].copy()
        cutoff_idx = int(len(sub_df) * 0.8)
        train_time = sub_df.iloc[:cutoff_idx]
        test_time = sub_df.iloc[cutoff_idx:]
        
        model_time = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1))
        ])
        model_time.fit(train_time[features].values, train_time[target].values)
        r2_time = r2_score(test_time[target].values, model_time.predict(test_time[features].values))
        
        # 2. Random split on full dataset (10774 rows)
        X_train_rand, X_test_rand, y_train_rand, y_test_rand = train_test_split(
            sub_df[features].values, sub_df[target].values, test_size=0.2, random_state=42
        )
        model_rand = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1))
        ])
        model_rand.fit(X_train_rand, y_train_rand)
        r2_rand = r2_score(y_test_rand, model_rand.predict(X_test_rand))
        
        print(f"Time-based split R2: {r2_time:6.4f}")
        print(f"Random split R2: {r2_rand:6.4f}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
