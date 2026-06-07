"""
train_v2_improved.py -- Smart Airport XGBoost v2 (Improved)
===========================================================
STEP 1  -- Strict feature set (no leakage)
STEP 2  -- Tuned XGBClassifier  (target = is_delayed)
STEP 3  -- Tuned XGBRegressor   (target = delay_minutes)
STEP 4  -- Full evaluation + comparison against old baselines
STEP 5  -- 5-fold TimeSeriesSplit CV on both models
STEP 6  -- Save models as model_classifier_v2.pkl / model_regressor_v2.pkl
STEP 7  -- Regenerate SHAP plots (summary, importance, waterfall)
"""
import io
import sys
# Force UTF-8 output so Unicode never hits the cp1252 codec
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import os
import json
import numpy as np
import pandas as pd
import joblib
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# ── path setup ─────────────────────────────────────────────────────────────────
backend_dir = Path(__file__).resolve().parent
sys.path.append(str(backend_dir))

from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
)
from sklearn.model_selection import TimeSeriesSplit
import xgboost as xgb
import shap

# ── Feature lists (STEP 1) ─────────────────────────────────────────────────────
# Columns we pass through read_sql and then subset
ALL_REQUESTED_FEATURES = [
    "dep_hour",
    "dep_day_of_week",
    "dep_month",
    "dep_week",
    "is_weekend",
    "is_peak_hour",
    "distance_km",
    "duration_min",
    "airline_enc",
    "dep_airport_enc",
    "arr_airport_enc",
    "status_enc",
    "route_avg_delay_hist",
    "airline_avg_delay_hist",
    "hour_avg_delay_hist",
    "route_flight_count",
    "airline_flight_count",
    "airport_departure_count",
]

TARGET_REG   = "delay_minutes"
TARGET_CLS   = "is_delayed"

# ── Old baselines (STEP 4 comparison) ─────────────────────────────────────────
OLD_CLF = {"accuracy": 0.6931, "f1": 0.675, "recall": 0.7525}
OLD_REG = {"mae": 16.44, "rmse": 25.98, "r2": -0.002}

# ── Model output directory ─────────────────────────────────────────────────────
MODEL_DIR = backend_dir / "app" / "ai" / "model"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def banner(title: str):
    width = 64
    print("\n" + "=" * width)
    print(f"  {title}")
    print("=" * width)


def load_and_prepare_data(db) -> tuple[pd.DataFrame, pd.DataFrame, list[str]]:
    """Load ae_flight_dataset, compute rolling features, return train/test."""
    banner("LOADING DATASET")

    query = db.query(AEFlightDataset)
    df_all = pd.read_sql(query.statement, db.bind)
    print(f"  Total rows in DB  : {len(df_all)}")

    # ── filter ────────────────────────────────────────────────────────────────
    df = df_all[
        (df_all['usable_for_ml'] == True) &
        (df_all['dep_hour'].notnull()) &
        (df_all['distance_km'].notnull()) &
        (df_all['airline_enc'].notnull()) &
        (df_all['final_status'] != 'cancelled') &
        ((df_all['completeness'] >= 0.6) | (df_all['completeness'].isnull()))
    ].copy()

    df = df.sort_values("flight_date").reset_index(drop=True)
    print(f"  ML-usable rows    : {len(df)}")

    # ── targets ───────────────────────────────────────────────────────────────
    df[TARGET_REG] = pd.to_numeric(df[TARGET_REG], errors="coerce").fillna(0)
    p99 = float(df[TARGET_REG].quantile(0.99))
    df[TARGET_REG] = df[TARGET_REG].clip(upper=p99)
    df[TARGET_CLS] = pd.to_numeric(df[TARGET_CLS], errors="coerce").fillna(0).astype(int)

    # ── add rolling features that may not exist in DB columns ─────────────────
    # Metadata mirror columns needed by rolling_features module
    df['_dep_iata']     = df['dep_iata']
    df['_arr_iata']     = df['arr_iata']
    df['_airline_iata'] = df['airline_iata']
    df['_flight_date']  = df['flight_date']

    # time split before rolling (leakage-free)
    cutoff_idx = int(len(df) * 0.8)
    train_df   = df.iloc[:cutoff_idx].copy()
    test_df    = df.iloc[cutoff_idx:].copy()
    print(f"  Train rows        : {len(train_df)}")
    print(f"  Test rows         : {len(test_df)}")

    # ── rolling enrichment ────────────────────────────────────────────────────
    rolling_cols = [
        "route_avg_delay_hist", "airline_avg_delay_hist", "hour_avg_delay_hist",
        "route_flight_count",   "airline_flight_count",   "airport_departure_count",
    ]
    # Check which rolling cols are already present (pre-computed in DB)
    missing_rolling = [c for c in rolling_cols if c not in df.columns]

    if missing_rolling:
        print(f"  Rolling cols missing from DB, computing from scratch: {missing_rolling}")
        try:
            from app.ml.rolling_features import enrich_with_rolling_features
            train_df, test_df = enrich_with_rolling_features(train_df, test_df)
            print("  Rolling features: computed OK")
        except Exception as e:
            print("  Rolling features failed ({}), filling zeros".format(e))
            for col in missing_rolling:
                train_df[col] = 0.0
                test_df[col]  = 0.0
    else:
        print("  Rolling features: already present in DB columns OK")
        # dep_month / dep_day_of_week are also DB columns -- just verify
        for col in ["dep_month", "dep_day_of_week"]:
            if col not in df.columns:
                train_df[col] = 0
                test_df[col]  = 0

    # ── resolve final feature list ─────────────────────────────────────────────
    # Only keep features that actually exist after enrichment
    feature_cols = [f for f in ALL_REQUESTED_FEATURES
                    if f in train_df.columns and f in test_df.columns]

    missing_feat = [f for f in ALL_REQUESTED_FEATURES if f not in feature_cols]
    if missing_feat:
        print(f"  WARNING — features not found, skipped: {missing_feat}")

    print(f"  Final feature set ({len(feature_cols)} cols): {feature_cols}")

    # ── coerce to numeric + fill nulls ────────────────────────────────────────
    for col in feature_cols:
        train_df[col] = pd.to_numeric(train_df[col], errors="coerce").fillna(0)
        test_df[col]  = pd.to_numeric(test_df[col],  errors="coerce").fillna(0)

    return train_df, test_df, feature_cols


