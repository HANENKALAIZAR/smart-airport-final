"""
Operational Intelligence Module
===============================
Generates high-level aviation insights from computed statistics (AEAviationStats).
No static templates — all data is derived from actual historical patterns.

Insights:
1. Congestion Forecast (Hourly airport pressure)
2. High-Risk Route Detection (Routes with high delay rates)
3. Airline Reliability Rankings
4. Airport Pressure Scoring
"""

import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.ae_models import AEAviationStats

logger = logging.getLogger(__name__)

def get_operational_intelligence(db: Session):
    """
    Returns a comprehensive operational report based on real historical data.
    """
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "congestion_forecast": [],
        "high_risk_routes": [],
        "airline_reliability": [],
        "airport_pressure": []
    }

    # 1. Congestion Forecast (Hourly pressure)
    # Hour stats are stored with entity_key = '0'...'23'
    hour_stats = db.query(AEAviationStats).filter(AEAviationStats.stat_type == 'hour').all()
    for s in hour_stats:
        hour = int(s.entity_key)
        # Pressure score is a mix of volume and delay rate
        pressure = (s.total_flights or 0) * (s.delay_rate or 0)
        report["congestion_forecast"].append({
            "hour": hour,
            "pressure_score": round(pressure, 2),
            "avg_delay": round(s.avg_delay_min or 0, 1),
            "status": "Critical" if pressure > 5 else ("High" if pressure > 2 else "Normal")
        })
    report["congestion_forecast"].sort(key=lambda x: x["hour"])

    # 2. High-Risk Routes
    # Route stats: entity_key = 'DEP→ARR'
    route_stats = db.query(AEAviationStats).filter(
        AEAviationStats.stat_type == 'route',
        AEAviationStats.total_flights >= 5  # Minimum sample size
    ).order_by(AEAviationStats.delay_rate.desc()).limit(10).all()

    for s in route_stats:
        report["high_risk_routes"].append({
            "route": s.entity_key,
            "delay_rate": round((s.delay_rate or 0) * 100, 1),
            "avg_delay": round(s.avg_delay_min or 0, 1),
            "total_flights": s.total_flights
        })

    # 3. Airline Reliability
    airline_stats = db.query(AEAviationStats).filter(
        AEAviationStats.stat_type == 'airline',
        AEAviationStats.total_flights >= 10
    ).order_by(AEAviationStats.reliability_score.desc()).all()

    for s in airline_stats:
        report["airline_reliability"].append({
            "airline": s.entity_key,
            "reliability_score": round((s.reliability_score or 0) * 100, 1),
            "on_time_rate": round((s.on_time_rate or 0) * 100, 1),
            "avg_delay": round(s.avg_delay_min or 0, 1)
        })

    # 4. Airport Pressure
    airport_stats = db.query(AEAviationStats).filter(AEAviationStats.stat_type == 'airport').all()
    for s in airport_stats:
        report["airport_pressure"].append({
            "airport": s.entity_key,
            "total_flights": s.total_flights,
            "avg_delay": round(s.avg_delay_min or 0, 1),
            "delay_rate": round((s.delay_rate or 0) * 100, 1),
            "pressure_status": "Overloaded" if (s.delay_rate or 0) > 0.4 else "Stable"
        })

    return report
