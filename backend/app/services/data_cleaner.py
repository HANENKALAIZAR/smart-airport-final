"""
Data Cleaner Service (v10)
===========================
Strict ML validation layer. Ensures no dirty telemetry from AviationStack
gets passed into the ML models.
"""

import logging
from typing import Dict
from datetime import timedelta
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.models.models import Flight, Airline, Airport

logger = logging.getLogger(__name__)

def run_data_cleaner(db: Session) -> Dict[str, int]:
    """
    Executes a strict data cleaning pipeline against the flights table.
    Returns metrics describing what was modified/dropped.
    """
    metrics = {
        "total_flights_before": 0,
        "invalid_flights_removed": 0,
        "duplicate_flights_removed": 0,
        "airlines_mapped_to_other": 0,
        "suspicious_routes_removed": 0,
        "batch_outliers_removed": 0,
        "total_valid_flights_after": 0
    }

    try:
        # Initial count
        metrics["total_flights_before"] = db.query(Flight).count()

        # 1. Gather all flight IDs to be removed (Anomalous, duplicate, or noisy)
        bad_ids = set()

        # Anomalous math or unrecoverable
        res1 = db.execute(text("""
            SELECT id FROM flights 
            WHERE scheduled_departure IS NULL
               OR dep_iata IS NULL 
               OR arr_iata IS NULL
               OR scheduled_arrival < scheduled_departure
               OR dep_iata = arr_iata
               OR (scheduled_arrival - scheduled_departure) < interval '30 minutes'
               OR (scheduled_arrival - scheduled_departure) > interval '10 hours'
        """)).fetchall()
        for r in res1: bad_ids.add(r[0])
        metrics["invalid_flights_removed"] += len(res1)

        # 2. Fix status consistency and math bounds (Active fields)
        db.execute(text("""
            UPDATE flights
            SET 
                status = CASE 
                    WHEN actual_departure IS NOT NULL AND status = 'scheduled' THEN 'on_time'
                    ELSE status
                END,
                delay_minutes = CASE
                    WHEN actual_departure IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (actual_departure - scheduled_departure)) / 60
                    ELSE delay_minutes
                END
        """))

        res2 = db.execute(text("""
            SELECT id FROM flights
            WHERE delay_minutes IS NOT NULL 
              AND (delay_minutes < 0 OR delay_minutes > 720)
        """)).fetchall()
        for r in res2: bad_ids.add(r[0])
        metrics["invalid_flights_removed"] += len(res2)

        db.execute(text("""
            UPDATE flight_features
            SET is_delayed = CASE WHEN (SELECT delay_minutes FROM flights WHERE id = flight_features.flight_id) > 15 THEN 1 ELSE 0 END
            WHERE flight_id IN (SELECT id FROM flights)
        """))

        # 3. Codeshare Deduplication
        res3 = db.execute(text("""
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY dep_iata, arr_iata, scheduled_departure
                           ORDER BY (actual_departure IS NULL) ASC, id ASC
                       ) as rn
                FROM flights
            ) t
            WHERE t.rn > 1
        """)).fetchall()
        for r in res3: bad_ids.add(r[0])
        metrics["duplicate_flights_removed"] += len(res3)

        # 4. Unknown Aircraft Types
        db.execute(text("""
            UPDATE flights
            SET aircraft_type = 'UNKNOWN'
            WHERE aircraft_type IS NULL OR trim(aircraft_type) = ''
        """))

        # 5. Clean Airline Data (Disabled per requirements. Preserve all valid airlines)
        metrics["airlines_mapped_to_other"] = 0


        # 6. Distance Recalculation via Spatial Logic
        # Update distances exactly based on coordinates where 0
        from app.services.feature_pipeline import _haversine_km
        print("Starting N+1 distance fetch")
        flights_missing_dist = db.query(Flight).filter(Flight.distance_km == 0).all()
        for f in flights_missing_dist:
            if f.origin_airport and f.dest_airport and f.origin_airport.latitude and f.origin_airport.longitude and f.dest_airport.latitude and f.dest_airport.longitude:
                km = _haversine_km(
                    float(f.origin_airport.latitude), float(f.origin_airport.longitude),
                    float(f.dest_airport.latitude), float(f.dest_airport.longitude)
                )
                f.distance_km = km
        
        db.flush()
        print("Step 6 done")

        # 7. Suspicious Routes (Disabled per requirements. Low frequency != invalid)
        # We simply retain them in the db.


        # 8. Unreliable Batch Patterns (Only applied to PAST flights)
        res7 = db.execute(text("""
            WITH daily_stats AS (
                SELECT 
                    dep_iata, 
                    DATE(scheduled_departure) as flight_date,
                    COUNT(*) as total_flights,
                    COUNT(actual_departure) as observed_departures
                FROM flights
                WHERE scheduled_departure < NOW() - INTERVAL '1 day'
                GROUP BY dep_iata, DATE(scheduled_departure)
            ),
            bad_batches AS (
                SELECT dep_iata, flight_date
                FROM daily_stats
                WHERE total_flights > 5 
                  AND (observed_departures::FLOAT / total_flights) < 0.20
            )
            SELECT flights.id 
            FROM flights
            JOIN bad_batches 
              ON flights.dep_iata = bad_batches.dep_iata 
             AND DATE(flights.scheduled_departure) = bad_batches.flight_date
        """)).fetchall()
        for r in res7: bad_ids.add(r[0])
        metrics["batch_outliers_removed"] = len(res7)

        # ==============================================================
        # Execution Phase (Wiping relationships safely)
        # ==============================================================
        if bad_ids:
            # We must convert set to list to bind array logic for SQLAlchemy IN clause seamlessly
            ids_tuple = tuple(bad_ids)
            
            db.execute(text("DELETE FROM predictions WHERE flight_id IN :ids"), {"ids": ids_tuple})
            db.execute(text("DELETE FROM flight_features WHERE flight_id IN :ids"), {"ids": ids_tuple})
            db.execute(text("DELETE FROM flights WHERE id IN :ids"), {"ids": ids_tuple})

            # Cleanup
            metrics["invalid_flights_removed"] = len(bad_ids) - metrics["batch_outliers_removed"] - metrics["duplicate_flights_removed"]
            # To avoid metric drift logic, let's keep the discrete metrics as evaluated, because the total bad_ids set size handles distinct unions.

        # Commit Operations
        db.commit()

        # Gather final counts
        metrics["total_valid_flights_after"] = db.query(Flight).count()

        logger.info(f"Data Cleaner execution finished: {metrics}")
        return metrics

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"SQLAlchemy Data Cleaner transaction aborted: {e}")
        return metrics