def evaluate_classifier(model, X_test, y_test, label="XGBClassifier"):
    """Return metric dict and print a report."""
    y_pred = model.predict(X_test)
    acc  = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec  = recall_score(y_test, y_pred, zero_division=0)
    f1   = f1_score(y_test, y_pred, zero_division=0)
    cm   = confusion_matrix(y_test, y_pred)

    print(f"\n  {label} — Test Set Metrics")
    print(f"    Accuracy  : {acc*100:.2f}%")
    print(f"    Precision : {prec:.4f}")
    print(f"    Recall    : {rec:.4f}")
    print(f"    F1        : {f1:.4f}")
    print(f"    Confusion Matrix:\n{cm}")
    return {"accuracy": acc, "precision": prec, "recall": rec, "f1": f1, "cm": cm}


def evaluate_regressor(model, X_test, y_test, label="XGBRegressor"):
    """Return metric dict and print a report."""
    y_pred = np.maximum(model.predict(X_test), 0.0)
    mae  = mean_absolute_error(y_test, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2   = r2_score(y_test, y_pred)

    print(f"\n  {label} — Test Set Metrics")
    print(f"    MAE  : {mae:.4f} minutes")
    print(f"    RMSE : {rmse:.4f} minutes")
    print(f"    R²   : {r2:.6f}")
    return {"mae": mae, "rmse": rmse, "r2": r2}


def compare_metrics(new_clf, new_reg):
    """STEP 4 -- Print side-by-side comparison against old results."""
    banner("STEP 4 -- COMPARISON vs OLD RESULTS")

    print("\n  -- Classifier --")
    print("  {:<12} {:>10} {:>10} {:>10} {}".format("Metric", "Old", "New", "Delta", "Direction"))
    print("  " + "-" * 55)
    for key in ("accuracy", "f1", "recall"):
        old_v = OLD_CLF[key]
        new_v = new_clf[key]
        delta = new_v - old_v
        arrow = "BETTER" if delta > 0 else ("WORSE" if delta < 0 else "SAME")
        print("  {:<12} {:>10.4f} {:>10.4f} {:>+10.4f}  {}".format(key, old_v, new_v, delta, arrow))

    print("\n  -- Regressor --")
    print("  {:<8} {:>10} {:>10} {:>10} {}".format("Metric", "Old", "New", "Delta", "Direction"))
    print("  " + "-" * 55)
    for key in ("mae", "rmse", "r2"):
        old_v = OLD_REG[key]
        new_v = new_reg[key]
        delta = new_v - old_v
        # For MAE/RMSE lower is better; for R^2 higher is better
        if key in ("mae", "rmse"):
            arrow = "BETTER (lower)" if delta < 0 else ("WORSE (higher)" if delta > 0 else "SAME")
        else:
            arrow = "BETTER (higher)" if delta > 0 else ("WORSE (lower)" if delta < 0 else "SAME")
        print("  {:<8} {:>10.4f} {:>10.4f} {:>+10.4f}  {}".format(key, old_v, new_v, delta, arrow))


def run_cv_classifier(X, y, params, n_splits=5, label="Classifier CV"):
    """STEP 5 — 5-fold TimeSeriesSplit CV for classifier."""
    banner(f"STEP 5 — {label} (TimeSeriesSplit n={n_splits})")
    tscv = TimeSeriesSplit(n_splits=n_splits)
    acc_scores, f1_scores, rec_scores = [], [], []

    for fold, (tr_idx, te_idx) in enumerate(tscv.split(X)):
        X_tr, y_tr = X[tr_idx], y[tr_idx]
        X_te, y_te = X[te_idx], y[te_idx]
        m = xgb.XGBClassifier(**params)
        m.fit(X_tr, y_tr, verbose=False)
        y_pred = m.predict(X_te)
        acc_scores.append(accuracy_score(y_te, y_pred))
        f1_scores.append(f1_score(y_te, y_pred, zero_division=0))
        rec_scores.append(recall_score(y_te, y_pred, zero_division=0))
        print(f"  Fold {fold+1} → Acc={acc_scores[-1]:.4f}  F1={f1_scores[-1]:.4f}  Recall={rec_scores[-1]:.4f}")

    print(f"\n  Mean ± Std")
    print(f"    Accuracy : {np.mean(acc_scores):.4f} ± {np.std(acc_scores):.4f}")
    print(f"    F1       : {np.mean(f1_scores):.4f} ± {np.std(f1_scores):.4f}")
    print(f"    Recall   : {np.mean(rec_scores):.4f} ± {np.std(rec_scores):.4f}")
    return acc_scores, f1_scores, rec_scores


def run_cv_regressor(X, y, params, n_splits=5, label="Regressor CV"):
    """STEP 5 — 5-fold TimeSeriesSplit CV for regressor."""
    banner(f"STEP 5 — {label} (TimeSeriesSplit n={n_splits})")
    tscv = TimeSeriesSplit(n_splits=n_splits)
    mae_scores, rmse_scores, r2_scores = [], [], []

    for fold, (tr_idx, te_idx) in enumerate(tscv.split(X)):
        X_tr, y_tr = X[tr_idx], y[tr_idx]
        X_te, y_te = X[te_idx], y[te_idx]
        m = xgb.XGBRegressor(**params)
        m.fit(X_tr, y_tr, verbose=False)
        y_pred = np.maximum(m.predict(X_te), 0.0)
        mae_scores.append(mean_absolute_error(y_te, y_pred))
        rmse_scores.append(float(np.sqrt(mean_squared_error(y_te, y_pred))))
        r2_scores.append(r2_score(y_te, y_pred))
        print(f"  Fold {fold+1} → MAE={mae_scores[-1]:.4f}  RMSE={rmse_scores[-1]:.4f}  R²={r2_scores[-1]:.6f}")

    print(f"\n  Mean ± Std")
    print(f"    MAE  : {np.mean(mae_scores):.4f} ± {np.std(mae_scores):.4f}")
    print(f"    RMSE : {np.mean(rmse_scores):.4f} ± {np.std(rmse_scores):.4f}")
    print(f"    R²   : {np.mean(r2_scores):.6f} ± {np.std(r2_scores):.6f}")
    return mae_scores, rmse_scores, r2_scores


def save_models(clf, reg):
    """STEP 6 — Save both models."""
    banner("STEP 6 — SAVING MODELS")
    clf_path = MODEL_DIR / "model_classifier_v2.pkl"
    reg_path = MODEL_DIR / "model_regressor_v2.pkl"
    joblib.dump(clf, str(clf_path))
    joblib.dump(reg, str(reg_path))
    print(f"  Saved classifier → {clf_path}")
    print(f"  Saved regressor  → {reg_path}")
    return clf_path, reg_path


def generate_shap_plots(clf, X_test, feature_cols):
    """STEP 7 — Regenerate SHAP plots using the new classifier."""
    banner("STEP 7 — SHAP PLOTS (new classifier)")

    out_dir = backend_dir   # save next to other .png files
    explainer   = shap.TreeExplainer(clf)
    shap_values = explainer.shap_values(X_test)

    # ── top-10 feature importance (mean |SHAP|) ────────────────────────────
    mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
    feat_imp_df = pd.DataFrame({
        "Feature":          feature_cols,
        "Mean |SHAP|":      mean_abs_shap,
    }).sort_values("Mean |SHAP|", ascending=False).reset_index(drop=True)
    print("\n  Top-10 Features by Mean |SHAP|:")
    print(feat_imp_df.head(10).to_string(index=False))

    # ── shap_summary.png (beeswarm) ────────────────────────────────────────
    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, X_test, feature_names=feature_cols, show=False)
    plt.tight_layout()
    summary_path = out_dir / "shap_summary.png"
    plt.savefig(str(summary_path), dpi=150)
    plt.close()
    print(f"  Saved → {summary_path}")

    # ── shap_importance.png (bar chart) ───────────────────────────────────
    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, X_test, feature_names=feature_cols,
                      plot_type="bar", show=False)
    plt.tight_layout()
    imp_path = out_dir / "shap_importance.png"
    plt.savefig(str(imp_path), dpi=150)
    plt.close()
    print(f"  Saved → {imp_path}")

    # ── shap_waterfall.png (sample 0) ─────────────────────────────────────
    plt.figure(figsize=(10, 6))
    exp = shap.Explanation(
        values=shap_values[0],
        base_values=explainer.expected_value,
        data=X_test[0],
        feature_names=feature_cols,
    )
    shap.plots.waterfall(exp, show=False)
    plt.tight_layout()
    wf_path = out_dir / "shap_waterfall.png"
    plt.savefig(str(wf_path), dpi=150)
    plt.close()
    print(f"  Saved → {wf_path}")

    return str(summary_path), str(imp_path), str(wf_path)


