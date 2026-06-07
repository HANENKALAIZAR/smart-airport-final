import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(str(Path("c:/Users/gzhan/Downloads/smart-airport-postgres-feature-cleaned-up-the-chaos/backend").resolve()))

from app.database import SessionLocal
from app.routers.admin_analytics import get_full_analytics

def run_scenario(db, days, iata):
    print(f"\n--- Testing Scenario: {iata} for {days} days ---")
    try:
        res = get_full_analytics(days=days, airport_iata=iata, db=db, _user=None)
        
        # Verify required keys exist
        required_keys = ["summary", "dailyPerformance", "routeAnalytics", "delayAnalytics", "aiAnalytics", "alertAnalytics", "executiveSummary"]
        missing = [k for k in required_keys if k not in res]
        if missing:
            print(f"  [ERROR] Missing top-level keys: {missing}")
        else:
            print("  [OK] All top-level keys present.")
            
        # Verify summary keys
        summary_req = ["totalFlights", "activeFlights", "delayedFlights", "cancelledFlights", "landedFlights", "scheduledFlights", "limitedSampleSize", "onTimeRate"]
        missing_sum = [k for k in summary_req if k not in res["summary"]]
        if missing_sum:
            print(f"  [ERROR] Missing summary keys: {missing_sum}")
        else:
            print(f"  [OK] Summary populated (total: {res['summary']['totalFlights']}, limit flag: {res['summary']['limitedSampleSize']})")
            
        # Verify route analytics keys
        if res["routeAnalytics"]:
            rt = res["routeAnalytics"][0]
            if "averageDelay" not in rt:
                print("  [ERROR] averageDelay missing from routeAnalytics!")
            else:
                print("  [OK] routeAnalytics contains averageDelay.")
        else:
            print("  [INFO] routeAnalytics is empty.")
            
        print("  Executive Summary:", res["executiveSummary"])
    except Exception as e:
        print(f"  [ERROR] Exception: {e}")

def main():
    db = SessionLocal()
    try:
        run_scenario(db, 7, "TUN")
        run_scenario(db, 30, "TUN")
        run_scenario(db, 7, "DJE")
        run_scenario(db, 30, "MIR")
        run_scenario(db, 30, "NBE")
    finally:
        db.close()

if __name__ == "__main__":
    main()
