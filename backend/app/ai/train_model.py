"""
[DEPRECATED — kept for reference only]
===========================================================
This file trained on a CSV dataset (data/flights_dataset.csv) using a
classification+regression pipeline with weather/congestion features.

It has been SUPERSEDED by:
  → app/ai/train_ae_dataset.py  (production AE pipeline, 100% real data)

DO NOT invoke this file in production. The active APScheduler auto-retrain
job calls train_ae_model() from train_ae_dataset.py exclusively.
===========================================================

Smart Airport Operations – XGBoost Model Training (Legacy CSV)
====================================================
Trains a delay prediction model using the generated dataset.

Usage:
    cd backend
    python -m app.ai.train_model

Outputs:
    app/ai/model/delay_classifier.json   – XGBoost binary classifier
    app/ai/model/delay_regressor.json    – XGBoost delay minutes regressor
    app/ai/model/shap_explainer.pkl      – SHAP TreeExplainer
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix,
    mean_absolute_error, mean_squared_error, r2_score,
)
import xgboost as xgb
import shap

from app.ai.ml_config import CLASSIFIER_PARAMS, REGRESSOR_PARAMS

# ── Paths ────────────────────────────────────────────────────

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "flights_dataset.csv"
MODEL_DIR = Path(__file__).resolve().parent / "model"

FEATURE_COLUMNS = [
    "weather_severity",
    "origin_weather_severity",
    "dest_weather_severity",
    "hour_of_day",
    "day_of_week",
    "month",
    "is_weekend",
    "congestion_level",
    "origin_congestion",
    "dest_congestion",
    "airline_reliability",
    "distance_km",
    "historical_delay_rate",
]

TARGET_CLASS = "is_delayed"
TARGET_REG = "delay_minutes"


def load_data() -> pd.DataFrame:
    """Load and validate the dataset."""
    print(f"📂 Loading data from: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    print(f"   Shape: {df.shape}")
    print(f"   Delay rate: {df[TARGET_CLASS].mean()*100:.1f}%")
    print(f"   Columns: {len(df.columns)}")
    return df


def train_classifier(X_train, X_test, y_train, y_test) -> xgb.XGBClassifier:
    """Train XGBoost binary classifier for delay prediction."""
    print("\n🤖 Training Delay Classifier...")

    model = xgb.XGBClassifier(
        **CLASSIFIER_PARAMS,
        scale_pos_weight=(len(y_train) - sum(y_train)) / max(sum(y_train), 1),
        use_label_encoder=False,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # ── Evaluation ──
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    print("\n📊 Classification Results:")
    print(f"   Accuracy:  {accuracy_score(y_test, y_pred)*100:.1f}%")
    print(f"   Precision: {precision_score(y_test, y_pred)*100:.1f}%")
    print(f"   Recall:    {recall_score(y_test, y_pred)*100:.1f}%")
    print(f"   F1 Score:  {f1_score(y_test, y_pred)*100:.1f}%")
    print(f"\n{classification_report(y_test, y_pred, target_names=['On Time', 'Delayed'])}")

    cm = confusion_matrix(y_test, y_pred)
    print(f"   Confusion Matrix:")
    print(f"   {cm}")

    # Feature importance
    print("\n📈 Feature Importance (gain):")
    importances = model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    for i in sorted_idx:
        print(f"   {FEATURE_COLUMNS[i]:30s}  {importances[i]:.4f}")

    return model


def train_regressor(X_train, X_test, y_train, y_test) -> xgb.XGBRegressor:
    """Train XGBoost regressor for delay duration prediction."""
    print("\n🤖 Training Delay Regressor (minutes)...")

    # Only train on delayed flights
    mask_train = y_train > 0
    mask_test = y_test > 0

    if mask_train.sum() == 0:
        print("   ⚠️  No delayed flights in training set!")
        return None

    model = xgb.XGBRegressor(**REGRESSOR_PARAMS)

    model.fit(
        X_train[mask_train], y_train[mask_train],
        eval_set=[(X_test[mask_test], y_test[mask_test])],
        verbose=False,
    )

    # ── Evaluation ──
    y_pred = model.predict(X_test[mask_test])
    y_pred = np.maximum(y_pred, 0)  # no negative delays

    print("\n📊 Regression Results (on delayed flights only):")
    print(f"   MAE:      {mean_absolute_error(y_test[mask_test], y_pred):.1f} min")
    print(f"   RMSE:     {np.sqrt(mean_squared_error(y_test[mask_test], y_pred)):.1f} min")
    print(f"   R² Score: {r2_score(y_test[mask_test], y_pred):.3f}")

    return model


def build_shap_explainer(model, X_train) -> shap.TreeExplainer:
    """Build SHAP TreeExplainer for the classifier."""
    print("\n🔍 Building SHAP Explainer...")
    explainer = shap.TreeExplainer(model)

    # Quick test with a sample
    sample = X_train[:5]
    shap_values = explainer.shap_values(sample)
    print(f"   SHAP values computed for {len(sample)} samples")
    print(f"   Shape: {np.array(shap_values).shape}")

    return explainer


def save_models(classifier, regressor, explainer):
    """Save all model artifacts."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    classifier_path = MODEL_DIR / "delay_classifier.json"
    classifier.save_model(str(classifier_path))
    print(f"\n💾 Classifier saved: {classifier_path}")

    if regressor is not None:
        regressor_path = MODEL_DIR / "delay_regressor.json"
        regressor.save_model(str(regressor_path))
        print(f"💾 Regressor saved:  {regressor_path}")

    if explainer is not None:
        explainer_path = MODEL_DIR / "shap_explainer.pkl"
        joblib.dump(explainer, str(explainer_path))
        print(f"💾 SHAP explainer:   {explainer_path}")


# ── Main ─────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Smart Airport Operations – Model Training")
    print("=" * 60)

    # Load data
    df = load_data()

    # Prepare features and targets
    X = df[FEATURE_COLUMNS].values
    y_class = df[TARGET_CLASS].values
    y_reg = df[TARGET_REG].values

    # Split
    X_train, X_test, y_class_train, y_class_test, y_reg_train, y_reg_test = train_test_split(
        X, y_class, y_reg,
        test_size=0.2,
        random_state=42,
        stratify=y_class,
    )

    print(f"\n📊 Data split:")
    print(f"   Train: {len(X_train)} samples ({y_class_train.mean()*100:.1f}% delayed)")
    print(f"   Test:  {len(X_test)} samples ({y_class_test.mean()*100:.1f}% delayed)")

    # Train models
    classifier = train_classifier(X_train, X_test, y_class_train, y_class_test)
    regressor = train_regressor(X_train, X_test, y_reg_train, y_reg_test)

    # SHAP
    explainer = build_shap_explainer(classifier, X_train)

    # Save
    save_models(classifier, regressor, explainer)

    print("\n" + "=" * 60)
    print("  ✅ Training complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