def main():
    banner("SMART AIRPORT — XGBoost v2 IMPROVED TRAINING")

    db = SessionLocal()
    try:
        # ── DATA ──────────────────────────────────────────────────────────────
        train_df, test_df, feature_cols = load_and_prepare_data(db)

        X_train = train_df[feature_cols].values.astype(np.float32)
        X_test  = test_df[feature_cols].values.astype(np.float32)

        y_reg_train = train_df[TARGET_REG].values.astype(np.float32)
        y_reg_test  = test_df[TARGET_REG].values.astype(np.float32)

        y_cls_train = train_df[TARGET_CLS].values.astype(np.int32)
        y_cls_test  = test_df[TARGET_CLS].values.astype(np.int32)

        # ── STEP 2 — CLASSIFIER ───────────────────────────────────────────────
        banner("STEP 2 — TRAINING XGBClassifier (target=is_delayed)")
        clf_params = dict(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=5,
            gamma=0.1,
            reg_alpha=0.1,
            reg_lambda=1.0,
            scale_pos_weight=1.37,
            random_state=42,
            eval_metric='logloss',
            tree_method='hist',
        )
        print("  Hyperparameters:")
        print(json.dumps({k: v for k, v in clf_params.items() if k != "tree_method"}, indent=4))

        clf = xgb.XGBClassifier(**clf_params)
        clf.fit(X_train, y_cls_train, verbose=False)
        clf_metrics = evaluate_classifier(clf, X_test, y_cls_test)

        # ── STEP 3 — REGRESSOR ───────────────────────────────────────────────
        banner("STEP 3 — TRAINING XGBRegressor (target=delay_minutes)")
        reg_params = dict(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=5,
            gamma=0.1,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            eval_metric='mae',
            tree_method='hist',
        )
        print("  Hyperparameters:")
        print(json.dumps({k: v for k, v in reg_params.items() if k != "tree_method"}, indent=4))

        reg = xgb.XGBRegressor(**reg_params)
        reg.fit(X_train, y_reg_train, verbose=False)
        reg_metrics = evaluate_regressor(reg, X_test, y_reg_test)

        # ── STEP 4 — COMPARISON ──────────────────────────────────────────────
        compare_metrics(clf_metrics, reg_metrics)

        # ── STEP 5 — CV ──────────────────────────────────────────────────────
        run_cv_classifier(X_train, y_cls_train, clf_params, label="XGBClassifier CV")
        run_cv_regressor(X_train, y_reg_train, reg_params, label="XGBRegressor CV")

        # ── STEP 6 — SAVE MODELS ─────────────────────────────────────────────
        save_models(clf, reg)

        # ── STEP 7 — SHAP PLOTS ──────────────────────────────────────────────
        generate_shap_plots(clf, X_test, feature_cols)

        # ── FINAL SUMMARY ─────────────────────────────────────────────────────
        banner("ALL STEPS COMPLETE")
        print("\n  +------- FINAL RESULTS SUMMARY ----------------------------+")
        print("  |  Classifier (is_delayed)                                  |")
        print("  |    Accuracy  : {:.2f}%".format(clf_metrics['accuracy']*100))
        print("  |    Precision : {:.4f}".format(clf_metrics['precision']))
        print("  |    Recall    : {:.4f}".format(clf_metrics['recall']))
        print("  |    F1        : {:.4f}".format(clf_metrics['f1']))
        print("  +-----------------------------------------------------------+")
        print("  |  Regressor (delay_minutes)                                |")
        print("  |    MAE  : {:.4f} min".format(reg_metrics['mae']))
        print("  |    RMSE : {:.4f} min".format(reg_metrics['rmse']))
        print("  |    R2   : {:.6f}".format(reg_metrics['r2']))
        print("  +-----------------------------------------------------------+\n")

    finally:
        db.close()


if __name__ == "__main__":
    main()
