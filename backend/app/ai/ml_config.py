"""
ML Configuration – Phase 3B Pipeline Normalization
===================================================
Centralized XGBoost hyperparameters and feature definitions
shared between training pipelines and prediction inference.

=============================================================
DEPRECATED — V10 legacy configuration only
This file is NOT used by any active pipeline.
Active config is inline in train_v2.py and ml_config is
referenced only for historical hyperparameter documentation.
Do NOT import from this file in new code.
=============================================================
"""

# Core features used in v10 ML pipeline
FEATURE_COLUMNS = [
    "weather_severity",
    "origin_weather_severity",
    "dest_weather_severity",
    "temperature_c",
    "wind_speed_kmh",
    "visibility_km",
    "precipitation_mm",
    "hour_of_day",
    "day_of_week",
    "month",
    "is_weekend",
    "is_holiday",
    "congestion_level",
    "origin_congestion",
    "dest_congestion",
    "airline_reliability",
    "distance_km",
    "historical_delay_rate",
]

# Shared hyperparameters for XGBoost binary delay classifier
CLASSIFIER_PARAMS = {
    "n_estimators": 200,
    "max_depth": 6,
    "learning_rate": 0.1,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 3,
    "gamma": 0.1,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "random_state": 42,
    "eval_metric": "logloss",
}

# Shared hyperparameters for XGBoost delay duration regressor
REGRESSOR_PARAMS = {
    "n_estimators": 150,
    "max_depth": 5,
    "learning_rate": 0.1,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "random_state": 42,
}
