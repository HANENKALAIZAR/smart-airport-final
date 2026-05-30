from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, case, and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_approved_admin
from app.models.models import User, PassengerAlertSubscription, PassengerAlertLog
from app.models.ae_models import AEFlightSnapshot, AEFlightDataset, AEAviationStats, AEPredictionLog

router = APIRouter(prefix="/api/admin", tags=["Admin Analytics"])

@router.get("/analytics")
def get_full_analytics(
    days: int = Query(30, description="Number of past days to include"),
    airport_id: Optional[int] = Query(None, description="Filter by airport ID. Ignored for now if IATA is needed instead."),
    airport_iata: Optional[str] = Query(None, description="Filter by airport IATA code"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_approved_admin),
) -> Dict[str, Any]:
    """
    Returns a comprehensive analytics payload based purely on REAL database data.
    Uses precise aviation logic for delay classification (delay > 15m) and explicitly 
    excludes cancelled/scheduled flights from performance metrics.
    
    CRITICAL: All sub-analytics (KPIs, Route, AI, Alerts) MUST strictly enforce 
    the EXACT same period filter (cutoff_date) to guarantee ONE Single Source of Truth.
    """
    
    # 1. Determine Cutoff Date
    latest_snapshot = db.query(func.max(AEFlightSnapshot.snapshot_date)).scalar()
    if latest_snapshot:
        cutoff_date = latest_snapshot - timedelta(days=days)
    else:
        cutoff_date = datetime.utcnow().date() - timedelta(days=days)
        
    # --- FILTERS ---
    ds_filter = [AEFlightDataset.flight_date >= cutoff_date]
    
    if airport_iata:
        iata = airport_iata.upper()
        ds_filter.append(or_(AEFlightDataset.dep_iata == iata, AEFlightDataset.arr_iata == iata))

    # ==========================================
    # FLIGHT STATUS NORMALIZATION & SUMMARY
    # ==========================================
    active_statuses = ['in_air', 'active', 'airborne', 'departed', 'delayed']
    
    total_flights = db.query(func.count(AEFlightDataset.id)).filter(*ds_filter).scalar() or 0
    cancelled_flights = db.query(func.count(AEFlightDataset.id)).filter(*ds_filter, AEFlightDataset.final_status == 'cancelled').scalar() or 0
    scheduled_flights = db.query(func.count(AEFlightDataset.id)).filter(*ds_filter, AEFlightDataset.final_status == 'scheduled').scalar() or 0
    landed_flights = db.query(func.count(AEFlightDataset.id)).filter(*ds_filter, AEFlightDataset.final_status == 'landed').scalar() or 0
    active_flights = db.query(func.count(AEFlightDataset.id)).filter(*ds_filter, AEFlightDataset.final_status.in_(active_statuses)).scalar() or 0

    # User counts (Global, not period-bound)
    total_users = db.query(func.count(User.id)).scalar() or 0
    
    # KPI Logic
    valid_base = db.query(func.count(AEFlightDataset.id)).filter(
        *ds_filter,
        AEFlightDataset.final_status.notin_(['cancelled', 'scheduled'])
    ).scalar() or 0

    delayed_flights = db.query(func.count(AEFlightDataset.id)).filter(
        *ds_filter,
        AEFlightDataset.final_status.notin_(['cancelled', 'scheduled']),
        AEFlightDataset.delay_minutes > 15
    ).scalar() or 0

    on_time_rate = 0.0
    if valid_base > 0:
        on_time_rate = round(((valid_base - delayed_flights) / valid_base) * 100, 1)

    avg_delay_row = db.query(func.avg(AEFlightDataset.delay_minutes)).filter(
        *ds_filter, 
        AEFlightDataset.final_status.notin_(['cancelled', 'scheduled']),
        AEFlightDataset.delay_minutes > 15
    ).scalar()
    average_delay = round(float(avg_delay_row), 1) if avg_delay_row else 0.0

    # ==========================================
    # DAILY PERFORMANCE
    # ==========================================
    daily_perf = []
    daily_query = (
        db.query(
            AEFlightDataset.flight_date,
            func.sum(case((AEFlightDataset.final_status.notin_(['cancelled', 'scheduled']), 1), else_=0)).label('valid_base'),
            func.sum(case((and_(AEFlightDataset.final_status.notin_(['cancelled', 'scheduled']), AEFlightDataset.delay_minutes > 15), 1), else_=0)).label('delayed'),
            func.sum(case((AEFlightDataset.final_status == 'cancelled', 1), else_=0)).label('cancelled'),
            func.avg(case((and_(AEFlightDataset.final_status.notin_(['cancelled', 'scheduled']), AEFlightDataset.delay_minutes > 15), AEFlightDataset.delay_minutes), else_=None)).label('avg_delay')
        )
        .filter(*ds_filter)
        .group_by(AEFlightDataset.flight_date)
        .order_by(AEFlightDataset.flight_date)
        .all()
    )
    
    for row in daily_query:
        v_base = row.valid_base or 0
        dly = row.delayed or 0
        canc = row.cancelled or 0
        ad = row.avg_delay or 0
        ot_rate = round(((v_base - dly) / v_base) * 100, 1) if v_base > 0 else (100.0 if dly == 0 else 0)
        daily_perf.append({
            "date": str(row.flight_date),
            "onTimeRate": ot_rate,
            "delayTrend": round(float(ad), 1),
            "cancellations": canc
        })

    # ==========================================
    # ROUTE ANALYTICS (Dynamically filtered by period!)
    # ==========================================
    route_analytics = []
    
    route_query = (
        db.query(
            AEFlightDataset.dep_iata,
            AEFlightDataset.arr_iata,
            func.count(AEFlightDataset.id).label('total_flights'),
            func.sum(case((AEFlightDataset.final_status.notin_(['cancelled', 'scheduled']), 1), else_=0)).label('valid_flights'),
            func.sum(case((and_(AEFlightDataset.final_status.notin_(['cancelled', 'scheduled']), AEFlightDataset.delay_minutes > 15), 1), else_=0)).label('delayed_flights'),
            func.avg(case((and_(AEFlightDataset.final_status.notin_(['cancelled', 'scheduled']), AEFlightDataset.delay_minutes > 15), AEFlightDataset.delay_minutes), else_=None)).label('avg_delay')
        )
        .filter(*ds_filter)
        .group_by(AEFlightDataset.dep_iata, AEFlightDataset.arr_iata)
        .order_by(func.count(AEFlightDataset.id).desc())
        .limit(10)
        .all()
    )
    
    for row in route_query:
        dep = row.dep_iata or 'UNK'
        arr = row.arr_iata or 'UNK'
        tf = row.total_flights or 0
        vf = row.valid_flights or 0
        df = row.delayed_flights or 0
        ad = row.avg_delay or 0
        
        dr = round((df / vf) * 100, 1) if vf > 0 else 0.0
        
        route_analytics.append({
            "route": f"{dep}→{arr}",
            "totalFlights": tf,
            "delayRate": dr,
            "averageDelay": round(float(ad), 1)
        })

    # ==========================================
    # DELAY FACTORS (INFERRED FROM REAL FIELDS)
    # ==========================================
    # Base filter for delayed flights
    base_delay_filter = [
        *ds_filter,
        AEFlightDataset.final_status.notin_(['cancelled', 'scheduled']),
        AEFlightDataset.delay_minutes > 15
    ]
    
    # 1. Peak Hour Congestion
    peak_delays = db.query(func.count(AEFlightDataset.id)).filter(
        *base_delay_filter,
        AEFlightDataset.is_peak_hour == 1
    ).scalar() or 0
    
    # 2. Awaiting Reconciliation (Not landed yet)
    reconcil_delays = db.query(func.count(AEFlightDataset.id)).filter(
        *base_delay_filter,
        AEFlightDataset.is_peak_hour == 0,
        AEFlightDataset.final_status != 'landed'
    ).scalar() or 0
    
    # 3. Incomplete Metadata (Missing key fields)
    incomplete_delays = db.query(func.count(AEFlightDataset.id)).filter(
        *base_delay_filter,
        AEFlightDataset.is_peak_hour == 0,
        AEFlightDataset.final_status == 'landed',
        or_(
            AEFlightDataset.dep_hour.is_(None),
            AEFlightDataset.duration_min.is_(None),
            AEFlightDataset.distance_km.is_(None)
        )
    ).scalar() or 0
    
    # 4. Operational Delays (Significant delays > 45m with valid metadata)
    operational_delays = db.query(func.count(AEFlightDataset.id)).filter(
        *base_delay_filter,
        AEFlightDataset.is_peak_hour == 0,
        AEFlightDataset.final_status == 'landed',
        AEFlightDataset.dep_hour.isnot(None),
        AEFlightDataset.duration_min.isnot(None),
        AEFlightDataset.distance_km.isnot(None),
        AEFlightDataset.delay_minutes > 45
    ).scalar() or 0
    
    # 5. Uncategorized Delays (The rest)
    uncategorized = max(0, delayed_flights - (peak_delays + reconcil_delays + incomplete_delays + operational_delays))
    
    delay_factors = []
    
    if delayed_flights > 0:
        if peak_delays > 0:
            delay_factors.append({"label": "Peak Hour Congestion", "count": peak_delays, "percentage": round((peak_delays / delayed_flights) * 100), "isInferred": True})
        if reconcil_delays > 0:
            delay_factors.append({"label": "Awaiting Reconciliation", "count": reconcil_delays, "percentage": round((reconcil_delays / delayed_flights) * 100), "isInferred": True})
        if incomplete_delays > 0:
            delay_factors.append({"label": "Incomplete Metadata", "count": incomplete_delays, "percentage": round((incomplete_delays / delayed_flights) * 100), "isInferred": True})
        if operational_delays > 0:
            delay_factors.append({"label": "Operational Delays", "count": operational_delays, "percentage": round((operational_delays / delayed_flights) * 100), "isInferred": True})
        if uncategorized > 0:
            delay_factors.append({"label": "Uncategorized Delays", "count": uncategorized, "percentage": round((uncategorized / delayed_flights) * 100), "isInferred": False})
    else:
        delay_factors.append({"label": "Uncategorized Delays", "count": 0, "percentage": 0, "isInferred": False})
        
    delay_factors = sorted(delay_factors, key=lambda x: x["count"], reverse=True)

    # ==========================================
    # AI ANALYTICS (Filtered by period!)
    # ==========================================
    ai_analytics = {
        "predictionsGenerated": 0,
        "averagePredictedDelay": 0.0,
        "predictionAccuracy": 0.0
    }
    
    # Safe date conversion for AI logs which use TIMESTAMP
    cutoff_datetime = datetime.combine(cutoff_date, datetime.min.time())
    
    pred_query = db.query(
        func.count(AEPredictionLog.id).label('total'),
        func.avg(AEPredictionLog.predicted_delay_min).label('avg_pred'),
        func.avg(func.abs(AEPredictionLog.prediction_error)).label('avg_error')
    ).filter(AEPredictionLog.prediction_timestamp >= cutoff_datetime)
    
    if airport_iata:
        pred_query = pred_query.filter(
            or_(AEPredictionLog.dep_iata == airport_iata, AEPredictionLog.arr_iata == airport_iata)
        )
        
    pred_stats = pred_query.first()
    if pred_stats and pred_stats.total:
        ai_analytics["predictionsGenerated"] = pred_stats.total
        ai_analytics["averagePredictedDelay"] = round(float(pred_stats.avg_pred or 0), 1)
        avg_err = float(pred_stats.avg_error or 0)
        ai_analytics["predictionAccuracy"] = round(max(0.0, 100.0 - avg_err), 1)

    # ==========================================
    # ALERT ANALYTICS (Filtered by period!)
    # ==========================================
    # Active subs are current state, but alertsSent should be period-bound
    total_alerts_period = db.query(func.count(PassengerAlertLog.id)).filter(
        PassengerAlertLog.created_at >= cutoff_datetime
    ).scalar() or 0
    
    active_subs = db.query(func.count(PassengerAlertSubscription.id)).scalar() or 0
    most_alerted = db.query(
        PassengerAlertSubscription.flight_number,
        func.count(PassengerAlertSubscription.id).label('cnt')
    ).group_by(PassengerAlertSubscription.flight_number).order_by(func.count(PassengerAlertSubscription.id).desc()).limit(3).all()

    alert_analytics = {
        "alertsSent": total_alerts_period,
        "activeSubscriptions": active_subs,
        "mostAlertedFlights": [row.flight_number for row in most_alerted]
    }

    # ==========================================
    # EXECUTIVE SUMMARY & NBE AUDIT
    # ==========================================
    summary_text = "No operational analytics available for the selected period."
    if total_flights > 0:
        busiest_route = route_analytics[0]["route"] if route_analytics else "Unknown"
        
        if on_time_rate >= 75:
            perf_desc = f"Operational punctuality remains strong with {on_time_rate}% on-time performance"
        elif on_time_rate <= 55:
            perf_desc = f"Operational performance declined due to elevated delays ({round(100 - on_time_rate, 1)}% delayed)"
        else:
            perf_desc = f"Operations are running at standard capacity with {on_time_rate}% on-time performance"
            
        traffic_desc = f"across {valid_base} tracked flights. The busiest route remains {busiest_route}."
        if valid_base < 50:
            traffic_desc = f"across a limited sample of {valid_base} tracked flights. The busiest route is {busiest_route}."
            
        ai_desc = f"AI models actively generated {ai_analytics['predictionsGenerated']} predictions to assist operations."
        if ai_analytics['predictionsGenerated'] == 0:
            ai_desc = "Limited AI operational activity recorded for this period."

        summary_text = f"{perf_desc} {traffic_desc} Most delays are currently uncategorized due to limited source attribution. {ai_desc}"

    return {
        "summary": {
            "totalFlights": total_flights,
            "activeFlights": active_flights,
            "delayedFlights": delayed_flights,
            "cancelledFlights": cancelled_flights,
            "landedFlights": landed_flights,
            "scheduledFlights": scheduled_flights,
            "totalUsers": total_users,
            "totalAlerts": total_alerts_period,
            "averageDelay": average_delay,
            "onTimeRate": on_time_rate,
            "limitedSampleSize": valid_base < 50
        },
        "dailyPerformance": daily_perf,
        "routeAnalytics": route_analytics,
        "delayFactors": delay_factors,
        "aiAnalytics": ai_analytics,
        "alertAnalytics": alert_analytics,
        "executiveSummary": summary_text
    }
