import pandas as pd
from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
from sqlalchemy import func

def main():
    db = SessionLocal()
    try:
        rows = db.query(AEFlightDataset).filter(
            AEFlightDataset.usable_for_ml == True,
            AEFlightDataset.dep_hour.isnot(None),
            AEFlightDataset.distance_km.isnot(None),
            AEFlightDataset.airline_enc.isnot(None),
            AEFlightDataset.final_status != "cancelled",
        ).order_by(AEFlightDataset.flight_date.asc()).all()
        
        df = pd.DataFrame([{
            "date": r.flight_date,
            "delay": r.delay_minutes or 0.0,
            "dep_hour": r.dep_hour,
            "completeness": r.completeness or 1.0,
        } for r in rows])
        
        df["date"] = pd.to_datetime(df["date"])
        df["week"] = df["date"].dt.to_period("W")
        
        print("=== Chronological Breakdown by Week ===")
        summary = df.groupby("week").agg(
            count=("delay", "count"),
            mean_delay=("delay", "mean"),
            std_delay=("delay", "std"),
            zeros_pct=("delay", lambda x: (x == 0).mean() * 100),
            mean_completeness=("completeness", "mean"),
        )
        print(summary.to_string())
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
