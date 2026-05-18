"""
Rolling Statistics Feature Builder
====================================
Computes prediction-safe rolling/aggregate features from TRAINING DATA ONLY.

Leakage guarantee
-----------------
All rolling statistics are computed from the training split and then applied
to both train AND test sets.  No future information ever crosses the time
boundary.  delay_minutes is ONLY used to compute the target — it is NEVER
included as an input feature.

Features added (all computed from training data, safe at prediction time):
    route_avg_delay_hist    — historical mean delay for dep→arr route (training set)
    airline_avg_delay_hist  — historical mean delay for airline (training set)
    hour_avg_delay_hist     — historical mean delay for that departure hour
    route_flight_count      — number of training flights on that route (density proxy)
    airline_flight_count    — number of training flights for that airline
    airport_departure_count — number of training flights departing from that airport
    dep_month               — calendar month (1-12) from flight_date
    dep_day_of_week         — day of week (0=Mon … 6=Sun) from flight_date

Usage
-----
    from app.ml.rolling_features import enrich_with_rolling_features
    train_df, test_df = enrich_with_rolling_features(train_df, test_df)
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Feature names produced by this module ─────────────────────────────────────
ROLLING_FEATURE_COLUMNS = [
    "route_avg_delay_hist",
    "airline_avg_delay_hist",
    "hour_avg_delay_hist",
    "route_flight_count",
    "airline_flight_count",
    "airport_departure_count",
    "dep_month",
    "dep_day_of_week",
]

# Columns required to be present in the input DataFrames
_REQUIRED_INPUT = [
    "_dep_iata", "_arr_iata", "_airline_iata", "_flight_date",
    "dep_hour", "delay_minutes",
]


def _compute_lookup_tables(train_df: pd.DataFrame) -> dict:
    """
    Build all lookup tables from TRAINING data only.
    Returns a dict of {feature_name: lookup_dict or scalar}.
    """
    target = "delay_minutes"
    global_mean = float(train_df[target].mean())

    route_key = train_df["_dep_iata"].astype(str) + "->" + train_df["_arr_iata"].astype(str)

    route_stats = train_df.copy()
    route_stats["_route_key"] = route_key
    route_avg = route_stats.groupby("_route_key")[target].mean().to_dict()
    route_cnt = route_stats.groupby("_route_key")[target].count().to_dict()

    airline_avg = train_df.groupby("_airline_iata")[target].mean().to_dict()
    airline_cnt = train_df.groupby("_airline_iata")[target].count().to_dict()

    hour_avg = train_df.groupby("dep_hour")[target].mean().to_dict()

    airport_cnt = train_df.groupby("_dep_iata")[target].count().to_dict()

    return {
        "route_avg":   route_avg,
        "route_cnt":   route_cnt,
        "airline_avg": airline_avg,
        "airline_cnt": airline_cnt,
        "hour_avg":    hour_avg,
        "airport_cnt": airport_cnt,
        "global_mean": global_mean,
    }


def _apply_lookups(df: pd.DataFrame, tables: dict) -> pd.DataFrame:
    """Apply pre-computed lookup tables to a DataFrame (train or test)."""
    df = df.copy()
    gm = tables["global_mean"]

    route_key = df["_dep_iata"].astype(str) + "->" + df["_arr_iata"].astype(str)

    df["route_avg_delay_hist"]  = route_key.map(tables["route_avg"]).fillna(gm)
    df["airline_avg_delay_hist"] = df["_airline_iata"].map(tables["airline_avg"]).fillna(gm)
    df["hour_avg_delay_hist"]   = df["dep_hour"].map(tables["hour_avg"]).fillna(gm)
    df["route_flight_count"]    = route_key.map(tables["route_cnt"]).fillna(0).astype(int)
    df["airline_flight_count"]  = df["_airline_iata"].map(tables["airline_cnt"]).fillna(0).astype(int)
    df["airport_departure_count"] = df["_dep_iata"].map(tables["airport_cnt"]).fillna(0).astype(int)

    # Calendar features — safe because they come from flight_date (scheduling info,
    # not from the actual observed outcome)
    flight_dates = pd.to_datetime(df["_flight_date"], errors="coerce")
    df["dep_month"]       = flight_dates.dt.month.fillna(0).astype(int)
    df["dep_day_of_week"] = flight_dates.dt.dayofweek.fillna(0).astype(int)

    return df


def enrich_with_rolling_features(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Main entry point.  Computes rolling/historical statistics from train_df
    only, then applies them to both train_df and test_df.

    Returns
    -------
    enriched_train_df, enriched_test_df
    Both contain all ROLLING_FEATURE_COLUMNS appended.

    Raises
    ------
    ValueError if required columns are missing from train_df.
    """
    missing = [c for c in _REQUIRED_INPUT if c not in train_df.columns]
    if missing:
        raise ValueError(
            f"Rolling feature builder: missing required columns in train_df: {missing}. "
            "Ensure _dep_iata, _arr_iata, _airline_iata, _flight_date, dep_hour, "
            "delay_minutes are present as metadata columns."
        )

    logger.info(
        f"[RollingFeatures] Computing lookup tables from {len(train_df)} training rows..."
    )
    tables = _compute_lookup_tables(train_df)

    train_enriched = _apply_lookups(train_df, tables)
    test_enriched  = _apply_lookups(test_df, tables)

    logger.info(
        f"[RollingFeatures] Enriched train={len(train_enriched)} test={len(test_enriched)} "
        f"with {len(ROLLING_FEATURE_COLUMNS)} additional features"
    )
    return train_enriched, test_enriched


def get_rolling_features_for_inference(
    dep_iata: Optional[str],
    arr_iata: Optional[str],
    airline_iata: Optional[str],
    dep_hour: Optional[int],
    flight_date,
    db,
) -> dict:
    """
    Compute rolling features for a SINGLE FLIGHT at inference time.
    Reads ae_aviation_stats (pre-computed aggregates) rather than raw ae_flight_dataset
    to avoid loading the full training set at inference time.

    This is prediction-safe: ae_aviation_stats contains only historical aggregates
    computed from past data — never from the flight being predicted.
    """
    from app.models.ae_models import AEAviationStats

    def _get_stat(stat_type: str, key: str):
        if not key:
            return None
        row = db.query(AEAviationStats).filter(
            AEAviationStats.stat_type == stat_type,
            AEAviationStats.entity_key == key,
        ).first()
        return row

    route_key = f"{dep_iata or 'UNK'}\u2192{arr_iata or 'UNK'}"
    route_stat   = _get_stat("route",   route_key)
    airline_stat = _get_stat("airline", airline_iata or "UNK")
    hour_stat    = _get_stat("hour",    str(dep_hour) if dep_hour is not None else "UNK")
    airport_stat = _get_stat("airport", dep_iata or "UNK")

    gm = 21.0  # approximate global mean delay; updated after each training run

    try:
        import datetime
        if isinstance(flight_date, str):
            d = pd.to_datetime(flight_date, errors="coerce")
        else:
            d = pd.Timestamp(flight_date) if flight_date else None
        dep_month       = d.month       if d and not pd.isnull(d) else 0
        dep_day_of_week = d.dayofweek   if d and not pd.isnull(d) else 0
    except Exception:
        dep_month = 0
        dep_day_of_week = 0

    return {
        "route_avg_delay_hist":   float(route_stat.avg_delay_min)   if route_stat   and route_stat.avg_delay_min   is not None else gm,
        "airline_avg_delay_hist": float(airline_stat.avg_delay_min) if airline_stat and airline_stat.avg_delay_min is not None else gm,
        "hour_avg_delay_hist":    float(hour_stat.avg_delay_min)    if hour_stat    and hour_stat.avg_delay_min    is not None else gm,
        "route_flight_count":     int(route_stat.total_flights)     if route_stat   and route_stat.total_flights   is not None else 0,
        "airline_flight_count":   int(airline_stat.total_flights)   if airline_stat and airline_stat.total_flights is not None else 0,
        "airport_departure_count":int(airport_stat.total_flights)   if airport_stat and airport_stat.total_flights is not None else 0,
        "dep_month":              dep_month,
        "dep_day_of_week":        dep_day_of_week,
    }
